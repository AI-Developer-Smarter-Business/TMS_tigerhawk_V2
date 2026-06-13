// components/portal/PortalLoadsTable.tsx
"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { PortalLoad } from "@/types/portal"
import { formatDate } from "@/lib/utils"
import { exportToCSV, type ExportColumn, formatDateForExport, formatDateTimeForExport } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

type Props = {
  loads: PortalLoad[]
  showDateColumn?: "updated" | "completed"
}

export function PortalLoadsTable({ loads, showDateColumn = "updated" }: Props) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [typeFilter, setTypeFilter] = useState("All")

  // Extract unique statuses and types for filters
  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    loads.forEach((l) => { if (l.status) set.add(l.status) })
    return Array.from(set).sort()
  }, [loads])

  const typeOptions = useMemo(() => {
    const set = new Set<string>()
    loads.forEach((l) => { if (l.load_type) set.add(l.load_type) })
    return Array.from(set).sort()
  }, [loads])

  const filteredLoads = useMemo(() => {
    return loads.filter((load) => {
      // Status filter
      if (statusFilter !== "All" && load.status !== statusFilter) return false
      // Type filter
      if (typeFilter !== "All" && load.load_type !== typeFilter) return false
      // Search
      if (!search) return true
      const s = search.toLowerCase()
      return (
        load.reference_number?.toLowerCase().includes(s) ||
        load.containers?.container_number?.toLowerCase().includes(s) ||
        load.delivery_location?.toLowerCase().includes(s) ||
        load.pickup_location?.toLowerCase().includes(s) ||
        (load.ssl || load.containers?.shipping_line || "").toLowerCase().includes(s) ||
        load.shipment_number?.toLowerCase().includes(s)
      )
    })
  }, [loads, search, statusFilter, typeFilter])

  const getStatusColor = (status: string) => {
    const colors = LOAD_STATUS_COLORS[status as keyof typeof LOAD_STATUS_COLORS]
    return colors || { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" }
  }

  const getContainerSize = (load: PortalLoad) => load.container_size || load.containers?.size || ""
  const getSSL = (load: PortalLoad) => load.ssl || load.containers?.shipping_line || ""

  const portalLoadExportColumns: ExportColumn<PortalLoad>[] = [
    { header: "Load #", accessor: (l) => l.reference_number },
    { header: "Status", accessor: (l) => l.status },
    { header: "Type", accessor: (l) => l.load_type },
    { header: "Container #", accessor: (l) => l.container_number || l.containers?.container_number },
    { header: "Size", accessor: (l) => getContainerSize(l) },
    { header: "SSL", accessor: (l) => getSSL(l) },
    { header: "Pickup Location", accessor: (l) => l.pickup_location },
    { header: "Delivery Location", accessor: (l) => l.delivery_location },
    { header: "Last Free Day", accessor: (l) => formatDateForExport(l.containers?.last_free_day) },
    { header: "Pickup Apt", accessor: (l) => formatDateTimeForExport(l.pickup_apt_from) },
    { header: "Delivery Apt", accessor: (l) => formatDateTimeForExport(l.delivery_apt_from) },
    { header: "Vessel ETA", accessor: (l) => formatDateForExport(l.vessel_eta) },
    { header: "Created", accessor: (l) => formatDateForExport(l.created_at) },
    { header: "Updated", accessor: (l) => formatDateForExport(l.updated_at) },
  ]

  const handleExportPortalLoads = () => {
    exportToCSV("portal-loads", portalLoadExportColumns, filteredLoads)
  }

  const isLFDOverdue = (date: string | null) => {
    if (!date) return false
    return new Date(date) < new Date()
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by load #, container, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#0B1120] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B1120] border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#E8700A]/50"
        >
          <option value="All">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B1120] border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#E8700A]/50"
        >
          <option value="All">All Types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <ExportButton onClick={handleExportPortalLoads} count={filteredLoads.length} />
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500">
        Showing {filteredLoads.length} of {loads.length} loads
      </p>

      {/* Table */}
      <div className="bg-[#141922] border border-[#1e2530] rounded-xl overflow-hidden">
        {filteredLoads.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            No loads found
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="divide-y divide-[#1e2530]/60 sm:hidden">
              {filteredLoads.map((load) => {
                const statusColor = getStatusColor(load.status)
                const lfd = load.containers?.last_free_day || null
                const lfdOverdue = isLFDOverdue(lfd)
                const size = getContainerSize(load)
                const dateValue =
                  showDateColumn === "completed"
                    ? load.actual_delivery || load.updated_at
                    : load.updated_at

                return (
                  <Link
                    key={load.id}
                    href={`/portal/loads/${load.id}`}
                    className="block px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[#FF8C21]">
                        {load.reference_number}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text}`}
                      >
                        {load.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                      {load.containers?.container_number && (
                        <span className="text-gray-300">{load.containers.container_number}</span>
                      )}
                      {load.load_type && <span>{load.load_type}</span>}
                      {getSSL(load) && <span>{getSSL(load)}</span>}
                      {size && <span>{size}&apos;</span>}
                    </div>
                    {(load.pickup_location || load.delivery_location) && (
                      <p className="text-[11px] text-gray-500 mt-1.5 truncate">
                        {load.pickup_location || "—"} → {load.delivery_location || "—"}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[10px] text-gray-600">
                      {load.vessel_eta && <span>ETA: {formatDate(load.vessel_eta)}</span>}
                      {lfd && (
                        <span className={lfdOverdue ? "text-orange-400 font-medium" : ""}>
                          LFD: {formatDate(lfd)}
                        </span>
                      )}
                      {dateValue && (
                        <span>
                          {showDateColumn === "completed" ? "Completed" : "Updated"}: {formatDate(dateValue)}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Desktop table layout */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Load #</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Status</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Container #</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Type</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">SSL</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Size</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Pickup</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Delivery</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">ETA</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">LFD</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">
                      {showDateColumn === "completed" ? "Completed" : "Updated"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoads.map((load) => {
                    const statusColor = getStatusColor(load.status)
                    const lfd = load.containers?.last_free_day || null
                    const lfdOverdue = isLFDOverdue(lfd)
                    const size = getContainerSize(load)

                    return (
                      <tr
                        key={load.id}
                        className="border-b border-[#1e2530]/60 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/portal/loads/${load.id}`}
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
                        <td className="px-4 py-3 text-gray-300">
                          {load.containers?.container_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{load.load_type || "—"}</td>
                        <td className="px-4 py-3 text-gray-400">{getSSL(load) || "—"}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {size ? `${size}'` : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[140px]">
                          {load.pickup_location || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[140px]">
                          {load.delivery_location || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {load.vessel_eta ? formatDate(load.vessel_eta) : "—"}
                        </td>
                        <td className={`px-4 py-3 text-xs font-medium ${lfdOverdue ? "text-orange-400" : "text-gray-400"}`}>
                          {lfd ? formatDate(lfd) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {showDateColumn === "completed"
                            ? load.actual_delivery
                              ? formatDate(load.actual_delivery)
                              : load.updated_at
                                ? formatDate(load.updated_at)
                                : "—"
                            : load.updated_at
                              ? formatDate(load.updated_at)
                              : "—"
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
