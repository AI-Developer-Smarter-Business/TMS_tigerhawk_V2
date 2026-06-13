// components/dashboard/DriverSummaryModule.tsx
// Condensed driver availability counts (replaces the space-inefficient full driver list)
"use client"

import { ModuleCard } from "./ModuleCard"

interface Driver {
  id: string
  name: string
  status: string
}

interface DriverSummaryModuleProps {
  drivers: Driver[]
}

interface StatusGroup {
  status: string
  color: { bg: string; text: string; ring: string }
}

const STATUS_GROUPS: StatusGroup[] = [
  {
    status: "Available",
    color: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      ring: "ring-emerald-500/30",
    },
  },
  {
    status: "On Job",
    color: {
      bg: "bg-[#E8700A]/15",
      text: "text-[#FF8C21]",
      ring: "ring-[#E8700A]/30",
    },
  },
  {
    status: "Off Duty",
    color: {
      bg: "bg-white/5",
      text: "text-gray-500",
      ring: "ring-white/10",
    },
  },
]

export function DriverSummaryModule({ drivers }: DriverSummaryModuleProps) {
  const total = drivers.length
  const counts: Record<string, number> = {}
  for (const d of drivers) {
    counts[d.status] = (counts[d.status] || 0) + 1
  }

  return (
    <ModuleCard
      title="Driver Summary"
      linkHref="/dashboard/drivers"
      linkText="Manage"
    >
      <div className="p-6">
        {/* Big number */}
        <div className="text-center mb-4">
          <p className="text-4xl font-bold text-white">{total}</p>
          <p className="text-xs text-gray-500 mt-1">Total Drivers</p>
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-3">
          {STATUS_GROUPS.map((group) => {
            const count = counts[group.status] || 0
            return (
              <div
                key={group.status}
                className={`rounded-lg ${group.color.bg} ring-1 ${group.color.ring} p-3 text-center`}
              >
                <p className={`text-xl font-bold ${group.color.text}`}>
                  {count}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium uppercase tracking-wider">
                  {group.status}
                </p>
              </div>
            )
          })}
        </div>

        {/* Any other statuses not covered */}
        {Object.entries(counts)
          .filter(([status]) => !STATUS_GROUPS.some((g) => g.status === status))
          .map(([status, count]) => (
            <div
              key={status}
              className="mt-2 flex items-center justify-between text-xs"
            >
              <span className="text-gray-500">{status}</span>
              <span className="text-gray-300 font-medium">{count}</span>
            </div>
          ))}
      </div>
    </ModuleCard>
  )
}
