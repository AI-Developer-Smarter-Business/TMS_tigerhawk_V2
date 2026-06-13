// components/equipment/EquipmentPageTabs.tsx
"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { TrucksTable } from "@/components/equipment/TrucksTable"
import { ChassisTable } from "@/components/equipment/ChassisTable"

type Truck = {
  id: string
  truck_number: string
  truck_owner: string | null
  license_plate: string | null
  license_plate_state: string | null
  vin: string | null
  address: string | null
  registration_expiry: string | null
  inspection_expiry: string | null
  annual_inspection_expiry: string | null
  insurance_expiry: string | null
  engine_family: string | null
  has_sleeper: boolean
  use_for_pre_appointments: boolean
  enabled: boolean
  status: string
  notes: string | null
  created_at: string
  assigned_driver?: string | null
}

type Chassis = {
  id: string
  chassis_number: string
  chassis_owner: string | null
  chassis_size: string | null
  chassis_type: string | null
  license_number: string | null
  license_state: string | null
  address: string | null
  vin: string | null
  registration_expiry: string | null
  inspection_expiry: string | null
  insurance_expiry: string | null
  enabled: boolean
  status: string
  notes: string | null
  created_at: string
}

type EquipmentPageTabsProps = {
  trucks: Truck[]
  chassisList: Chassis[]
  truckStatusCounts: {
    total: number
    available: number
    dispatched: number
    enabled: number
    disabled: number
  }
  chassisStatusCounts: {
    total: number
    enabled: number
    disabled: number
  }
}

const tabs = ["Trucks", "Chassis"] as const
type TabName = (typeof tabs)[number]

function StatusBadge({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  const styles: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    orange: "bg-[#E8700A]/10 text-[#FF8C21] border-[#E8700A]/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  }

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium ${styles[color] || ""}`}>
      <span className="text-lg font-bold">{count}</span>
      {label}
    </span>
  )
}

const tabSlugMap: Record<string, TabName> = {
  trucks: "Trucks",
  chassis: "Chassis",
}

export function EquipmentPageTabs({
  trucks,
  chassisList,
  truckStatusCounts,
  chassisStatusCounts,
}: EquipmentPageTabsProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const initialTab = (tabParam && tabSlugMap[tabParam]) || "Trucks"
  const [activeTab, setActiveTab] = useState<TabName>(initialTab)

  // Sync active tab when URL query param changes (sidebar click)
  useEffect(() => {
    if (tabParam && tabSlugMap[tabParam]) {
      setActiveTab(tabSlugMap[tabParam])
    }
  }, [tabParam])

  return (
    <>
      {/* Sub-tabs */}
      <div className="border-b border-white/10">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-[#E8700A] text-[#FF8C21]"
                  : "border-transparent text-gray-500 hover:text-gray-300 hover:border-white/20"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Status Badges */}
      {activeTab === "Trucks" && (
        <div className="flex items-center gap-4 flex-wrap">
          <StatusBadge label="Total" count={truckStatusCounts.total} color="blue" />
          <StatusBadge label="Available" count={truckStatusCounts.available} color="emerald" />
          <StatusBadge label="Dispatched" count={truckStatusCounts.dispatched} color="orange" />
        </div>
      )}
      {activeTab === "Chassis" && (
        <div className="flex items-center gap-4 flex-wrap">
          <StatusBadge label="Total" count={chassisStatusCounts.total} color="blue" />
          <StatusBadge label="Enabled" count={chassisStatusCounts.enabled} color="emerald" />
          <StatusBadge label="Disabled" count={chassisStatusCounts.disabled} color="orange" />
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-[#111827] rounded-xl border border-white/5">
        {activeTab === "Trucks" && (
          <TrucksTable trucks={trucks} statusCounts={truckStatusCounts} />
        )}
        {activeTab === "Chassis" && (
          <ChassisTable chassisList={chassisList} statusCounts={chassisStatusCounts} />
        )}
      </div>
    </>
  )
}
