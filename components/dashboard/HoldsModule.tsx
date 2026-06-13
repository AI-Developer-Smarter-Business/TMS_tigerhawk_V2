// components/dashboard/HoldsModule.tsx
// Shows loads with active holds (freight, customs, terminal, fees, carrier, other)
"use client"

import { ModuleCard } from "./ModuleCard"

interface HoldLoad {
  id: string
  reference_number: string
  container_number: string | null
  customer_name: string | null
  freight_hold: string
  customs_hold: string
  terminal_hold: string
  fees_hold: string
  carrier_hold: boolean
  other_hold: string
}

interface HoldsModuleProps {
  loads: HoldLoad[]
}

type HoldType = "freight" | "customs" | "terminal" | "fees" | "carrier" | "other"

const HOLD_COLORS: Record<HoldType, { bg: string; text: string }> = {
  freight: { bg: "bg-purple-500/15", text: "text-purple-400" },
  customs: { bg: "bg-red-500/15", text: "text-red-400" },
  terminal: { bg: "bg-amber-500/15", text: "text-amber-400" },
  fees: { bg: "bg-blue-500/15", text: "text-blue-400" },
  carrier: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  other: { bg: "bg-gray-500/15", text: "text-gray-400" },
}

function getActiveHolds(load: HoldLoad): HoldType[] {
  const holds: HoldType[] = []
  if (load.freight_hold === "hold") holds.push("freight")
  if (load.customs_hold === "hold") holds.push("customs")
  if (load.terminal_hold === "hold") holds.push("terminal")
  if (load.fees_hold === "hold") holds.push("fees")
  if (load.carrier_hold) holds.push("carrier")
  if (load.other_hold === "hold") holds.push("other")
  return holds
}

export function HoldsModule({ loads }: HoldsModuleProps) {
  // Only show loads that actually have active holds
  const loadsWithHolds = loads
    .map((load) => ({ ...load, activeHolds: getActiveHolds(load) }))
    .filter((l) => l.activeHolds.length > 0)

  // Count by type
  const holdCounts: Record<HoldType, number> = {
    freight: 0,
    customs: 0,
    terminal: 0,
    fees: 0,
    carrier: 0,
    other: 0,
  }
  for (const load of loadsWithHolds) {
    for (const h of load.activeHolds) {
      holdCounts[h]++
    }
  }

  const activeTypes = (Object.entries(holdCounts) as [HoldType, number][]).filter(
    ([, count]) => count > 0
  )

  return (
    <ModuleCard title="Holds Dashboard" linkHref="/dashboard/shipments" linkText="All loads">
      {/* Summary counts */}
      <div className="px-6 py-3 flex flex-wrap gap-3 border-b border-white/5">
        {activeTypes.length === 0 && (
          <span className="text-xs text-emerald-400 font-medium">No active holds</span>
        )}
        {activeTypes.map(([type, count]) => (
          <div
            key={type}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${HOLD_COLORS[type].bg} ${HOLD_COLORS[type].text}`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}: {count}
          </div>
        ))}
      </div>

      {/* Load list */}
      <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
        {loadsWithHolds.slice(0, 10).map((load) => (
          <a
            key={load.id}
            href={`/dashboard/shipments/${load.id}`}
            className="px-6 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">
                {load.reference_number}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {load.container_number || "No container"} &middot;{" "}
                {load.customer_name || "—"}
              </p>
            </div>
            <div className="shrink-0 ml-3 flex gap-1">
              {load.activeHolds.map((h) => (
                <span
                  key={h}
                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${HOLD_COLORS[h].bg} ${HOLD_COLORS[h].text}`}
                >
                  {h.slice(0, 3)}
                </span>
              ))}
            </div>
          </a>
        ))}
        {loadsWithHolds.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            All clear — no holds on active loads
          </div>
        )}
      </div>
    </ModuleCard>
  )
}
