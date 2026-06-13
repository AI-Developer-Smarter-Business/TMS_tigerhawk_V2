// components/dashboard/IncomingVesselsModule.tsx
// Upcoming vessels — extracted from original dashboard
"use client"

import { ModuleCard } from "./ModuleCard"

interface Vessel {
  id: string
  name: string
  terminal: string
  eta: string | null
  shipping_line: string | null
}

interface IncomingVesselsModuleProps {
  vessels: Vessel[]
}

function formatEta(eta: string | null): string {
  if (!eta) return "TBD"
  const date = new Date(eta)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
  if (date.toDateString() === now.toDateString()) return `Today, ${time}`
  if (date.toDateString() === tomorrow.toDateString())
    return `Tomorrow, ${time}`
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`
}

export function IncomingVesselsModule({ vessels }: IncomingVesselsModuleProps) {
  return (
    <ModuleCard
      title="Incoming Vessels"
      linkHref="/dashboard/vessels"
    >
      <div className="divide-y divide-white/5">
        {vessels.slice(0, 5).map((vessel) => (
          <div
            key={vessel.id}
            className="px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">
                  {vessel.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {vessel.shipping_line || "—"} &middot; ETA:{" "}
                  {formatEta(vessel.eta)}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#E8700A]/15 text-[#E8700A]">
                  {vessel.terminal}
                </span>
              </div>
            </div>
          </div>
        ))}
        {vessels.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No vessels scheduled
          </div>
        )}
      </div>
    </ModuleCard>
  )
}
