"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { LoadWithRelations, LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { LoadDetailPanel } from "./LoadDetailPanel"
import { getActiveHoldKeys } from "@/lib/loadHolds"
import { useUserRole } from "@/lib/auth/useUserRole"
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  X,
} from "lucide-react"

type Driver = {
  id: string
  name: string
  phone: string | null
  status: string
}

type Props = {
  loads: LoadWithRelations[]
  drivers: Driver[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  })
}

function getWeekDates(startDate: Date) {
  const dates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    dates.push(date)
  }
  return dates
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatDateWithDay(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const day = days[date.getDay()]
  return `${day} ${formatDateShort(date)}`
}

// ── Driver Assign Dropdown for unassigned loads ──
function DriverAssignDropdown({
  load,
  drivers,
  onAssigned,
}: {
  load: LoadWithRelations
  drivers: Driver[]
  onAssigned: (loadId: string, driver: Driver) => void
}) {
  const loadId = load.id
  const { role, loading: roleLoading } = useUserRole()
  const assignBlockedByHolds =
    getActiveHoldKeys({
      freight_hold: load.freight_hold,
      customs_hold: load.customs_hold,
      terminal_hold: load.terminal_hold,
      fees_hold: load.fees_hold,
      other_hold: load.other_hold,
      carrier_hold: load.carrier_hold,
    }).length > 0 && !roleLoading && role !== "admin"

  const [open, setOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [search, setSearch] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const handleAssign = async (driver: Driver) => {
    setAssigning(true)
    setAssignError(null)
    try {
      const res = await fetch(`/api/dispatcher/loads/${loadId}/assign-driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driver.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg =
          err.code === "ACTIVE_HOLDS" && Array.isArray(err.activeHolds)
            ? `${err.error || "Hold active"} (${err.activeHolds.join(", ")})`
            : err.error || "Assign failed"
        setAssignError(msg)
        console.error("[DriverAssign] Failed:", err)
        return
      }
      onAssigned(loadId, driver)
      setOpen(false)
      setSearch("")
    } catch (err) {
      console.error("[DriverAssign] Error:", err)
      setAssignError("Network error")
    } finally {
      setAssigning(false)
    }
  }

  const activeDrivers = drivers.filter(
    (d) => d.status === "Active" || d.status === "Available"
  )
  const filteredDrivers = search
    ? activeDrivers.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          (d.phone && d.phone.includes(search))
      )
    : activeDrivers

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (assignBlockedByHolds) return
          setAssignError(null)
          setOpen(!open)
        }}
        className={`w-full px-3 py-2 text-sm font-medium rounded transition-colors ${
          assignBlockedByHolds
            ? "bg-white/5 text-gray-500 cursor-not-allowed opacity-70"
            : "bg-[#E8700A]/20 hover:bg-[#E8700A]/30 text-[#FF8C21]"
        }`}
        disabled={assigning || assignBlockedByHolds}
        title={
          assignBlockedByHolds
            ? "Release active holds before assigning a driver (admins may still assign)."
            : undefined
        }
      >
        {assigning ? (
          <span className="animate-pulse">Assigning…</span>
        ) : (
          "Assign Driver"
        )}
      </button>
      {assignError && (
        <p className="mt-1 text-[10px] text-red-400">{assignError}</p>
      )}

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#1a2236] border border-white/10 rounded-lg shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1.5 border-b border-white/5">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drivers…"
              className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#E8700A]/40"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false)
                  setSearch("")
                }
                if (e.key === "Enter" && filteredDrivers.length === 1) {
                  handleAssign(filteredDrivers[0])
                }
              }}
            />
          </div>
          {filteredDrivers.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500">
              {activeDrivers.length === 0
                ? "No available drivers"
                : "No matches"}
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filteredDrivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => handleAssign(driver)}
                  className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/5 flex items-center gap-2 transition-colors"
                  disabled={assigning}
                >
                  <div className="w-5 h-5 rounded-full bg-[#E8700A]/20 border border-[#E8700A]/40 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-[#E8700A]"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-gray-200">{driver.name}</div>
                    {driver.phone && (
                      <div className="text-[10px] text-gray-500">
                        {driver.phone}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PlannerView({ loads: initialLoads, drivers }: Props) {
  // Local loads state to reflect assignment changes without full page reload
  const [loads, setLoads] = useState(initialLoads)
  const [selectedLoad, setSelectedLoad] = useState<LoadWithRelations | null>(null)

  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date()
    today.setDate(today.getDate() + 1) // Start from tomorrow
    return today
  })

  const [filterDriver, setFilterDriver] = useState<string | null>(null)
  const [filterCustomer, setFilterCustomer] = useState<string | null>(null)
  const [filterLoadType, setFilterLoadType] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Get week dates
  const weekDates = useMemo(() => {
    const dates = getWeekDates(weekStartDate)
    return dates
  }, [weekStartDate])

  // Get unique customers
  const customers = useMemo(() => {
    const customerSet = new Set<string>()
    const customerMap = new Map<string, string>()

    loads.forEach((load) => {
      if (load.customers?.id) {
        customerSet.add(load.customers.id)
        customerMap.set(load.customers.id, load.customers.name)
      }
    })

    return Array.from(customerSet).map((id) => ({
      id,
      name: customerMap.get(id) || "Unknown",
    }))
  }, [loads])

  // Filter loads
  const filteredLoads = useMemo(() => {
    return loads.filter((load) => {
      // Date range filter
      if (load.scheduled_pickup) {
        const loadDate = new Date(load.scheduled_pickup)
        const weekStart = new Date(weekStartDate)
        const weekEnd = new Date(weekStartDate)
        weekEnd.setDate(weekEnd.getDate() + 6)
        weekEnd.setHours(23, 59, 59)

        if (loadDate < weekStart || loadDate > weekEnd) {
          return false
        }
      }

      if (filterDriver && load.driver_id !== filterDriver) {
        return false
      }

      if (filterCustomer && load.customer_id !== filterCustomer) {
        return false
      }

      if (filterLoadType && load.load_type !== filterLoadType) {
        return false
      }

      if (filterStatus && load.status !== filterStatus) {
        return false
      }

      return true
    })
  }, [
    loads,
    weekStartDate,
    filterDriver,
    filterCustomer,
    filterLoadType,
    filterStatus,
  ])

  // Group loads by date
  const loadsByDate = useMemo(() => {
    const grouped = new Map<string, LoadWithRelations[]>()

    weekDates.forEach((date) => {
      const dateStr = date.toISOString().split("T")[0]
      grouped.set(dateStr, [])
    })

    filteredLoads.forEach((load) => {
      if (load.scheduled_pickup) {
        const dateStr = new Date(load.scheduled_pickup)
          .toISOString()
          .split("T")[0]
        const existing = grouped.get(dateStr) || []
        grouped.set(dateStr, [...existing, load])
      }
    })

    return grouped
  }, [filteredLoads, weekDates])

  // Get unassigned loads
  const unassignedLoads = useMemo(() => {
    return filteredLoads.filter((load) => !load.driver_id)
  }, [filteredLoads])

  const handlePrevWeek = () => {
    const prev = new Date(weekStartDate)
    prev.setDate(prev.getDate() - 7)
    setWeekStartDate(prev)
  }

  const handleNextWeek = () => {
    const next = new Date(weekStartDate)
    next.setDate(next.getDate() + 7)
    setWeekStartDate(next)
  }

  const clearFilters = () => {
    setFilterDriver(null)
    setFilterCustomer(null)
    setFilterLoadType(null)
    setFilterStatus(null)
  }

  const hasActiveFilters =
    filterDriver ||
    filterCustomer ||
    filterLoadType ||
    filterStatus

  // Handle driver assignment — update local state so UI reflects change immediately
  const handleDriverAssigned = (loadId: string, driver: Driver) => {
    setLoads((prev) =>
      prev.map((load) =>
        load.id === loadId
          ? {
              ...load,
              driver_id: driver.id,
              drivers: { id: driver.id, name: driver.name, phone: driver.phone, status: "On Job" },
              status: "Assigned",
            }
          : load
      )
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#0B1120] text-white overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#111827] p-4 space-y-4">
        {/* Title and Navigation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Load Planner</h1>
            <p className="text-sm text-gray-400 mt-1">
              Week of{" "}
              {weekDates[0].toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Next week"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Today">
              <Calendar className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showFilters || hasActiveFilters
                ? "bg-[#E8700A]/20 text-[#E8700A] border border-[#E8700A]/30"
                : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E8700A] text-white">
                {[filterDriver, filterCustomer, filterLoadType, filterStatus]
                  .filter(Boolean).length}
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white/2.5 rounded-lg border border-white/5">
            {/* Driver Filter */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                Driver
              </label>
              <select
                value={filterDriver || ""}
                onChange={(e) =>
                  setFilterDriver(e.target.value || null)
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#E8700A] transition-colors"
              >
                <option value="">All Drivers</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Filter */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                Customer
              </label>
              <select
                value={filterCustomer || ""}
                onChange={(e) =>
                  setFilterCustomer(e.target.value || null)
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#E8700A] transition-colors"
              >
                <option value="">All Customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Load Type Filter */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                Load Type
              </label>
              <select
                value={filterLoadType || ""}
                onChange={(e) =>
                  setFilterLoadType(e.target.value || null)
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#E8700A] transition-colors"
              >
                <option value="">All Types</option>
                <option value="Import">Import</option>
                <option value="Export">Export</option>
                <option value="Road">Road</option>
                <option value="Bill Only">Bill Only</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                Status
              </label>
              <select
                value={filterStatus || ""}
                onChange={(e) =>
                  setFilterStatus(e.target.value || null)
                }
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#E8700A] transition-colors"
              >
                <option value="">All Statuses</option>
                <option value="Created">Created</option>
                <option value="Assigned">Assigned</option>
                <option value="Dispatched">Dispatched</option>
                <option value="In Transit">In Transit</option>
                <option value="Arrived At Pickup">Arrived At Pickup</option>
                <option value="Delivered">Delivered</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {filteredLoads.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">No loads found</p>
              <p className="text-sm">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "No upcoming loads scheduled"}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Weekly View */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Weekly Schedule</h2>

              <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
                {weekDates.map((date) => {
                  const dateStr = date.toISOString().split("T")[0]
                  const dayLoads = loadsByDate.get(dateStr) || []
                  const isToday =
                    new Date().toISOString().split("T")[0] === dateStr

                  return (
                    <div
                      key={dateStr}
                      className={`rounded-lg border min-h-72 flex flex-col ${
                        isToday
                          ? "border-[#E8700A]/50 bg-[#E8700A]/5"
                          : "border-white/10 bg-[#111827]"
                      }`}
                    >
                      {/* Day Header */}
                      <div
                        className={`px-4 py-3 border-b ${
                          isToday
                            ? "border-[#E8700A]/20 bg-[#E8700A]/10"
                            : "border-white/5"
                        }`}
                      >
                        <p className="text-sm font-semibold">
                          {formatDateWithDay(date)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {dayLoads.length} load
                          {dayLoads.length !== 1 ? "s" : ""}
                        </p>
                      </div>

                      {/* Day Loads */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {dayLoads.length === 0 ? (
                          <p className="text-xs text-gray-600 italic">
                            No loads
                          </p>
                        ) : (
                          dayLoads.map((load) => {
                            const statusColor =
                              LOAD_STATUS_COLORS[load.status]

                            return (
                              <button
                                key={load.id}
                                onClick={() => setSelectedLoad(load)}
                                className="block w-full text-left p-2 bg-white/2.5 hover:bg-white/5 rounded border border-white/5 hover:border-[#E8700A]/30 transition-colors group"
                              >
                                <p className="text-xs font-semibold text-blue-400 group-hover:text-blue-300">
                                  {load.reference_number}
                                </p>
                                <p className="text-xs text-gray-400 mt-1 truncate">
                                  {load.customers?.name || "—"}
                                </p>
                                <div className="flex items-center gap-1 mt-2">
                                  {load.containers?.container_number && (
                                    <span className="text-xs bg-white/5 text-gray-400 px-1.5 py-0.5 rounded">
                                      {load.containers.container_number.slice(
                                        0,
                                        7
                                      )}
                                    </span>
                                  )}
                                  {load.drivers ? (
                                    <span className="text-xs bg-[#E8700A]/10 text-[#FF8C21] px-1.5 py-0.5 rounded">
                                      {load.drivers.name.split(" ")[0]}
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-gray-500/10 text-gray-400 px-1.5 py-0.5 rounded">
                                      Unassigned
                                    </span>
                                  )}
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Unassigned Loads Section */}
            {unassignedLoads.length > 0 && (
              <div className="space-y-4 border-t border-white/5 pt-6">
                <h2 className="text-lg font-semibold">
                  Unassigned Loads ({unassignedLoads.length})
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unassignedLoads.map((load) => {
                    const statusColor = LOAD_STATUS_COLORS[load.status]
                    const schedDate = load.scheduled_pickup
                      ? new Date(load.scheduled_pickup)
                      : null

                    return (
                      <div
                        key={load.id}
                        className="p-4 bg-[#111827] border border-white/5 rounded-lg hover:border-[#E8700A]/30 hover:bg-white/2.5 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <button
                            onClick={() => setSelectedLoad(load)}
                            className="text-sm font-semibold text-blue-400 hover:text-blue-300"
                          >
                            {load.reference_number}
                          </button>
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
                          >
                            {load.status}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Customer</p>
                            <p className="text-gray-300">
                              {load.customers?.name || "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Scheduled Pickup
                            </p>
                            <p className="text-gray-300">
                              {schedDate
                                ? schedDate.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">Container</p>
                            <p className="text-gray-300 font-mono text-xs">
                              {load.containers?.container_number || "—"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500">
                              Pickup Location
                            </p>
                            <p className="text-gray-300">
                              {load.pickup_location || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <DriverAssignDropdown
                            load={load}
                            drivers={drivers}
                            onAssigned={handleDriverAssigned}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty State for Unassigned */}
            {unassignedLoads.length === 0 && filteredLoads.length > 0 && (
              <div className="text-center py-8 border-t border-white/5 mt-6">
                <p className="text-sm text-gray-500">
                  All loads are assigned to drivers
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Load Detail Panel (side panel overlay) */}
      {selectedLoad && (
        <LoadDetailPanel
          load={selectedLoad}
          loads={loads}
          onClose={() => setSelectedLoad(null)}
          onUpdate={(updated) => {
            setSelectedLoad(updated)
            setLoads((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l))
            )
          }}
          onNavigate={(load) => setSelectedLoad(load)}
        />
      )}
    </div>
  )
}
