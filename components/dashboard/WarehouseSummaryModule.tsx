// components/dashboard/WarehouseSummaryModule.tsx
// Warehouse capacity and activity — extracted from original dashboard
"use client"

import { ModuleCard } from "./ModuleCard"

interface WarehouseData {
  totalPallets: number
  capacity: number
  pendingTransloads: number
  outboundToday: number
  inboundExpected: number
}

interface WarehouseSummaryModuleProps {
  warehouse: WarehouseData
}

export function WarehouseSummaryModule({
  warehouse,
}: WarehouseSummaryModuleProps) {
  const capacityPercent = Math.round(
    (warehouse.totalPallets / warehouse.capacity) * 100
  )

  return (
    <ModuleCard
      title="Baytown Warehouse"
      linkHref="/dashboard/warehouse"
      linkText="Details"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Total Pallets in Storage</span>
          <span className="text-lg font-bold text-white">
            {warehouse.totalPallets}
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-[#E8700A] to-[#FF8C21] h-2.5 rounded-full"
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{capacityPercent}% capacity</span>
          <span>{warehouse.capacity} max</span>
        </div>
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Pending Transloads</span>
            <span className="font-semibold text-white">
              {warehouse.pendingTransloads}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Outbound Today</span>
            <span className="font-semibold text-white">
              {warehouse.outboundToday}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Inbound Expected</span>
            <span className="font-semibold text-white">
              {warehouse.inboundExpected}
            </span>
          </div>
        </div>
      </div>
    </ModuleCard>
  )
}
