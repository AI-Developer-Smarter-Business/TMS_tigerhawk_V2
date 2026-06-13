"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, Plus, Calendar, Trash2, Loader2 } from "lucide-react"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { AddDriverPayModal } from "./modals/AddDriverPayModal"
import { useRouter } from "next/navigation"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

const formatCurrency = (amount: number) => `$${(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface DriverPayRecord {
  id: string
  driver_id: string
  load_id: string
  container_number: string | null
  truck_number: string | null
  owner: string | null
  amount: number
  from_location: string
  to_location: string
  pay_date: string | null
  created_at: string
  status: string
  notes: string | null
  loads?: {
    id: string
    reference_number: string
    status: string
  } | null
  drivers?: {
    id: string
    name: string
    phone: string
    status: string
  } | null
}

interface Driver {
  id: string
  name: string
}

interface Truck {
  truck_number: string
}

interface FleetOwner {
  id: string
  name: string
}

interface Stats {
  unapproved: { count: number; amount: number }
  approved: { count: number; amount: number }
  settled: { count: number; amount: number }
  paid: { count: number; amount: number }
}

interface DriverPayViewProps {
  initialData: DriverPayRecord[]
  drivers: Driver[]
  trucks: Truck[]
  fleetOwners: FleetOwner[]
  stats: Stats
  initialStartDate: Date
  initialEndDate: Date
}

export function DriverPayView({
  initialData,
  drivers,
  trucks,
  fleetOwners,
  stats,
  initialStartDate,
  initialEndDate,
}: DriverPayViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [selectedDriver, setSelectedDriver] = useState<string>("all")
  const [selectedTruck, setSelectedTruck] = useState<string>("all")
  const [selectedOwner, setSelectedOwner] = useState<string>("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [data, setData] = useState(initialData)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [filterDateFrom, setFilterDateFrom] = useState<string>("")
  const [filterDateTo, setFilterDateTo] = useState<string>("")
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set())
  const [filterAmountMin, setFilterAmountMin] = useState<string>("")
  const [filterAmountMax, setFilterAmountMax] = useState<string>("")
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // Toggle Approved ↔ Unapproved via PATCH
  const handleToggleStatus = useCallback(async (record: DriverPayRecord) => {
    const newStatus = record.status === "Approved" ? "Unapproved" : "Approved"
    // Don't allow toggling records that are already Settled or Paid
    if (record.status === "Settled" || record.status === "Paid") return

    setTogglingIds((prev) => new Set(prev).add(record.id))
    try {
      const response = await fetch(`/api/accounts-payable/driver-pay/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (response.ok) {
        setData((prev) =>
          prev.map((r) => (r.id === record.id ? { ...r, status: newStatus } : r))
        )
        // Refresh server data so stats cards update
        router.refresh()
      } else {
        const err = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("Failed to toggle status:", err)
        alert(`Failed to update status: ${err.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error toggling driver pay status:", error)
      alert("Network error toggling status")
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(record.id)
        return next
      })
    }
  }, [])

  // Sync state when server-side data changes (e.g., week navigation)
  useEffect(() => {
    setData(initialData)
  }, [initialData])
  useEffect(() => {
    setStartDate(initialStartDate)
  }, [initialStartDate])
  useEffect(() => {
    setEndDate(initialEndDate)
  }, [initialEndDate])

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
    router.push(`/dashboard/accounts-payable/driver-pay?${query.toString()}`)
  }

  const filteredData = data.filter((record) => {
    if (selectedDriver !== "all" && record.driver_id !== selectedDriver) return false
    if (selectedTruck !== "all" && record.truck_number !== selectedTruck)
      return false
    if (selectedOwner !== "all" && record.owner !== selectedOwner)
      return false

    // Additional filters
    if (filterDateFrom) {
      const recordDate = new Date(record.pay_date || record.created_at)
      const fromDate = new Date(filterDateFrom)
      if (recordDate < fromDate) return false
    }

    if (filterDateTo) {
      const recordDate = new Date(record.pay_date || record.created_at)
      const toDate = new Date(filterDateTo)
      toDate.setHours(23, 59, 59, 999)
      if (recordDate > toDate) return false
    }

    if (filterStatuses.size > 0 && !filterStatuses.has(record.status)) {
      return false
    }

    if (filterAmountMin) {
      const minAmount = parseFloat(filterAmountMin)
      if (record.amount < minAmount) return false
    }

    if (filterAmountMax) {
      const maxAmount = parseFloat(filterAmountMax)
      if (record.amount > maxAmount) return false
    }

    return true
  })

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this driver pay record?")) return

    try {
      const response = await fetch(`/api/accounts-payable/driver-pay/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setData(data.filter((record) => record.id !== id))
      }
    } catch (error) {
      console.error("Error deleting driver pay:", error)
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
      case "Paid":
        return "bg-purple-900/30 text-purple-400 border border-purple-800"
      default: // Unapproved
        return "bg-red-900/30 text-red-400 border border-red-800"
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Paid</p>
          <p className="text-2xl font-bold text-white mt-2">{stats.paid.count}</p>
          <p className="text-sm text-gray-400 mt-1">{formatCurrency(stats.paid.amount)}</p>
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
              All Trucks
            </label>
            <SearchableSelect
              options={[{ id: "all", name: "All Trucks" }, ...trucks.map(t => ({ id: t.truck_number, name: t.truck_number }))]}
              value={selectedTruck}
              onChange={(value) => setSelectedTruck(value)}
              placeholder="Select truck..."
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              All Owners
            </label>
            <SearchableSelect
              options={[{ id: "all", name: "All Owners" }, ...fleetOwners.map(o => ({ id: o.id, name: o.name }))]}
              value={selectedOwner}
              onChange={(value) => setSelectedOwner(value)}
              placeholder="Select owner..."
            />
          </div>

          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className="px-3 py-2 text-sm text-gray-400 hover:text-gray-300 border border-white/10 rounded hover:bg-white/5 transition-colors">
            + More Filters
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium transition-colors whitespace-nowrap"
          >
            + Add Driver Pay
          </button>
        </div>
        {showMoreFilters && (
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Range Filter */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Date From
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Date To
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                />
              </div>

              {/* Amount Range Filter */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Amount Min ($)
                </label>
                <input
                  type="number"
                  value={filterAmountMin}
                  onChange={(e) => setFilterAmountMin(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Amount Max ($)
                </label>
                <input
                  type="number"
                  value={filterAmountMax}
                  onChange={(e) => setFilterAmountMax(e.target.value)}
                  placeholder="No limit"
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-3">
                Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["Unapproved", "Approved", "Settled", "Paid"].map((status) => (
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
                  Load #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Container #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Truck
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Load Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  From
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  To
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Amount ($)
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
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                    No driver pay records found
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
                    <td className="px-4 py-3">
                      <a
                        href={`/dashboard/shipments?load=${record.load_id}`}
                        className="text-[#E8700A] hover:text-[#FF9500] font-medium"
                      >
                        {record.loads?.reference_number || "N/A"}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {record.container_number || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {record.drivers?.name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {record.truck_number || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {record.owner || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          record.loads?.status === "Completed"
                            ? "bg-green-900/30 text-green-400"
                            : "bg-blue-900/30 text-blue-400"
                        }`}
                      >
                        {record.loads?.status || "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {record.from_location || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {record.to_location || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {format(new Date(record.pay_date || record.created_at), "MMM dd, yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-white">
                      {formatCurrency(record.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {record.status === "Settled" || record.status === "Paid" ? (
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
        <AddDriverPayModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          drivers={drivers}
          onSuccess={(newRecord) => {
            setData([newRecord, ...data])
            setShowAddModal(false)
          }}
        />
      )}
    </div>
  )
}
