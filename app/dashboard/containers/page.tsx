// app/dashboard/containers/page.tsx
import { createAdminClient } from "@/lib/supabase/admin"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { ContainerTable } from "@/components/tables/ContainerTable"
import { SyncButton } from "@/components/ui/SyncButton"
import {
  buildPhTerminalFilterOptions,
  mergePhFilterOptionsWithVesselTerminals,
} from "@/lib/terminals/phTerminalFilters"

async function getContainerData() {
  const supabase = createAdminClient()

  const [{ data: containers }, { data: terminalRows }] = await Promise.all([
    supabase
      .from("containers")
      .select(`
      *,
      vessels ( name, terminal, eta, shipping_line )
    `)
      .order("created_at", { ascending: false }),
    supabase.from("terminals").select("name").order("name"),
  ])

  const now = new Date()

  const enriched = (containers || []).map((c) => {
    let demurrageDays: number | null = null
    let demurrageStatus: "safe" | "warning" | "critical" | "overdue" | null = null

    if (c.last_free_day) {
      const lfd = new Date(c.last_free_day)
      demurrageDays = Math.ceil((lfd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (demurrageDays < 0) demurrageStatus = "overdue"
      else if (demurrageDays <= 1) demurrageStatus = "critical"
      else if (demurrageDays <= 3) demurrageStatus = "warning"
      else demurrageStatus = "safe"
    }

    return { ...c, demurrageDays, demurrageStatus }
  })

  const statusCounts = {
    total: enriched.length,
    onVessel: enriched.filter((c) => c.status === "On Vessel" || c.status === "In Transit").length,
    available: enriched.filter((c) => c.status === "Available").length,
    released: enriched.filter((c) => c.status === "Released").length,
    pickedUp: enriched.filter((c) => c.status === "Picked Up").length,
    demurrageAlert: enriched.filter((c) => c.demurrageStatus === "warning" || c.demurrageStatus === "critical" || c.demurrageStatus === "overdue").length,
  }

  const terminalFilterOptions = mergePhFilterOptionsWithVesselTerminals(
    buildPhTerminalFilterOptions(terminalRows ?? []),
    enriched.map((c) => (c.vessels as { terminal?: string } | null)?.terminal)
  )

  return { containers: enriched, statusCounts, terminalFilterOptions }
}

export default async function ContainersPage() {
  const { containers, statusCounts, terminalFilterOptions } = await getContainerData()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Container Management</h2>
            <p className="mt-1 text-sm text-gray-400">
              Track containers, availability, and demurrage
            </p>
          </div>
          <div className="flex gap-2">
            <SyncButton />
          </div>
        </div>

        {/* Status Pipeline */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <PipelineCard label="Total" count={statusCounts.total} icon="all" />
          <PipelineCard label="On Vessel" count={statusCounts.onVessel} icon="vessel" />
          <PipelineCard label="Available" count={statusCounts.available} icon="available" active />
          <PipelineCard label="Released" count={statusCounts.released} icon="released" />
          <PipelineCard label="Picked Up" count={statusCounts.pickedUp} icon="picked" />
          <PipelineCard label="Demurrage Alert" count={statusCounts.demurrageAlert} icon="alert" warning={statusCounts.demurrageAlert > 0} />
        </div>

        {/* Container Table */}
        <div className="bg-[#111827] rounded-xl border border-white/5">
          <ContainerTable containers={containers} terminalFilterOptions={terminalFilterOptions} />
        </div>
      </div>
    </DashboardLayout>
  )
}

function PipelineCard({
  label,
  count,
  icon,
  active,
  warning,
}: {
  label: string
  count: number
  icon: string
  active?: boolean
  warning?: boolean
}) {
  let borderColor = "border-white/5"
  let countColor = "text-white"
  let bg = "bg-[#111827]"

  if (active) {
    borderColor = "border-emerald-500/30"
    countColor = "text-emerald-400"
    bg = "bg-emerald-500/5"
  }
  if (warning) {
    borderColor = "border-amber-500/30"
    countColor = "text-amber-400"
    bg = "bg-amber-500/5"
  }

  return (
    <div className={`${bg} rounded-xl border ${borderColor} p-4 text-center`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${countColor}`}>{count}</p>
    </div>
  )
}
