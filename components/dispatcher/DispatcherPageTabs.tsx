"use client"

import { useState, useMemo } from "react"
import { DispatcherClient } from "./DispatcherClient"
import { DriverItineraryTab } from "./tabs/DriverItineraryTab"
import { PlannerTab } from "./tabs/PlannerTab"
import { DualTransactionsTab } from "./tabs/DualTransactionsTab"
import { StreetTurnsTab } from "./tabs/StreetTurnsTab"
import { ProblemContainersTab } from "./tabs/ProblemContainersTab"
import { LoadWithRelations, PipelineCounts } from "@/types/dispatcher"

type DriverInfo = {
  id: string
  name: string
  phone: string | null
  status: string
  truck_number: string | null
}

type Props = {
  loads: LoadWithRelations[]
  pipelineCounts: PipelineCounts
  availableDrivers: { id: string; name: string; phone: string | null; status: string }[]
  allDrivers: DriverInfo[]
}

type TabId = "dispatcher" | "driver-itinerary" | "planner" | "dual-transactions" | "street-turns" | "problem-containers"

const TABS: { id: TabId; label: string; countFn?: (loads: LoadWithRelations[]) => number }[] = [
  { id: "dispatcher", label: "Dispatcher" },
  { id: "driver-itinerary", label: "Driver Itinerary" },
  { id: "planner", label: "Planner" },
  { id: "dual-transactions", label: "Dual Transactions" },
  {
    id: "street-turns",
    label: "Street Turns",
    countFn: (loads) => loads.filter(l => l.load_type === "Import" || l.load_type === "Export").length,
  },
  {
    id: "problem-containers",
    label: "Problem Containers",
    countFn: (loads) =>
      loads.filter(
        (l) =>
          l.customs_hold === "hold" ||
          l.freight_hold === "hold" ||
          l.terminal_hold === "hold" ||
          l.carrier_hold === true ||
          (l.containers?.last_free_day && new Date(l.containers.last_free_day) < new Date() && l.status !== "Completed")
      ).length,
  },
]

export function DispatcherPageTabs({ loads, pipelineCounts, availableDrivers, allDrivers }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("dispatcher")

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<TabId, number>> = {}
    for (const tab of TABS) {
      if (tab.countFn) {
        counts[tab.id] = tab.countFn(loads)
      }
    }
    return counts
  }, [loads])

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-white/10 px-4">
        <nav className="flex gap-1" aria-label="Dispatcher tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap
                ${
                  activeTab === tab.id
                    ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#E8700A]"
                    : "text-gray-400 hover:text-gray-200"
                }
              `}
            >
              {tab.label}
              {tabCounts[tab.id] !== undefined && (
                <span
                  className={`ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                    activeTab === tab.id
                      ? "bg-[#E8700A] text-white"
                      : "bg-white/10 text-gray-400"
                  }`}
                >
                  {tabCounts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "dispatcher" && (
          <DispatcherClient
            loads={loads}
            pipelineCounts={pipelineCounts}
            availableDrivers={availableDrivers}
          />
        )}
        {activeTab === "driver-itinerary" && (
          <DriverItineraryTab loads={loads} drivers={allDrivers} />
        )}
        {activeTab === "planner" && (
          <PlannerTab loads={loads} drivers={allDrivers} />
        )}
        {activeTab === "dual-transactions" && (
          <DualTransactionsTab loads={loads} />
        )}
        {activeTab === "street-turns" && (
          <StreetTurnsTab loads={loads} />
        )}
        {activeTab === "problem-containers" && (
          <ProblemContainersTab loads={loads} />
        )}
      </div>
    </div>
  )
}
