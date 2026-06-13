// app/dashboard/vessels/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { VesselTable } from "@/components/tables/VesselTable"
import { SyncButton } from "@/components/ui/SyncButton"
import { VesselFinderMap } from "@/components/ui/VesselFinderMap"
import type { PhTerminalFilterOption } from "@/lib/terminals/phTerminalFilters"
import {
  buildPhTerminalFilterOptions,
  mergePhFilterOptionsWithVesselTerminals,
} from "@/lib/terminals/phTerminalFilters"

async function getVesselData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ETA window: recent past + future. A very short lookback (e.g. 3 days) hides all rows once
  // calendar time moves past demo/sync data (see vessels_rows.csv — many ETAs are weeks/months ago).
  const VESSEL_ETA_LOOKBACK_DAYS = 120
  const etaLowerBound = new Date(
    Date.now() - VESSEL_ETA_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const [{ data: vessels }, { data: terminalRows }] = await Promise.all([
    supabase
      .from("vessels")
      .select("*")
      .or(`eta.gte.${etaLowerBound},eta.is.null`)
      .order("eta", { ascending: true }),
    supabase.from("terminals").select("name").order("name"),
  ])

  const { data: containers } = await supabase
    .from("containers")
    .select("vessel_id, status")

  // Count containers per vessel
  const containerCounts: Record<string, { total: number; available: number; onVessel: number; pickedUp: number }> = {}
  containers?.forEach((c) => {
    if (!c.vessel_id) return
    if (!containerCounts[c.vessel_id]) {
      containerCounts[c.vessel_id] = { total: 0, available: 0, onVessel: 0, pickedUp: 0 }
    }
    containerCounts[c.vessel_id].total++
    if (c.status === "Available") containerCounts[c.vessel_id].available++
    if (c.status === "On Vessel" || c.status === "In Transit") containerCounts[c.vessel_id].onVessel++
    if (c.status === "Picked Up") containerCounts[c.vessel_id].pickedUp++
  })

  const now = new Date()
  const enrichedVessels = (vessels || []).map((v) => {
    const eta = v.eta ? new Date(v.eta) : null
    const phase = v.visit_phase || ""

    // Use PH visit_phase as the authoritative status when available
    // "Arriving" = inbound AND ETA within next 24 hours
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    let vesselStatus = "En Route"
    if (phase.startsWith("60") || phase.startsWith("70")) {
      vesselStatus = "Departed"
    } else if (phase.startsWith("40")) {
      vesselStatus = "At Berth"
    } else if (phase.startsWith("20") || phase.startsWith("30")) {
      // Inbound — only "Arriving" if ETA is within 24h, otherwise still "En Route"
      vesselStatus = (eta && eta <= oneDayFromNow) ? "Arriving" : "En Route"
    } else if (phase.startsWith("10")) {
      vesselStatus = (eta && eta <= oneDayFromNow) ? "Arriving" : "En Route"
    } else if (v.ata) {
      vesselStatus = "At Berth"
    } else if (eta && eta <= now) {
      vesselStatus = "Arriving"
    } else if (eta && eta <= oneDayFromNow) {
      vesselStatus = "Arriving"
    } else {
      vesselStatus = "En Route"
    }

    return {
      ...v,
      vesselStatus,
      containerStats: containerCounts[v.id] || { total: 0, available: 0, onVessel: 0, pickedUp: 0 },
    }
  })

  // Sort by imminence: At Berth → Arriving → En Route → Departed
  const STATUS_PRIORITY: Record<string, number> = {
    "At Berth": 0,
    "Arriving": 1,
    "En Route": 2,
    "Departed": 3,
  }

  enrichedVessels.sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.vesselStatus] ?? 4
    const priorityB = STATUS_PRIORITY[b.vesselStatus] ?? 4
    if (priorityA !== priorityB) return priorityA - priorityB
    // Within same status, sort by ETA ascending
    const etaA = a.eta ? new Date(a.eta).getTime() : Infinity
    const etaB = b.eta ? new Date(b.eta).getTime() : Infinity
    return etaA - etaB
  })

  // Stats (exclude departed)
  const activeVessels = enrichedVessels.filter((v) => v.vesselStatus !== "Departed")
  const arriving = activeVessels.filter((v) => v.vesselStatus === "Arriving").length
  const atBerth = activeVessels.filter((v) => v.vesselStatus === "At Berth").length
  const enRoute = activeVessels.filter((v) => v.vesselStatus === "En Route").length
  const totalContainersInbound = Object.values(containerCounts).reduce((sum, c) => sum + c.onVessel, 0)

  const terminalFilterOptions = mergePhFilterOptionsWithVesselTerminals(
    buildPhTerminalFilterOptions(terminalRows ?? []),
    enrichedVessels.map((v) => v.terminal)
  )

  return {
    vessels: enrichedVessels,
    stats: { arriving, atBerth, enRoute, totalContainersInbound, totalVessels: activeVessels.length },
    terminalFilterOptions,
  }
}

function terminalCardsForVessels(
  terminalFilterOptions: PhTerminalFilterOption[],
  vessels: { terminal: string }[],
): PhTerminalFilterOption[] {
  const codesOnVessels = new Set(vessels.map((v) => v.terminal).filter(Boolean))
  const preferred = ["BCT", "BAY"]
  const seen = new Set<string>()
  const out: PhTerminalFilterOption[] = []
  for (const code of preferred) {
    const o = terminalFilterOptions.find((x) => x.code === code)
    if (o && !seen.has(o.code)) {
      out.push(o)
      seen.add(o.code)
    }
  }
  for (const o of terminalFilterOptions) {
    if (seen.has(o.code)) continue
    if (codesOnVessels.has(o.code)) {
      out.push(o)
      seen.add(o.code)
    }
  }
  return out
}

export default async function VesselsPage() {
  const { vessels, stats, terminalFilterOptions } = await getVesselData()
  const terminalCards = terminalCardsForVessels(terminalFilterOptions, vessels)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Vessel Tracking</h2>
            <p className="mt-1 text-sm text-gray-400">
              Monitor vessels arriving at Port Houston terminals
            </p>
          </div>
          <div className="flex gap-2">
            <SyncButton />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MiniStat label="Total Vessels" value={stats.totalVessels} />
          <MiniStat label="At Berth" value={stats.atBerth} highlight />
          <MiniStat label="Arriving" value={stats.arriving} />
          <MiniStat label="En Route" value={stats.enRoute} />
          <MiniStat label="Containers Inbound" value={stats.totalContainersInbound} />
        </div>

        {/* Terminals + Live Map — cards driven by `terminals` + vessel codes (not hardcoded BCT/BAY only) */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {terminalCards.map((opt) => (
              <TerminalCard
                key={opt.code}
                name={opt.pillLabel}
                code={opt.code}
                vessels={vessels.filter((v) => v.terminal === opt.code)}
                className="flex-1 min-w-[240px] max-w-md"
              />
            ))}
          </div>
          <VesselFinderMap />
        </div>

        {/* Full Vessel Table */}
        <div className="bg-[#111827] rounded-xl border border-white/5">
          <div className="px-6 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">All Vessels</h3>
          </div>
          <VesselTable vessels={vessels} terminalFilterOptions={terminalFilterOptions} />
        </div>
      </div>
    </DashboardLayout>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-[#111827] rounded-xl border border-white/5 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? "text-[#E8700A]" : "text-white"}`}>
        {value}
      </p>
    </div>
  )
}

function TerminalCard({
  name,
  code,
  vessels,
  className = "",
}: {
  name: string
  code: string
  vessels: any[]
  className?: string
}) {
  const arriving = vessels.filter((v) => v.vesselStatus === "Arriving")

  return (
    <div className={`bg-[#111827] rounded-xl border border-white/5 p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">{name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{vessels.length} vessels scheduled</p>
        </div>
        <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide bg-[#E8700A]/15 text-[#E8700A]">
          {code}
        </span>
      </div>

      {arriving.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[#E8700A]/10 border border-[#E8700A]/20">
          <p className="text-xs font-medium text-[#FF8C21]">
            {arriving.length} vessel{arriving.length > 1 ? "s" : ""} arriving
          </p>
        </div>
      )}

      <div className="space-y-2">
        {vessels.slice(0, 3).map((v) => (
          <div key={v.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-200">{v.name}</p>
              <p className="text-xs text-gray-500">{v.shipping_line} &middot; {v.voyage_number}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{formatEtaShort(v.eta)}</p>
              <VesselStatusBadge status={v.vesselStatus} />
            </div>
          </div>
        ))}
        {vessels.length === 0 && (
          <p className="text-sm text-gray-500 py-2">No vessels scheduled</p>
        )}
      </div>
    </div>
  )
}

function VesselStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "At Berth": "bg-emerald-500/10 text-emerald-400",
    "Arriving": "bg-[#E8700A]/15 text-[#FF8C21]",
    "En Route": "bg-blue-500/10 text-blue-400",
    "Departed": "bg-gray-500/10 text-gray-500",
  }

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${styles[status] || styles["Scheduled"]}`}>
      {status}
    </span>
  )
}

function formatEtaShort(eta: string | null) {
  if (!eta) return "TBD"
  const date = new Date(eta)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })

  if (date.toDateString() === now.toDateString()) return `Today ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`

  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 7) return `${diffDays}d — ${date.toLocaleDateString("en-US", { weekday: "short" })} ${time}`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` ${time}`
}
