"use client"

import { useState, useCallback, useEffect } from "react"
import { ChevronLeft, ChevronRight, Trash2, Calendar, Loader2, Plus, Zap, CheckCheck } from "lucide-react"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { useRouter } from "next/navigation"
import { SearchableSelect } from "@/components/ui/SearchableSelect"
import { AddDeductionModal, GenerateDeductionsModal } from "./modals/DeductionModals"

const formatCurrency = (amount: number) => `$${(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface DeductionRecord {
  id: string
  driver_id: string
  deduction_type: string
  description: string
  unit_of_measure: string
  math_operation: string
  amount: number
  final_amount: number
  deduction_date: string | null
  created_at: string
  status: "Unapproved" | "Approved" | "Settled"
  drivers?: {
    id: string
    name: string
    phone: string
  } | null
}

interface Driver {
  id: string
  name: string
}

interface Stats {
  unapproved: { count: number; amount: number }
  approved: { count: number; amount: number }
  settled: { count: number; amount: number }
}

interface DeductionsViewProps {
  initialData: DeductionRecord[]
  drivers: Driver[]
  stats: Stats
  initialStartDate: Date
  initialEndDate: Date
}

const DEDUCTION_TYPES = [
  "Fuel",
  "Escrow",
  "Equipment Rental (Samsara)",
  "Liability Insurance",
  "Cargo Insurance",
  "Plate Rental",
  "Truck Payment",
]

const UNIT_OF_MEASURES = ["Flat Amount", "Percentage", "Per Mile"]
const MATH_OPERATIONS = ["Subtract", "Add"]

export function DeductionsView({
  initialData,
  drivers,
  stats,
  initialStartDate,
  initialEndDate,
}: DeductionsViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [selectedDriver, setSelectedDriver] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [data, setData] = useState(initialData)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set())

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  // Sync state when server-side data changes
  useEffect(() => { setData(initialData) }, [initialData])
  useEffect(() => { setStartDate(initialStartDate) }, [initialStartDate])
  useEffect(() => { setEndDate(initialEndDate) }, [initialEndDate])

  // ─── Week navigation (Sun-Sat) ─────────────────────────
  const handlePreviousWeek = () => {
    const prev = addWeeks(startDate, -1)
    const newStart = startOfWeek(prev, { weekStartsOn: 0 })
    const newEnd = endOfWeek(prev, { weekStartsOn: 0 })
    setStartDate(newStart)
    setEndDate(newEnd)
    updateURL(newStart, newEnd)
  }

  const handleNextWeek = () => {
    const next = addWeeks(startDate, 1)
    const newStart = startOfWeek(next, { weekStartsOn: 0 })
    const newEnd = endOfWeek(next, { weekStartsOn: 0 })
    setStartDate(newStart)
    setEndDate(newEnd)
    updateURL(newStart, newEnd)
  }

  const updateURL = (start: Date, end: Date) => {
    const query = new URLSearchParams({
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    })
    router.push(`/dashboard/accounts-payable/deductions?${query.toString()}`)
  }

  // ─── Toggle Approved ↔ Unapproved ──────────────────────
  const handleToggleStatus = useCallback(async (record: DeductionRecord) => {
    const newStatus = record.status === "Approved" ? "Unapproved" : "Approved"
    // Don't allow toggling records that are already Settled
    if (record.status === "Settled") return

    setTogglingIds((prev) => new Set(prev).add(record.id))
    try {
      const response = await fetch(`/api/accounts-payable/deductions/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        setData((prev) =>
          prev.map((r) => (r.id === record.id ? { ...r, status: newStatus as DeductionRecord["status"] } : r))
        )
        router.refresh()
      } else {
        const err = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("Failed to toggle status:", err)
        alert(`Failed to update status: ${err.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error toggling deduction status:", error)
      alert("Network error toggling status")
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(record.id)
        return next
      })
    }
  }, [router])

  // ─── Bulk approve selected ─────────────────────────────
  const handleBulkApprove = useCallback(async () => {
    const idsToApprove = Array.from(selectedRows).filter((id) => {
      const record = data.find((d) => d.id === id)
      return record && record.status === "Unapproved"
    })

    if (idsToApprove.length === 0) {
      alert("No unapproved deductions selected")
      return
    }

    if (!confirm(`Approve ${idsToApprove.length} deduction(s)?`)) return

    setTogglingIds(new Set(idsToApprove))

    try {
      const results = await Promise.allSettled(
        idsToApprove.map((id) =>
          fetch(`/api/accounts-payable/deductions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Approved" }),
          })
        )
      )

      const successIds = idsToApprove.filter((_, i) => results[i].status === "fulfilled" && (results[i] as PromiseFulfilledResult<Response>).value.ok)

      if (successIds.length === 0) {
        alert("No deductions could be approved. Check permissions or try again.")
      } else if (successIds.length < idsToApprove.length) {
        alert(`${successIds.length} approved, ${idsToApprove.length - successIds.length} failed`)
      }

      setData((prev) =>
        prev.map((r) =>
          successIds.includes(r.id) ? { ...r, status: "Approved" as const } : r
        )
      )
      setSelectedRows(new Set())
      router.refresh()
    } catch (error) {
      console.error("Error in bulk approve:", error)
      alert("Network error during bulk approve")
    } finally {
      setTogglingIds(new Set())
    }
  }, [selectedRows, data, router])

  // ─── Filtering (computed before handlers that reference it) ─
  const filteredData = data.filter((record) => {
    if (selectedDriver !== "all" && record.driver_id !== selectedDriver) return false
    if (selectedType !== "all" && record.deduction_type !== selectedType) return false
    if (filterStatuses.size > 0 && !filterStatuses.has(record.status)) return false
    return true
  })

  // ─── Approve all visible unapproved ───────────────────
  const [approvingAll, setApprovingAll] = useState(false)

  const visibleUnapprovedCount = filteredData.filter((d) => d.status === "Unapproved").length

  const handleApproveAllVisible = useCallback(async () => {
    const unapprovedVisible = filteredData.filter((d) => d.status === "Unapproved")

    if (unapprovedVisible.length === 0) {
      alert("No unapproved deductions visible to approve")
      return
    }

    if (!confirm(`Approve all ${unapprovedVisible.length} visible unapproved deduction(s)?`)) return

    setApprovingAll(true)
    const idsToApprove = unapprovedVisible.map((d) => d.id)
    setTogglingIds(new Set(idsToApprove))

    try {
      const results = await Promise.allSettled(
        idsToApprove.map((id) =>
          fetch(`/api/accounts-payable/deductions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Approved" }),
          })
        )
      )

      const successIds = idsToApprove.filter(
        (_, i) =>
          results[i].status === "fulfilled" &&
          (results[i] as PromiseFulfilledResult<Response>).value.ok
      )

      if (successIds.length < idsToApprove.length) {
        const failCount = idsToApprove.length - successIds.length
        alert(`${successIds.length} approved, ${failCount} failed`)
      }

      setData((prev) =>
        prev.map((r) =>
          successIds.includes(r.id) ? { ...r, status: "Approved" as const } : r
        )
      )
      setSelectedRows(new Set())
      router.refresh()
    } catch (error) {
      console.error("Error in approve all visible:", error)
      alert("Network error approving deductions")
    } finally {
      setApprovingAll(false)
      setTogglingIds(new Set())
    }
  }, [filteredData, router])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deduction?")) return

    try {
      const response = await fetch(`/api/accounts-payable/deductions/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setData((prev) => prev.filter((record) => record.id !== id))
        router.refresh()
      } else {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        alert(err.error || "Failed to delete deduction")
      }
    } catch (error) {
      console.error("Error deleting deduction:", error)
      alert("Network error while deleting deduction")
    }
  }

  const handleEdit = async (id: string, field: string, value: unknown) => {
    try {
      const response = await fetch(`/api/accounts-payable/deductions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })

      if (response.ok) {
        const patch: Record<string, unknown> = { [field]: value }
        if (field === "amount" && typeof value === "number") {
          patch.final_amount = value
        }
        setData((prev) =>
          prev.map((d) =>
            d.id === id ? { ...d, ...patch } as DeductionRecord : d
          )
        )
      } else {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        alert(err.error || "Failed to update deduction")
      }
    } catch (error) {
      console.error("Error updating deduction:", error)
      alert("Network error while updating deduction")
    }
  }

  const toggleRowSelection = (id: string) => {
    const newSelection = new Set(selectedRows)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedRows(newSelection)
  }

  const toggleStatusFilter = (status: string) => {
    const newStatuses = new Set(filterStatuses)
    if (newStatuses.has(status)) {
      newStatuses.delete(status)
    } else {
      newStatuses.add(status)
    }
    setFilterStatuses(newStatuses)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-900/30 text-green-400 border border-green-800"
      case "Settled":
        return "bg-blue-900/30 text-blue-400 border border-blue-800"
      default: // Unapproved
        return "bg-red-900/30 text-red-400 border border-red-800"
    }
  }

  // Count unapproved in selection for bulk action label
  const selectedUnapprovedCount = Array.from(selectedRows).filter((id) => {
    const record = data.find((d) => d.id === id)
    return record && record.status === "Unapproved"
  }).length

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Unapproved</p>
          <p className="text-2xl font-bold text-white mt-2">{stats.unapproved.count}</p>
          <p className="text-sm text-gray-400 mt-1">
            {formatCurrency(stats.unapproved.amount)}
          </p>
        </div>

        <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Approved</p>
          <p className="text-2xl font-bold text-white mt-2">{stats.approved.count}</p>
          <p className="text-sm text-gray-400 mt-1">{formatCurrency(stats.approved.amount)}</p>
        </div>

        <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Settled</p>
          <p className="text-2xl font-bold text-white mt-2">{stats.settled.count}</p>
          <p className="text-sm text-gray-400 mt-1">{formatCurrency(stats.settled.amount)}</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4 flex items-center gap-4">
        <button
          onClick={handlePreviousWeek}
          className="p-2 hover:bg-white/10 rounded transition-colors"
          title="Previous week"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex-1 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">
            {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
          </span>
        </div>

        <button
          onClick={handleNextWeek}
          className="p-2 hover:bg-white/10 rounded transition-colors"
          title="Next week"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Filters and Actions */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              All Drivers
            </label>
            <SearchableSelect
              options={[{ id: "all", name: "All Drivers" }, ...drivers.map(d => ({ id: d.id, name: d.name }))]}
              value={selectedDriver}
              onChange={(value) => setSelectedDriver(value)}
              placeholder="Select driver..."
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Deduction Type
            </label>
            <SearchableSelect
              options={[{ id: "all", name: "All Types" }, ...DEDUCTION_TYPES.map(t => ({ id: t, name: t }))]}
              value={selectedType}
              onChange={(value) => setSelectedType(value)}
              placeholder="Select type..."
            />
          </div>

          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className="px-3 py-2 text-sm text-gray-400 hover:text-gray-300 border border-white/10 rounded hover:bg-white/5 transition-colors"
          >
            + More Filters
          </button>

          {visibleUnapprovedCount > 0 && (
            <button
              onClick={handleApproveAllVisible}
              disabled={approvingAll}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait text-white text-sm rounded font-medium transition-colors whitespace-nowrap flex items-center gap-2"
            >
              {approvingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4" />
              )}
              Approve All Visible ({visibleUnapprovedCount})
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Deduction
          </button>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 bg-[#E8700A] hover:bg-[#d4650a] text-white text-sm rounded font-medium transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Generate Weekly
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 pt-3 border-t border-white/10">
            <span className="text-sm text-gray-400">{selectedRows.size} selected</span>
            {selectedUnapprovedCount > 0 && (
              <button
                onClick={handleBulkApprove}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-medium transition-colors"
              >
                Approve Selected ({selectedUnapprovedCount})
              </button>
            )}
          </div>
        )}

        {/* More Filters */}
        {showMoreFilters && (
          <div className="pt-4 border-t border-white/10">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-3">
              Status
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {["Unapproved", "Approved", "Settled"].map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterStatuses.has(status)}
                    onChange={() => toggleStatusFilter(status)}
                    className="rounded border-gray-600 text-[#E8700A]"
                  />
                  <span className="text-sm text-gray-300">{status}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0B1120] border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(filteredData.map((r) => r.id)))
                      } else {
                        setSelectedRows(new Set())
                      }
                    }}
                    className="rounded border-gray-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Math
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Amount ($)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Final ($)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                    No deductions found for this period
                  </td>
                </tr>
              ) : (
                filteredData.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-white/5 border-b border-white/5 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(record.id)}
                        onChange={() => toggleRowSelection(record.id)}
                        className="rounded border-gray-600"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {record.drivers?.name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        value={record.deduction_type}
                        onChange={(e) => handleEdit(record.id, "deduction_type", e.target.value)}
                        disabled={record.status === "Settled"}
                        className="bg-[#0B1120] border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#E8700A] disabled:opacity-50"
                      >
                        {DEDUCTION_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <input
                        type="text"
                        value={record.description || ""}
                        onChange={(e) => handleEdit(record.id, "description", e.target.value)}
                        disabled={record.status === "Settled"}
                        className="bg-[#0B1120] border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#E8700A] w-full disabled:opacity-50"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        value={record.unit_of_measure}
                        onChange={(e) => handleEdit(record.id, "unit_of_measure", e.target.value)}
                        disabled={record.status === "Settled"}
                        className="bg-[#0B1120] border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#E8700A] disabled:opacity-50"
                      >
                        {UNIT_OF_MEASURES.map((measure) => (
                          <option key={measure} value={measure}>{measure}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <select
                        value={record.math_operation}
                        onChange={(e) => handleEdit(record.id, "math_operation", e.target.value)}
                        disabled={record.status === "Settled"}
                        className="bg-[#0B1120] border border-white/10 rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#E8700A] disabled:opacity-50"
                      >
                        {MATH_OPERATIONS.map((op) => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-white">
                      <input
                        type="number"
                        step="0.01"
                        value={record.amount}
                        onChange={(e) => handleEdit(record.id, "amount", parseFloat(e.target.value) || 0)}
                        disabled={record.status === "Settled"}
                        className="bg-[#0B1120] border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#E8700A] w-20 text-right disabled:opacity-50"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-white">
                      {formatCurrency(record.final_amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {record.deduction_date
                        ? format(new Date(record.deduction_date), "MMM dd, yyyy")
                        : format(new Date(record.created_at), "MMM dd, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {record.status === "Settled" ? (
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(record.status)}`}
                        >
                          {record.status}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(record)}
                          disabled={togglingIds.has(record.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-wait ${getStatusColor(record.status)}`}
                          title={`Click to ${record.status === "Approved" ? "unapprove" : "approve"}`}
                        >
                          {togglingIds.has(record.id) ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          {record.status}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddDeductionModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          drivers={drivers}
          periodStart={startDate}
          onSuccess={() => {
            setShowAddModal(false)
            router.refresh()
          }}
        />
      )}

      {showGenerateModal && (
        <GenerateDeductionsModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          drivers={drivers}
          periodStart={startDate}
          periodEnd={endDate}
          onSuccess={() => {
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
