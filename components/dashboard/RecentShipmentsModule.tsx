// components/dashboard/RecentShipmentsModule.tsx
// Recent shipments table — extracted from original dashboard
"use client"

import { ModuleCard } from "./ModuleCard"

interface Shipment {
  id: string
  reference_number: string
  status: string
  customers: { name: string } | null
  containers: { container_number: string } | null
  drivers: { name: string } | null
}

interface RecentShipmentsModuleProps {
  shipments: Shipment[]
  isDriver: boolean
}

const statusStyles: Record<string, string> = {
  Created: "bg-gray-500/10 text-gray-400",
  Assigned: "bg-blue-500/10 text-blue-400",
  Dispatched: "bg-purple-500/10 text-purple-400",
  "In Transit": "bg-[#E8700A]/15 text-[#FF8C21]",
  "At Warehouse": "bg-cyan-500/10 text-cyan-400",
  Delivered: "bg-emerald-500/10 text-emerald-400",
  Completed: "bg-emerald-500/10 text-emerald-400",
  Cancelled: "bg-red-500/10 text-red-400",
}

export function RecentShipmentsModule({
  shipments,
  isDriver,
}: RecentShipmentsModuleProps) {
  return (
    <ModuleCard
      title={isDriver ? "My Shipments" : "Recent Shipments"}
      linkHref="/dashboard/shipments"
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Reference</th>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Container</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Driver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {shipments.map((s) => (
              <tr
                key={s.id}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-6 py-3 text-sm font-medium text-gray-200">
                  {s.reference_number}
                </td>
                <td className="px-6 py-3 text-sm text-gray-400">
                  {s.customers?.name || "—"}
                </td>
                <td className="px-6 py-3 text-xs text-gray-500 font-mono">
                  {s.containers?.container_number || "—"}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[s.status] || "bg-gray-500/10 text-gray-400"}`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-400">
                  {s.drivers?.name || "Unassigned"}
                </td>
              </tr>
            ))}
            {shipments.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  No shipments yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ModuleCard>
  )
}
