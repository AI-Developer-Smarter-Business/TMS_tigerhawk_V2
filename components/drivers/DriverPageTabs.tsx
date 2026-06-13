// components/drivers/DriverPageTabs.tsx
"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { DriverTable } from "@/components/tables/DriverTable"
import { TruckAssignmentsTable } from "@/components/tables/TruckAssignmentsTable"
import { FleetOwnersTable } from "@/components/tables/FleetOwnersTable"
import DriverPayRatesView from "@/components/tables/DriverPayRatesView"
import SettlementSettingsView from "@/components/tables/SettlementSettingsView"

type StatusCounts = {
  total: number
  available: number
  dispatched: number
  enabled: number
  disabled: number
}

type Truck = {
  truck_number: string
  truck_owner: string | null
  enabled: boolean
}

type DriverPageTabsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drivers: any[]
  statusCounts: StatusCounts
  trucks: Truck[]
}

const tabs = [
  "Driver Profiles",
  "Truck Assignments",
  "Fleet Owners",
  "Driver Pay Rates",
  "Settlement Settings",
] as const

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
  }

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium ${styles[color] || ""}`}>
      <span className="text-lg font-bold">{count}</span>
      {label}
    </span>
  )
}

const tabSlugMap: Record<string, TabName> = {
  "driver-profiles": "Driver Profiles",
  "truck-assignments": "Truck Assignments",
  "fleet-owners": "Fleet Owners",
  "driver-pay-rates": "Driver Pay Rates",
  "settlement-settings": "Settlement Settings",
}

export function DriverPageTabs({ drivers, statusCounts, trucks }: DriverPageTabsProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const initialTab = (tabParam && tabSlugMap[tabParam]) || "Driver Profiles"
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

      {/* Status Badges — show on Driver Profiles and Truck Assignments */}
      {(activeTab === "Driver Profiles" || activeTab === "Truck Assignments") && (
        <div className="flex items-center gap-4 flex-wrap">
          <StatusBadge label="Available" count={statusCounts.available} color="emerald" />
          <StatusBadge label="Dispatched" count={statusCounts.dispatched} color="orange" />
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-[#111827] rounded-xl border border-white/5">
        {activeTab === "Driver Profiles" && (
          <DriverTable drivers={drivers} statusCounts={statusCounts} />
        )}
        {activeTab === "Truck Assignments" && (
          <TruckAssignmentsTable drivers={drivers} trucks={trucks} />
        )}
        {activeTab === "Fleet Owners" && (
          <FleetOwnersTable />
        )}
        {activeTab === "Driver Pay Rates" && (
          <DriverPayRatesView drivers={drivers} />
        )}
        {activeTab === "Settlement Settings" && (
          <SettlementSettingsView drivers={drivers} />
        )}
      </div>
    </>
  )
}
