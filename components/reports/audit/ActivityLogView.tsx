"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, subDays } from "date-fns"
import { Search, ChevronLeft, ChevronRight, RefreshCw, FileText } from "lucide-react"

interface ActivityLog {
  id: string
  entity_type: string
  entity_id: string
  action: string
  user_id: string
  user_email: string
  details: Record<string, unknown>
  created_at: string
  updated_at: string
}

const PAGE_SIZE = 50

// Color-coded badges by action type
const actionColors: Record<string, string> = {
  created: "bg-green-900/40 text-green-300 border-green-700/50",
  updated: "bg-blue-900/40 text-blue-300 border-blue-700/50",
  deleted: "bg-red-900/40 text-red-300 border-red-700/50",
  password_changed: "bg-yellow-900/40 text-yellow-300 border-yellow-700/50",
}

// Friendly labels for entity types
const entityLabels: Record<string, string> = {
  shipment: "Shipment",
  load: "Load",
  driver: "Driver",
  driver_document: "Driver Doc",
  truck: "Truck",
  chassis: "Chassis",
  rate_profile: "Rate Profile",
  rate_profile_lane: "Rate Lane",
  rate_profile_charge: "Rate Charge",
  rate_profile_condition: "Rate Condition",
  lane_origin: "Lane Origin",
  ar_invoice: "AR Invoice",
  ar_payment: "AR Payment",
  ap_deduction: "AP Deduction",
  ap_expense: "AP Expense",
  settlement: "Settlement",
  user_account: "User Account",
  chassis_audit: "Chassis Audit",
}

function getEntityLabel(type: string): string {
  return entityLabels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
}

function formatDetails(details: Record<string, unknown>): string {
  if (!details) return ""
  // Show key details in a readable format, excluding _by fields since we show user separately
  const excluded = ["created_by", "updated_by", "deleted_by", "changed_by"]
  const entries = Object.entries(details)
    .filter(([key]) => !excluded.includes(key))
    .map(([key, value]) => {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
      if (Array.isArray(value)) return `${label}: ${value.join(", ")}`
      if (typeof value === "object" && value !== null) return `${label}: ${JSON.stringify(value)}`
      return `${label}: ${value}`
    })
  return entries.join(" · ")
}

export function ActivityLogView() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [total, setTotal] = useState(0)
  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [actions, setActions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 365), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [errorMsg, setErrorMsg] = useState("")

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (entityTypeFilter) params.set("entity_type", entityTypeFilter)
      if (actionFilter) params.set("action", actionFilter)
      if (startDate) params.set("start_date", startDate)
      if (endDate) params.set("end_date", endDate)
      if (searchTerm.trim()) params.set("search", searchTerm.trim())
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(page * PAGE_SIZE))

      const res = await fetch(`/api/activity-log?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs || [])
        setTotal(data.total || 0)
        if (data.entityTypes) setEntityTypes(data.entityTypes)
        if (data.actions) setActions(data.actions)
        setErrorMsg("")
      } else {
        console.error("Activity log API error:", data)
        setErrorMsg(data.error || `API returned ${res.status}`)
        setLogs([])
        setTotal(0)
      }
    } catch (err) {
      console.error("Failed to fetch activity logs:", err)
      setErrorMsg(String(err))
    } finally {
      setLoading(false)
    }
  }, [entityTypeFilter, actionFilter, startDate, endDate, searchTerm, page])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleFilterChange = () => {
    setPage(0)
  }

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {errorMsg && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-300">
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Activity Log</h1>
          <p className="text-sm text-gray-400 mt-1">
            System-wide audit trail of all user actions
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-[#1a2236] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-white/20 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Date range */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); handleFilterChange() }}
              className="w-full bg-[#1a2236] border border-white/10 rounded px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); handleFilterChange() }}
              className="w-full bg-[#1a2236] border border-white/10 rounded px-3 py-1.5 text-sm text-white"
            />
          </div>

          {/* Entity type filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Entity Type</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => { setEntityTypeFilter(e.target.value); handleFilterChange() }}
              className="w-full bg-[#1a2236] border border-white/10 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="">All Types</option>
              {entityTypes.map((et) => (
                <option key={et} value={et}>{getEntityLabel(et)}</option>
              ))}
            </select>
          </div>

          {/* Action filter */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); handleFilterChange() }}
              className="w-full bg-[#1a2236] border border-white/10 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="">All Actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); handleFilterChange() }}
                placeholder="Name, email, ID..."
                className="w-full bg-[#1a2236] border border-white/10 rounded pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{total.toLocaleString()} record{total !== 1 ? "s" : ""} found</span>
        {totalPages > 1 && (
          <span>Page {page + 1} of {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                    Loading activity logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <FileText size={20} className="mx-auto mb-2 opacity-50" />
                    No activity logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      <div className="text-xs">
                        {format(parseISO(log.created_at), "MMM d, yyyy")}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {format(parseISO(log.created_at), "h:mm:ss a")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">
                      {log.user_email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${actionColors[log.action] || "bg-gray-900/40 text-gray-300 border-gray-700/50"}`}>
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-300">{getEntityLabel(log.entity_type)}</div>
                      <div className="text-[10px] text-gray-500 font-mono truncate max-w-[140px]" title={log.entity_id}>
                        {log.entity_id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[400px]">
                      <div className="truncate" title={formatDetails(log.details)}>
                        {formatDetails(log.details)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-[#1a2236] border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-sm text-gray-400 px-3">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded bg-[#1a2236] border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
