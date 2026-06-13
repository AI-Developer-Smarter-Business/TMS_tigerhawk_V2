// components/tables/ContainerTable.tsx
"use client"

import { useState, useMemo } from "react"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { exportToCSV, type ExportColumn, formatDateForExport } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

type Container = {
  id: string
  container_number: string
  bol_number: string | null
  booking_number: string | null
  size: string | null
  type: string | null
  status: string
  available_date: string | null
  last_free_day: string | null
  appointment_id: string | null
  appointment_time: string | null
  weight_lbs: number | null
  seal_number: string | null
  notes: string | null
  demurrageDays: number | null
  demurrageStatus: "safe" | "warning" | "critical" | "overdue" | null
  vessels: {
    name: string
    terminal: string
    eta: string | null
    shipping_line: string | null
  } | null
}

import type { PhTerminalFilterOption } from "@/lib/terminals/phTerminalFilters"

export function ContainerTable({
  containers,
  terminalFilterOptions,
}: {
  containers: Container[]
  terminalFilterOptions: PhTerminalFilterOption[]
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [terminalFilter, setTerminalFilter] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return containers.filter((c) => {
      const matchesSearch =
        search === "" ||
        c.container_number.toLowerCase().includes(search.toLowerCase()) ||
        c.bol_number?.toLowerCase().includes(search.toLowerCase()) ||
        c.booking_number?.toLowerCase().includes(search.toLowerCase()) ||
        c.vessels?.name.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === "all" || c.status === statusFilter ||
        (statusFilter === "demurrage" && (c.demurrageStatus === "warning" || c.demurrageStatus === "critical" || c.demurrageStatus === "overdue"))

      const matchesTerminal = terminalFilter === "all" || c.vessels?.terminal === terminalFilter

      return matchesSearch && matchesStatus && matchesTerminal
    })
  }, [containers, search, statusFilter, terminalFilter])

  const sortGetValue = useMemo(() => ({
    container: (c: Container) => c.container_number,
    bol: (c: Container) => c.bol_number ?? "",
    vessel: (c: Container) => c.vessels?.name ?? "",
    sizeType: (c: Container) => c.size ?? "",
    status: (c: Container) => c.status,
    demurrage: (c: Container) => c.demurrageDays ?? 999,
    appointment: (c: Container) => c.appointment_id ?? "",
  }), [])

  const { sortedData, sortConfig, requestSort } = useTableSort(filtered, null, sortGetValue)

  const containerExportColumns: ExportColumn<Container>[] = [
    { header: "Container #", accessor: (c) => c.container_number },
    { header: "BOL #", accessor: (c) => c.bol_number },
    { header: "Booking #", accessor: (c) => c.booking_number },
    { header: "Size", accessor: (c) => c.size },
    { header: "Type", accessor: (c) => c.type },
    { header: "Status", accessor: (c) => c.status },
    { header: "Vessel", accessor: (c) => c.vessels?.name },
    { header: "Terminal", accessor: (c) => c.vessels?.terminal },
    { header: "Shipping Line", accessor: (c) => c.vessels?.shipping_line },
    { header: "ETA", accessor: (c) => formatDateForExport(c.vessels?.eta) },
    { header: "Available Date", accessor: (c) => formatDateForExport(c.available_date) },
    { header: "Last Free Day", accessor: (c) => formatDateForExport(c.last_free_day) },
    { header: "Demurrage Days", accessor: (c) => c.demurrageDays },
    { header: "Demurrage Status", accessor: (c) => c.demurrageStatus },
    { header: "Appointment", accessor: (c) => c.appointment_id ? "Yes" : "No" },
    { header: "Weight (lbs)", accessor: (c) => c.weight_lbs },
    { header: "Seal #", accessor: (c) => c.seal_number },
    { header: "Notes", accessor: (c) => c.notes },
  ]

  const handleExportContainers = () => {
    exportToCSV("containers", containerExportColumns, sortedData)
  }

  return (
    <div>
      {/* Filters */}
      <div className="px-6 py-3 flex flex-col sm:flex-row gap-3 border-b border-white/5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search container #, BOL, booking, or vessel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none cursor-pointer"
        >
          <option value="all" className="bg-[#111827]">All Statuses</option>
          <option value="On Vessel" className="bg-[#111827]">On Vessel</option>
          <option value="In Transit" className="bg-[#111827]">In Transit</option>
          <option value="Available" className="bg-[#111827]">Available</option>
          <option value="Released" className="bg-[#111827]">Released</option>
          <option value="Picked Up" className="bg-[#111827]">Picked Up</option>
          <option value="demurrage" className="bg-[#111827]">Demurrage Alert</option>
        </select>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Terminals</span>
          <select
            value={terminalFilter}
            onChange={(e) => setTerminalFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none cursor-pointer"
          >
            <option value="all" className="bg-[#111827]">All Terminals</option>
            {terminalFilterOptions.map((o) => (
              <option key={o.code} value={o.code} className="bg-[#111827]">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <ExportButton onClick={handleExportContainers} count={sortedData.length} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-white/5">
              <th className="px-6 py-3 w-8"></th>
              <SortableHeader label="Container" sortKey="container" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="BOL" sortKey="bol" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Vessel" sortKey="vessel" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Size/Type" sortKey="sizeType" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Status" sortKey="status" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Demurrage" sortKey="demurrage" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Appointment" sortKey="appointment" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedData.map((container) => (
              <ContainerRow
                key={container.id}
                container={container}
                expanded={expandedId === container.id}
                onToggle={() => setExpandedId(expandedId === container.id ? null : container.id)}
              />
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                  {search || statusFilter !== "all" || terminalFilter !== "all"
                    ? "No containers match your filters"
                    : "No containers tracked"
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
          Showing {filtered.length} of {containers.length} containers
        </p>
      </div>
    </div>
  )
}

function ContainerRow({
  container,
  expanded,
  onToggle,
}: {
  container: Container
  expanded: boolean
  onToggle: () => void
}) {
  const statusStyles: Record<string, string> = {
    "On Vessel": "bg-blue-500/10 text-blue-400",
    "In Transit": "bg-[#E8700A]/15 text-[#FF8C21]",
    "Available": "bg-emerald-500/10 text-emerald-400",
    "Released": "bg-purple-500/10 text-purple-400",
    "Picked Up": "bg-gray-500/10 text-gray-400",
    "Returned": "bg-gray-500/10 text-gray-400",
  }

  const demurrageStyles: Record<string, string> = {
    safe: "text-emerald-400",
    warning: "text-amber-400",
    critical: "text-red-400",
    overdue: "text-red-500 font-bold",
  }

  return (
    <>
      <tr
        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
        onClick={onToggle}
      >
        <td className="px-6 py-3.5">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </td>
        <td className="px-6 py-3.5">
          <p className="text-sm font-mono font-medium text-gray-200 group-hover:text-white">{container.container_number}</p>
        </td>
        <td className="px-6 py-3.5">
          <p className="text-sm text-gray-400 font-mono text-xs">{container.bol_number || "—"}</p>
        </td>
        <td className="px-6 py-3.5">
          {container.vessels ? (
            <div>
              <p className="text-sm text-gray-300">{container.vessels.name}</p>
              <p className="text-[11px] text-gray-500">{container.vessels.shipping_line} &middot; {container.vessels.terminal}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">—</p>
          )}
        </td>
        <td className="px-6 py-3.5">
          <span className="text-sm text-gray-400">
            {container.size ? `${container.size}'` : "—"} {container.type || ""}
          </span>
        </td>
        <td className="px-6 py-3.5">
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[container.status] || "bg-gray-500/10 text-gray-400"}`}>
            {container.status}
          </span>
        </td>
        <td className="px-6 py-3.5">
          {container.demurrageDays !== null ? (
            <DemurrageDisplay days={container.demurrageDays} status={container.demurrageStatus!} />
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )}
        </td>
        <td className="px-6 py-3.5">
          {container.appointment_id ? (
            <div>
              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                PIN: {container.appointment_id}
              </span>
            </div>
          ) : container.status === "Available" ? (
            <button className="px-3 py-1 rounded-lg text-xs font-medium bg-[#E8700A]/15 text-[#E8700A] hover:bg-[#E8700A]/25 transition-colors">
              Book Appt
            </button>
          ) : (
            <span className="text-xs text-gray-500">—</span>
          )}
        </td>
      </tr>

      {/* Expanded Detail Row */}
      {expanded && (
        <tr className="bg-white/[0.01]">
          <td colSpan={8} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 ml-10">
              <DetailItem label="Container #" value={container.container_number} />
              <DetailItem label="BOL" value={container.bol_number || "—"} />
              <DetailItem label="Booking" value={container.booking_number || "—"} />
              <DetailItem label="Seal #" value={container.seal_number || "—"} />
              <DetailItem label="Size" value={container.size ? `${container.size}' ${container.type || "STD"}` : "—"} />
              <DetailItem label="Weight" value={container.weight_lbs ? `${container.weight_lbs.toLocaleString()} lbs` : "—"} />
              <DetailItem label="Available Date" value={container.available_date ? formatDate(container.available_date) : "—"} />
              <DetailItem label="Last Free Day" value={container.last_free_day ? formatDate(container.last_free_day) : "—"} />
              <DetailItem
                label="Vessel"
                value={container.vessels ? `${container.vessels.name} (${container.vessels.terminal})` : "—"}
              />
              <DetailItem
                label="Vessel ETA"
                value={container.vessels?.eta ? formatDate(container.vessels.eta) : "—"}
              />
              <DetailItem label="Appointment" value={container.appointment_id ? `PIN: ${container.appointment_id}` : "Not booked"} />
              <DetailItem
                label="Appt Time"
                value={container.appointment_time ? formatDate(container.appointment_time) : "—"}
              />
              {container.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-300">{container.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function DemurrageDisplay({ days, status }: { days: number; status: string }) {
  const styles: Record<string, { text: string; bg: string }> = {
    safe: { text: "text-emerald-400", bg: "bg-emerald-500/10" },
    warning: { text: "text-amber-400", bg: "bg-amber-500/10" },
    critical: { text: "text-red-400", bg: "bg-red-500/10" },
    overdue: { text: "text-red-500", bg: "bg-red-500/15" },
  }

  const s = styles[status] || styles.safe

  if (status === "overdue") {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
          {Math.abs(days)}d OVERDUE
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {days}d left
      </span>
      {status === "critical" && (
        <svg className="w-3.5 h-3.5 text-red-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      )}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-300 mt-0.5">{value}</p>
    </div>
  )
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
