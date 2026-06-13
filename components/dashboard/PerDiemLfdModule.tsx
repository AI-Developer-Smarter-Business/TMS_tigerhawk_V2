// components/dashboard/PerDiemLfdModule.tsx
// Shows loads approaching or past their per diem free day / last free day
"use client"

import { ModuleCard } from "./ModuleCard"

interface PerDiemLoad {
  id: string
  reference_number: string
  per_diem_free_day: string | null
  container_number: string | null
  container_lfd: string | null
  customer_name: string | null
  status: string
}

interface PerDiemLfdModuleProps {
  loads: PerDiemLoad[]
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function getUrgencyStyle(days: number): { bg: string; text: string; label: string } {
  if (days < 0) return { bg: "bg-red-500/15", text: "text-red-400", label: `${Math.abs(days)}d overdue` }
  if (days === 0) return { bg: "bg-red-500/15", text: "text-red-400", label: "Due today" }
  if (days === 1) return { bg: "bg-amber-500/15", text: "text-amber-400", label: "Tomorrow" }
  if (days <= 3) return { bg: "bg-amber-500/15", text: "text-amber-400", label: `${days}d left` }
  return { bg: "bg-emerald-500/10", text: "text-emerald-400", label: `${days}d left` }
}

export function PerDiemLfdModule({ loads }: PerDiemLfdModuleProps) {
  // Build list of loads with their effective LFD (per_diem_free_day from load, or container.last_free_day)
  const enriched = loads
    .map((load) => {
      const effectiveDate = load.per_diem_free_day || load.container_lfd
      if (!effectiveDate) return null
      const days = getDaysUntil(effectiveDate)
      return { ...load, effectiveDate, days }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .sort((a, b) => a.days - b.days)

  const overdue = enriched.filter((l) => l.days < 0).length
  const dueToday = enriched.filter((l) => l.days === 0).length
  const upcoming = enriched.filter((l) => l.days > 0 && l.days <= 3).length

  return (
    <ModuleCard title="Per Diem / LFD" linkHref="/dashboard/shipments" linkText="All loads">
      {/* Summary bar */}
      <div className="px-6 py-3 flex gap-4 border-b border-white/5">
        {overdue > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-red-400 font-medium">{overdue} overdue</span>
          </div>
        )}
        {dueToday > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-red-400 font-medium">{dueToday} due today</span>
          </div>
        )}
        {upcoming > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-400 font-medium">{upcoming} within 3 days</span>
          </div>
        )}
        {enriched.length === 0 && (
          <span className="text-xs text-gray-500">No upcoming per diem deadlines</span>
        )}
      </div>

      {/* Load list */}
      <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
        {enriched.slice(0, 10).map((load) => {
          const urgency = getUrgencyStyle(load.days)
          return (
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
              <span
                className={`shrink-0 ml-3 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${urgency.bg} ${urgency.text}`}
              >
                {urgency.label}
              </span>
            </a>
          )
        })}
      </div>
    </ModuleCard>
  )
}
