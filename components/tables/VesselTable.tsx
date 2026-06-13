// components/tables/VesselTable.tsx
"use client"

import { useState, useMemo } from "react"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { exportToCSV, type ExportColumn, formatDateForExport } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"
import type { PhTerminalFilterOption } from "@/lib/terminals/phTerminalFilters"

type Vessel = {
  id: string
  name: string
  voyage_number: string
  /** Port Houston visit id (e.g. CHI-610E), searchable with name / voyage */
  visit_id?: string | null
  terminal: string
  eta: string | null
  ata: string | null
  etd: string | null
  berth: string | null
  shipping_line: string | null
  vesselStatus: string
  containerStats: {
    total: number
    available: number
    onVessel: number
    pickedUp: number
  }
}

export function VesselTable({
  vessels,
  terminalFilterOptions,
}: {
  vessels: Vessel[]
  /** From `terminals` + vessel codes — see `lib/terminals/phTerminalFilters.ts` */
  terminalFilterOptions: PhTerminalFilterOption[]
}) {
  const [search, setSearch] = useState("")
  const [terminalFilter, setTerminalFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [etaFrom, setEtaFrom] = useState("")
  const [etaTo, setEtaTo] = useState("")

  const filtered = useMemo(() => {
    return vessels.filter((v) => {
      const q = search.trim().toLowerCase()
      const visit = (v.visit_id ?? "").toLowerCase()
      const matchesSearch =
        q === "" ||
        v.name.toLowerCase().includes(q) ||
        (v.voyage_number?.toLowerCase().includes(q) ?? false) ||
        (v.shipping_line?.toLowerCase().includes(q) ?? false) ||
        (visit && visit.includes(q))

      const matchesTerminal = terminalFilter === "all" || v.terminal === terminalFilter
      const matchesStatus = statusFilter === "all" || v.vesselStatus === statusFilter

      const matchesEtaRange = matchesEtaWindow(v.eta, etaFrom, etaTo)

      return matchesSearch && matchesTerminal && matchesStatus && matchesEtaRange
    })
  }, [vessels, search, terminalFilter, statusFilter, etaFrom, etaTo])

  const sortGetValue = useMemo(() => ({
    vessel: (v: Vessel) => v.name,
    voyage: (v: Vessel) => v.voyage_number,
    line: (v: Vessel) => v.shipping_line ?? "",
    terminal: (v: Vessel) => v.terminal,
    eta: (v: Vessel) => v.eta ?? "",
    status: (v: Vessel) => v.vesselStatus,
    containers: (v: Vessel) => v.containerStats.total,
    available: (v: Vessel) => v.containerStats.available,
  }), [])

  const { sortedData, sortConfig, requestSort } = useTableSort(filtered, null, sortGetValue)

  const uniqueStatuses = [...new Set(vessels.map((v) => v.vesselStatus))]

  const vesselExportColumns: ExportColumn<Vessel>[] = [
    { header: "Vessel Name", accessor: (v) => v.name },
    { header: "Visit ID", accessor: (v) => v.visit_id ?? "" },
    { header: "Voyage #", accessor: (v) => v.voyage_number },
    { header: "Shipping Line", accessor: (v) => v.shipping_line },
    { header: "Terminal", accessor: (v) => v.terminal },
    { header: "Berth", accessor: (v) => v.berth },
    { header: "ETA", accessor: (v) => formatDateForExport(v.eta) },
    { header: "ATA", accessor: (v) => formatDateForExport(v.ata) },
    { header: "ETD", accessor: (v) => formatDateForExport(v.etd) },
    { header: "Status", accessor: (v) => v.vesselStatus },
    { header: "Total Containers", accessor: (v) => v.containerStats.total },
    { header: "Available", accessor: (v) => v.containerStats.available },
    { header: "On Vessel", accessor: (v) => v.containerStats.onVessel },
    { header: "Picked Up", accessor: (v) => v.containerStats.pickedUp },
  ]

  const handleExportVessels = () => {
    exportToCSV("vessels", vesselExportColumns, sortedData)
  }

  return (
    <div>
      {/* Filters */}
      <div className="px-6 py-3 flex flex-col gap-3 border-b border-white/5">
        <div className="flex flex-col lg:flex-row lg:flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search vessel, voyage, visit ID, or line…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
            />
          </div>

          {/* Terminal Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium whitespace-nowrap">Terminals</span>
            <select
              value={terminalFilter}
              onChange={(e) => setTerminalFilter(e.target.value)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none cursor-pointer min-w-[10rem]"
            >
              <option value="all" className="bg-[#111827]">All Terminals</option>
              {terminalFilterOptions.map((o) => (
                <option key={o.code} value={o.code} className="bg-[#111827]">
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none cursor-pointer min-w-[9rem]"
          >
            <option value="all" className="bg-[#111827]">All Statuses</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s} className="bg-[#111827]">{s}</option>
            ))}
          </select>

          <ExportButton onClick={handleExportVessels} count={sortedData.length} />
        </div>

        {/* ETA range (spec: terminal + date range) */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span className="font-medium whitespace-nowrap">ETA</span>
          <input
            type="date"
            value={etaFrom}
            onChange={(e) => setEtaFrom(e.target.value)}
            className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
            aria-label="ETA from"
          />
          <span className="text-gray-600">—</span>
          <input
            type="date"
            value={etaTo}
            onChange={(e) => setEtaTo(e.target.value)}
            className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
            aria-label="ETA to"
          />
          {(etaFrom || etaTo) && (
            <button
              type="button"
              onClick={() => { setEtaFrom(""); setEtaTo("") }}
              className="ml-1 text-[#E8700A] hover:underline"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-white/5">
              <SortableHeader label="Vessel" sortKey="vessel" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Voyage" sortKey="voyage" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Line" sortKey="line" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Terminal" sortKey="terminal" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="ETA" sortKey="eta" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Status" sortKey="status" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Containers" sortKey="containers" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6 text-center" />
              <SortableHeader label="Available" sortKey="available" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6 text-center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedData.map((vessel) => (
              <VesselRow key={vessel.id} vessel={vessel} />
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                  {search.trim() || terminalFilter !== "all" || statusFilter !== "all" || etaFrom || etaTo
                    ? "No vessels match your filters"
                    : "No vessels scheduled"
                  }
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Showing {filtered.length} of {vessels.length} vessels
        </p>
        <p className="text-xs text-gray-500">
          Last synced: {new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  )
}

function VesselRow({ vessel }: { vessel: Vessel }) {
  const statusStyles: Record<string, string> = {
    "En Route": "bg-blue-500/10 text-blue-400",
    "Arriving Today": "bg-[#E8700A]/15 text-[#FF8C21]",
    "Arriving": "bg-amber-500/10 text-amber-400",
    "At Berth": "bg-emerald-500/10 text-emerald-400",
    "Scheduled": "bg-gray-500/10 text-gray-400",
  }

  const etaDisplay = formatEta(vessel.eta)
  const countdown = getCountdown(vessel.eta)

  return (
    <tr className="hover:bg-white/[0.02] transition-colors group">
      <td className="px-6 py-3.5">
        <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{vessel.name}</p>
      </td>
      <td className="px-6 py-3.5">
        <p className="text-sm text-gray-400 font-mono text-xs">{vessel.voyage_number || "—"}</p>
      </td>
      <td className="px-6 py-3.5">
        <p className="text-sm text-gray-400">{vessel.shipping_line || "—"}</p>
      </td>
      <td className="px-6 py-3.5">
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#E8700A]/15 text-[#E8700A]">
          {vessel.terminal}
        </span>
      </td>
      <td className="px-6 py-3.5">
        <p className="text-sm text-gray-300">{etaDisplay}</p>
        {countdown && (
          <p className="text-[11px] text-gray-500 mt-0.5">{countdown}</p>
        )}
      </td>
      <td className="px-6 py-3.5">
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[vessel.vesselStatus] || statusStyles["Scheduled"]}`}>
          {vessel.vesselStatus}
        </span>
      </td>
      <td className="px-6 py-3.5 text-center">
        <span className="text-sm font-semibold text-white">{vessel.containerStats.total}</span>
        {vessel.containerStats.onVessel > 0 && (
          <p className="text-[11px] text-gray-500">{vessel.containerStats.onVessel} on vessel</p>
        )}
      </td>
      <td className="px-6 py-3.5 text-center">
        {vessel.containerStats.available > 0 ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
            {vessel.containerStats.available} ready
          </span>
        ) : (
          <span className="text-xs text-gray-500">—</span>
        )}
      </td>
    </tr>
  )
}

/** Local calendar day bounds for `<input type="date">` values (YYYY-MM-DD). */
function matchesEtaWindow(eta: string | null, fromYmd: string, toYmd: string): boolean {
  if (!fromYmd && !toYmd) return true
  if (!eta) return false
  const t = new Date(eta).getTime()
  if (fromYmd) {
    const [y, m, d] = fromYmd.split("-").map(Number)
    if (t < new Date(y, m - 1, d, 0, 0, 0, 0).getTime()) return false
  }
  if (toYmd) {
    const [y, m, d] = toYmd.split("-").map(Number)
    if (t > new Date(y, m - 1, d, 23, 59, 59, 999).getTime()) return false
  }
  return true
}

function formatEta(eta: string | null) {
  if (!eta) return "TBD"
  const date = new Date(eta)
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  const dayStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  if (date.toDateString() === now.toDateString()) return `Today, ${time}`
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`
  return `${dayStr}, ${time}`
}

function getCountdown(eta: string | null) {
  if (!eta) return null
  const date = new Date(eta)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()

  if (diffMs < 0) return "Arrived"

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 48) {
    const days = Math.ceil(hours / 24)
    return `in ${days} days`
  }
  if (hours > 0) return `in ${hours}h ${minutes}m`
  return `in ${minutes}m`
}
