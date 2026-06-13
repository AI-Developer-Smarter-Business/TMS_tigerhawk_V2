// components/dashboard/LoadPipelineModule.tsx
// Shows load counts grouped by pipeline stage
"use client"

import { ModuleCard } from "./ModuleCard"

interface LoadPipelineModuleProps {
  statusCounts: Record<string, number>
}

// Group raw statuses into pipeline stages
interface PipelineStage {
  label: string
  statuses: string[]
  color: { bg: string; text: string; bar: string }
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    label: "Pending",
    statuses: ["Available", "Available At Port", "Pending", "Customs Hold", "Freight Released", "Created"],
    color: { bg: "bg-gray-500/10", text: "text-gray-400", bar: "bg-gray-500" },
  },
  {
    label: "Assigned",
    statuses: ["Assigned"],
    color: { bg: "bg-blue-500/10", text: "text-blue-400", bar: "bg-blue-500" },
  },
  {
    label: "Dispatched",
    statuses: ["Dispatched"],
    color: { bg: "bg-purple-500/10", text: "text-purple-400", bar: "bg-purple-500" },
  },
  {
    label: "In Transit",
    statuses: [
      "In Transit",
      "Arrived At Pickup",
      "Arrived To Hook Container",
      "Enroute To Drop Container",
      "Dropped - Loaded",
    ],
    color: { bg: "bg-[#E8700A]/15", text: "text-[#FF8C21]", bar: "bg-[#E8700A]" },
  },
  {
    label: "At Destination",
    statuses: ["Arrived At Delivery", "At Warehouse", "Dropped - Empty"],
    color: { bg: "bg-cyan-500/10", text: "text-cyan-400", bar: "bg-cyan-500" },
  },
  {
    label: "Returning",
    statuses: ["Enroute To Return Empty", "Arrived At Return Empty"],
    color: { bg: "bg-indigo-500/10", text: "text-indigo-400", bar: "bg-indigo-500" },
  },
  {
    label: "Delivered",
    statuses: ["Delivered"],
    color: { bg: "bg-emerald-500/10", text: "text-emerald-400", bar: "bg-emerald-500" },
  },
]

export function LoadPipelineModule({ statusCounts }: LoadPipelineModuleProps) {
  const stages = PIPELINE_STAGES.map((stage) => {
    const count = stage.statuses.reduce(
      (sum, s) => sum + (statusCounts[s] || 0),
      0
    )
    return { ...stage, count }
  })

  const totalActive = stages.reduce((sum, s) => sum + s.count, 0)
  const maxCount = Math.max(...stages.map((s) => s.count), 1)

  return (
    <ModuleCard
      title="Load Pipeline"
      linkHref="/dashboard/shipments"
      linkText="All loads"
    >
      {/* Total */}
      <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs text-gray-500">Active Loads</span>
        <span className="text-lg font-bold text-white">{totalActive}</span>
      </div>

      {/* Pipeline stages */}
      <div className="px-6 py-4 space-y-2.5">
        {stages.map((stage) => {
          const pct =
            maxCount > 0
              ? Math.max(
                  (stage.count / maxCount) * 100,
                  stage.count > 0 ? 4 : 0
                )
              : 0
          return (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-gray-400 text-right">
                {stage.label}
              </span>
              <div className="flex-1 bg-white/5 rounded-full h-2">
                <div
                  className={`${stage.color.bar} h-2 rounded-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span
                className={`w-8 shrink-0 text-xs font-medium text-right ${stage.color.text}`}
              >
                {stage.count}
              </span>
            </div>
          )
        })}
      </div>
    </ModuleCard>
  )
}
