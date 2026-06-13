"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { LoadWithRelations, LOAD_STATUS_COLORS, ProblemType } from "@/types/dispatcher"
import { Search, Filter, AlertTriangle } from "lucide-react"
import { formatDate } from "@/lib/utils"

type ProblemContainerWithHolds = LoadWithRelations & {
  holds?: {
    freight: { status: string; note: string | null } | null
    terminal: { status: string; note: string | null } | null
    fees: { status: string; note: string | null } | null
    other: { status: string; note: string | null } | null
    carrier: boolean
  }
  lfdIssue?: {
    type: string
    daysOverdue: number
  } | null
  problemType?: ProblemType
}

type TabType = "Problem Container" | "Demurrage" | "Missed Cut Off" | "Empty Return Closed"

type Props = {
  problemContainersData: ProblemContainerWithHolds[]
  summary: {
    problemContainerCount: number
    demurrageCount: number
    missedCutOffCount: number
    emptyReturnClosedCount: number
  }
}

export function ProblemContainersView({ problemContainersData, summary }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("Problem Container")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [csrFilter, setCsrFilter] = useState("")
  const [errorFilter, setErrorFilter] = useState("")

  // Categorize problems
  const categorizedProblems = useMemo(() => {
    const problemContainers: ProblemContainerWithHolds[] = []
    const demurrage: ProblemContainerWithHolds[] = []
    const missedCutOff: ProblemContainerWithHolds[] = []
    const emptyReturnClosed: ProblemContainerWithHolds[] = []

    problemContainersData.forEach((load) => {
      // Problem Container: any load with active holds
      if (
        load.freight_hold === "hold" ||
        load.terminal_hold === "hold" ||
        load.fees_hold === "hold"
      ) {
        problemContainers.push({ ...load, problemType: "problem" })
      }

      // Demurrage: loads where container's last_free_day < today and not completed
      if (load.containers?.last_free_day && new Date(load.containers.last_free_day) < new Date() && load.status !== "Completed") {
        demurrage.push({ ...load, problemType: "demurrage" })
      }

      // Missed Cut Off: export loads where cutoff has passed
      if (
        load.load_type === "Export" &&
        load.outgate_date &&
        new Date(load.outgate_date) < new Date() &&
        load.status !== "Completed"
      ) {
        missedCutOff.push({ ...load, problemType: "missed_cutoff" })
      }

      // Empty Return Closed: loads needing return but return location not accepting
      if (
        load.status === "Delivered" &&
        load.return_location &&
        load.load_type === "Import"
      ) {
        emptyReturnClosed.push({ ...load, problemType: "empty_return_closed" })
      }
    })

    return {
      problemContainers,
      demurrage,
      missedCutOff,
      emptyReturnClosed,
    }
  }, [problemContainersData])

  // Get current tab data
  const getTabData = (): ProblemContainerWithHolds[] => {
    switch (activeTab) {
      case "Problem Container":
        return categorizedProblems.problemContainers
      case "Demurrage":
        return categorizedProblems.demurrage
      case "Missed Cut Off":
        return categorizedProblems.missedCutOff
      case "Empty Return Closed":
        return categorizedProblems.emptyReturnClosed
      default:
        return []
    }
  }

  // Filter data
  const filteredData = useMemo(() => {
    const tabData = getTabData()
    return tabData.filter((load) => {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch =
        load.reference_number?.toLowerCase().includes(searchLower) ||
        load.containers?.container_number?.toLowerCase().includes(searchLower) ||
        load.customers?.name?.toLowerCase().includes(searchLower)

      const matchesCsr = !csrFilter || load.csr === csrFilter
      const matchesError = !errorFilter || (
        (errorFilter === "freight" && load.freight_hold === "hold") ||
        (errorFilter === "terminal" && load.terminal_hold === "hold") ||
        (errorFilter === "fees" && load.fees_hold === "hold") ||
        (errorFilter === "lfd" && load.containers?.last_free_day && new Date(load.containers.last_free_day) < new Date())
      )

      return matchesSearch && matchesCsr && matchesError
    })
  }, [searchTerm, csrFilter, errorFilter, activeTab])

  const getStatusColor = (status: string) => {
    const colors = LOAD_STATUS_COLORS[status as keyof typeof LOAD_STATUS_COLORS]
    return colors || { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" }
  }

  const isLFDOverdue = (lfdDate: string | null) => {
    if (!lfdDate) return false
    return new Date(lfdDate) < new Date()
  }

  const getErrorMessage = (load: ProblemContainerWithHolds): string[] => {
    const errors: string[] = []
    if (load.freight_hold === "hold") errors.push("Freight Hold")
    if (load.terminal_hold === "hold") errors.push("Terminal Hold")
    if (load.fees_hold === "hold") errors.push("Fees Hold")
    if (load.containers?.last_free_day && new Date(load.containers.last_free_day) < new Date()) {
      errors.push("LFD Overdue")
    }
    if (load.load_type === "Export" && load.outgate_date && new Date(load.outgate_date) < new Date()) {
      errors.push("Cutoff Missed")
    }
    return errors
  }

  const getHoldNotes = (load: ProblemContainerWithHolds): string => {
    const notes: string[] = []
    if (load.freight_hold === "hold" && load.freight_hold_note) notes.push(`Freight: ${load.freight_hold_note}`)
    if (load.terminal_hold === "hold" && load.terminal_hold_note) notes.push(`Terminal: ${load.terminal_hold_note}`)
    if (load.fees_hold === "hold" && load.fees_hold_note) notes.push(`Fees: ${load.fees_hold_note}`)
    return notes.join(" | ")
  }

  const tabs: TabType[] = [
    "Problem Container",
    "Demurrage",
    "Missed Cut Off",
    "Empty Return Closed",
  ]

  const tabCounts = {
    "Problem Container": summary.problemContainerCount,
    "Demurrage": summary.demurrageCount,
    "Missed Cut Off": summary.missedCutOffCount,
    "Empty Return Closed": summary.emptyReturnClosedCount,
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation with Counts */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              setSearchTerm("")
              setCsrFilter("")
              setErrorFilter("")
            }}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative flex items-center gap-2 ${
              activeTab === tab
                ? "text-white"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {tab}
            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E8700A]/20 text-[#FF8C21]">
              {tabCounts[tab]}
            </span>
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E8700A]" />
            )}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-white/5 rounded-lg p-4 space-y-3">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[250px] relative">
            <label className="block text-xs font-medium text-gray-400 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Load #, Container #, Customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0B1120] border border-white/5 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
              />
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-[#0B1120] border border-white/5 rounded-lg text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            More Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">CSR</label>
              <input
                type="text"
                placeholder="Filter by CSR..."
                value={csrFilter}
                onChange={(e) => setCsrFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B1120] border border-white/5 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Error Message</label>
              <select
                value={errorFilter}
                onChange={(e) => setErrorFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B1120] border border-white/5 rounded text-sm text-white focus:outline-none focus:border-[#E8700A]/50"
              >
                <option value="">All Errors</option>
                <option value="freight">Freight Hold</option>
                <option value="terminal">Terminal Hold</option>
                <option value="fees">Fees Hold</option>
                <option value="lfd">LFD Overdue</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0B1120] border-b border-white/5 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Load #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Container #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Reference #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Load Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Pick Up Apt</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">LFD/ERD</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">ETA</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Delivery Apt</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Per Diem Free Day</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Shipment #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">SSL</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">MBOL/BKG</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Chassis #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Total Weight</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Delivery Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Pick Up Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">Error Message</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((load, idx) => {
                const statusColor = getStatusColor(load.status)
                const lfdOverdue = isLFDOverdue(load.containers?.last_free_day || null)
                const errorMessages = getErrorMessage(load)

                return (
                  <tr
                    key={load.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/dispatcher/loads/${load.id}`}
                        className="text-[#FF8C21] hover:text-[#E8700A] font-medium"
                      >
                        {load.reference_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                        {load.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.drivers?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.containers?.container_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.containers?.bol_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.load_type || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.container_size || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.pickup_apt_from ? formatDate(load.pickup_apt_from) : "—"}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${lfdOverdue ? "text-[#E8700A]" : "text-gray-400"}`}>
                      {load.containers?.last_free_day
                        ? formatDate(load.containers.last_free_day)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.vessel_eta ? formatDate(load.vessel_eta) : "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.delivery_apt_from ? formatDate(load.delivery_apt_from) : "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.per_diem_free_day ? formatDate(load.per_diem_free_day) : "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.container_type || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.shipment_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.customers?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.ssl || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.mbol || load.house_bol || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.chassis_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.total_weight ? `${load.total_weight} lbs` : "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.delivery_location || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{load.pickup_location || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      {errorMessages.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {errorMessages.map((err, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {err}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && (
          <div className="px-4 py-12 text-center text-gray-500">
            No {activeTab} problems found
          </div>
        )}
      </div>
    </div>
  )
}
