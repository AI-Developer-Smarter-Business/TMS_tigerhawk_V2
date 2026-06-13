"use client"

import React, { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Search, Users, Calendar, Truck } from "lucide-react"
import { LoadWithRelations, LOAD_STATUS_COLORS, LoadStatus } from "@/types/dispatcher"

// ─── Types ─────────────────────────────────────────────────────────
type DriverInfo = {
  id: string
  name: string
  phone: string | null
  status: string
  truck_number: string | null
}

type Props = {
  loads: LoadWithRelations[]
  drivers: DriverInfo[]
}

// A single "move" row derived from a load
type MoveRow = {
  loadId: string
  loadRef: string
  driverName: string
  driverId: string | null
  containerNumber: string
  chassisNumber: string
  moveType: "Hook Container" | "Pick Up Container" | "Deliver Container" | "Drop Container" | "Return Container"
  status: LoadStatus
  assignedDate: string | null
  company: string
  address: string
  distance: number | null
  enroute: string | null
  arrived: string | null
  notes: string | null
  ssl: string
  bolBkg: string
  containerSize: string
  containerType: string
  isFirstMoveInLoad: boolean
  totalMovesInLoad: number
  moveIndex: number
}

type DateFilter = "today" | "all"

// ─── Helpers ───────────────────────────────────────────────────────
const getToday = (): Date => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const formatDateShort = (date: Date): string =>
  date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })

const formatDateRange = (date: Date): string =>
  `${formatDateShort(date)} - ${formatDateShort(date)}`

const formatTimestamp = (ts: string | null): string => {
  if (!ts) return "—"
  const d = new Date(ts)
  return `${d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })}\n${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
}

const isSameDay = (dateStr: string, target: Date): boolean => {
  const d = new Date(dateStr)
  return d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const formatPhone = (phone: string | null): string => {
  if (!phone) return ""
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  return phone
}

// Derive the list of moves from a single load
const deriveMoves = (load: LoadWithRelations, driverName: string): MoveRow[] => {
  const moves: MoveRow[] = []
  const base = {
    loadId: load.id,
    loadRef: load.reference_number || "",
    driverName,
    driverId: load.driver_id,
    containerNumber: load.containers?.container_number || "",
    chassisNumber: load.chassis_number || "",
    status: load.status as LoadStatus,
    assignedDate: load.created_at,
    company: load.customers?.name || "",
    distance: load.distance,
    notes: load.notes,
    ssl: load.ssl || load.containers?.shipping_line || "",
    bolBkg: load.mbol || load.house_bol || "",
    containerSize: load.container_size || load.containers?.size || "",
    containerType: load.container_type || load.containers?.type || "",
    isFirstMoveInLoad: false,
    totalMovesInLoad: 0,
    moveIndex: 0,
  }

  // Pick Up / Hook
  if (load.pickup_location) {
    moves.push({
      ...base,
      moveType: load.actual_pickup ? "Hook Container" : "Pick Up Container",
      address: load.pickup_location,
      enroute: load.scheduled_pickup || load.actual_pickup,
      arrived: load.actual_pickup,
    })
  }

  // Deliver
  if (load.delivery_location) {
    moves.push({
      ...base,
      moveType: "Deliver Container",
      address: load.delivery_location,
      enroute: load.actual_pickup, // left pickup, heading to delivery
      arrived: load.actual_delivery,
    })
  }

  // Drop / Return
  if (load.return_location) {
    moves.push({
      ...base,
      moveType: "Return Container",
      address: load.return_location,
      enroute: load.actual_delivery, // left delivery, heading to return
      arrived: load.completed_date,
    })
  } else if (load.delivery_location) {
    moves.push({
      ...base,
      moveType: "Drop Container",
      address: load.delivery_location,
      enroute: load.actual_delivery,
      arrived: load.completed_date,
    })
  }

  // Tag first move and totals
  moves.forEach((m, i) => {
    m.isFirstMoveInLoad = i === 0
    m.totalMovesInLoad = moves.length
    m.moveIndex = i
  })

  return moves
}

// Move type badge colors
const MOVE_COLORS: Record<string, { bg: string; text: string }> = {
  "Hook Container": { bg: "bg-blue-500/15", text: "text-blue-300" },
  "Pick Up Container": { bg: "bg-cyan-500/15", text: "text-cyan-300" },
  "Deliver Container": { bg: "bg-emerald-500/15", text: "text-emerald-300" },
  "Drop Container": { bg: "bg-purple-500/15", text: "text-purple-300" },
  "Return Container": { bg: "bg-amber-500/15", text: "text-amber-300" },
}

// ─── Component ─────────────────────────────────────────────────────
export const DriverItineraryTab: React.FC<Props> = ({ loads, drivers }) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null) // null = All
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState<DateFilter>("today")
  const [currentDate, setCurrentDate] = useState<Date>(getToday())

  // Build driver assignment map (driver → load count + current status)
  const driverStats = useMemo(() => {
    const map = new Map<string, { loadCount: number; currentStatus: string; lastLocation: string }>()
    drivers.forEach((d) => map.set(d.id, { loadCount: 0, currentStatus: d.status, lastLocation: "" }))

    loads.forEach((load) => {
      if (load.driver_id && map.has(load.driver_id)) {
        const stat = map.get(load.driver_id)!
        stat.loadCount++
        // Derive most active status
        if (load.status === "In Transit" || load.status === "Dispatched") {
          stat.currentStatus = load.status
          stat.lastLocation = load.pickup_location || load.delivery_location || ""
        }
      }
    })
    return map
  }, [loads, drivers])

  // Filter drivers by search
  const filteredDrivers = useMemo(() => {
    if (!searchTerm.trim()) return drivers
    const q = searchTerm.toLowerCase()
    return drivers.filter(
      (d) => d.name.toLowerCase().includes(q) || d.phone?.includes(searchTerm)
    )
  }, [drivers, searchTerm])

  // Build the move rows for the table
  const moveRows = useMemo(() => {
    // Map driver IDs to names
    const driverNameMap = new Map<string, string>()
    drivers.forEach((d) => driverNameMap.set(d.id, d.name))

    // Filter loads by selected driver
    let filteredLoads = loads
    if (selectedDriverId) {
      filteredLoads = loads.filter((l) => l.driver_id === selectedDriverId)
    } else {
      // "All" — only show loads that have a driver assigned
      filteredLoads = loads.filter((l) => l.driver_id)
    }

    // Filter by date
    if (dateFilter === "today") {
      filteredLoads = filteredLoads.filter((l) => {
        // Match on created_at, or any appointment date matching the current day
        return (
          (l.created_at && isSameDay(l.created_at, currentDate)) ||
          (l.pickup_apt_from && isSameDay(l.pickup_apt_from, currentDate)) ||
          (l.delivery_apt_from && isSameDay(l.delivery_apt_from, currentDate)) ||
          (l.return_apt_from && isSameDay(l.return_apt_from, currentDate)) ||
          (l.actual_pickup && isSameDay(l.actual_pickup, currentDate)) ||
          (l.actual_delivery && isSameDay(l.actual_delivery, currentDate))
        )
      })
    }

    // Derive moves
    const rows: MoveRow[] = []
    filteredLoads.forEach((load) => {
      const driverName = load.driver_id ? driverNameMap.get(load.driver_id) || "Unassigned" : "Unassigned"
      rows.push(...deriveMoves(load, driverName))
    })

    return rows
  }, [loads, drivers, selectedDriverId, dateFilter, currentDate])

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full bg-[#0B1120]">
      {/* ── Left Sidebar: Driver List ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-white/5 bg-[#111827]">
        {/* Date controls */}
        <div className="px-3 pt-3 pb-2 border-b border-white/5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(addDays(currentDate, -1))}
              className="p-1.5 rounded hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>

            <button
              onClick={() => { setDateFilter("today"); setCurrentDate(getToday()) }}
              className={`flex-1 text-center px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
                dateFilter === "today"
                  ? "bg-[#E8700A]/20 text-[#FF8C21] border border-[#E8700A]/30"
                  : "text-gray-300 hover:bg-white/5 border border-transparent"
              }`}
            >
              Today&apos;s Loads
            </button>

            <button
              onClick={() => setCurrentDate(addDays(currentDate, 1))}
              className="p-1.5 rounded hover:bg-white/5 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-500">{formatDateRange(currentDate)}</span>
            <button
              onClick={() => setDateFilter(dateFilter === "all" ? "today" : "all")}
              className="text-xs text-gray-500 hover:text-[#FF8C21] transition-colors flex items-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              {dateFilter === "all" ? "Today" : "All"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0B1120] border border-white/10 rounded-md text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#E8700A]/50"
            />
          </div>
        </div>

        {/* "All Drivers" button */}
        <button
          onClick={() => setSelectedDriverId(null)}
          className={`mx-3 mt-2 flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
            selectedDriverId === null
              ? "bg-[#E8700A]/15 border border-[#E8700A]/40 text-white"
              : "bg-[#0B1120] border border-white/5 text-gray-300 hover:border-white/10"
          }`}
        >
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            selectedDriverId === null ? "bg-[#E8700A]/30" : "bg-white/5"
          }`}>
            <Users className={`h-4 w-4 ${selectedDriverId === null ? "text-[#FF8C21]" : "text-gray-400"}`} />
          </div>
          <div>
            <p className="text-sm font-medium">All Drivers</p>
            <p className="text-xs text-gray-500">{drivers.length} drivers</p>
          </div>
        </button>

        {/* Driver list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {filteredDrivers.map((driver) => {
            const isSelected = selectedDriverId === driver.id
            const stats = driverStats.get(driver.id)
            const loadCount = stats?.loadCount || 0

            return (
              <button
                key={driver.id}
                onClick={() => setSelectedDriverId(isSelected ? null : driver.id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all ${
                  isSelected
                    ? "bg-[#E8700A]/15 border border-[#E8700A]/40"
                    : "bg-[#0B1120] border border-white/5 hover:border-white/10"
                }`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  isSelected ? "bg-[#E8700A]/30 text-[#FF8C21]" : "bg-white/5 text-gray-400"
                }`}>
                  {getInitials(driver.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{driver.name}</p>
                    {loadCount > 0 && (
                      <span className="flex-shrink-0 bg-[#E8700A]/20 text-[#FF8C21] text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {loadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {driver.phone && <span>{formatPhone(driver.phone)}</span>}
                    {driver.truck_number && (
                      <span className="flex items-center gap-0.5">
                        <Truck className="h-3 w-3" />
                        {driver.truck_number}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}

          {filteredDrivers.length === 0 && (
            <p className="text-center text-gray-500 text-xs py-4">No drivers found</p>
          )}
        </div>
      </div>

      {/* ── Main Content: Moves Table ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/5 bg-[#111827] px-6 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-200">
            {selectedDriverId
              ? drivers.find((d) => d.id === selectedDriverId)?.name || "Driver"
              : "All Drivers"}{" "}
            <span className="text-gray-500 font-normal">
              — {moveRows.length} move{moveRows.length !== 1 ? "s" : ""}
            </span>
          </h2>
          <span className="text-sm text-gray-400">
            {dateFilter === "all" ? "All Time" : formatDateShort(currentDate)}
          </span>
        </div>

        {/* Table */}
        {moveRows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 text-sm">No loads found for this selection</p>
              {selectedDriverId && (
                <button
                  onClick={() => setSelectedDriverId(null)}
                  className="text-xs text-[#FF8C21] hover:underline mt-2"
                >
                  View all drivers
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse min-w-[1400px]">
              <thead className="sticky top-0 z-10 bg-[#111827]">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-32">Load #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-32">Container #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-24">Chassis #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-36">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-28">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-28">Assigned Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-40">Company</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Address</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-20">Distance</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-24">Enroute</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-24">Arrived</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-40">Notes</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-20">SSL</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 w-28">BOL/BKG</th>
                </tr>
              </thead>
              <tbody>
                {moveRows.map((move, idx) => {
                  const moveColor = MOVE_COLORS[move.moveType] || MOVE_COLORS["Pick Up Container"]
                  const statusColor = LOAD_STATUS_COLORS[move.status]
                  const isNewLoad = move.isFirstMoveInLoad
                  const prevMove = idx > 0 ? moveRows[idx - 1] : null
                  const showDriverDivider = !selectedDriverId && prevMove && prevMove.driverId !== move.driverId

                  return (
                    <React.Fragment key={`${move.loadId}-${move.moveIndex}`}>
                      {/* Driver divider row when showing "All" */}
                      {showDriverDivider && (
                        <tr>
                          <td colSpan={14} className="px-4 py-2 bg-[#0B1120]">
                            <span className="text-xs font-semibold text-[#FF8C21]">{move.driverName}</span>
                          </td>
                        </tr>
                      )}
                      {/* First driver's header too */}
                      {!selectedDriverId && idx === 0 && (
                        <tr>
                          <td colSpan={14} className="px-4 py-2 bg-[#0B1120]">
                            <span className="text-xs font-semibold text-[#FF8C21]">{move.driverName}</span>
                          </td>
                        </tr>
                      )}

                      <tr className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                        isNewLoad && move.moveIndex > 0 ? "" : ""
                      }`}>
                        {/* Load # — only show on first move of load */}
                        <td className="px-4 py-2.5 text-sm whitespace-nowrap">
                          {isNewLoad ? (
                            <span className="text-[#60A5FA] font-medium">{move.loadRef}</span>
                          ) : (
                            <span className="text-gray-600">↳</span>
                          )}
                        </td>

                        {/* Container # */}
                        <td className="px-4 py-2.5 text-sm text-gray-300 whitespace-nowrap">
                          {isNewLoad ? (move.containerNumber || "—") : ""}
                        </td>

                        {/* Chassis # */}
                        <td className="px-4 py-2.5 text-sm text-gray-300 whitespace-nowrap">
                          {isNewLoad ? (move.chassisNumber || "—") : ""}
                        </td>

                        {/* Move Type */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${moveColor.bg} ${moveColor.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              move.arrived ? "bg-emerald-400" : move.enroute ? "bg-blue-400" : "bg-gray-500"
                            }`} />
                            {move.moveType}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {isNewLoad && statusColor ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                              {move.status}
                            </span>
                          ) : null}
                        </td>

                        {/* Assigned Date */}
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                          {isNewLoad && move.assignedDate
                            ? new Date(move.assignedDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" })
                            : ""}
                        </td>

                        {/* Company */}
                        <td className="px-4 py-2.5 text-sm text-gray-300 whitespace-nowrap truncate max-w-[160px]">
                          {isNewLoad ? (move.company || "—") : ""}
                        </td>

                        {/* Address */}
                        <td className="px-4 py-2.5 text-sm text-gray-300 truncate max-w-[240px]" title={move.address}>
                          {move.address || "—"}
                        </td>

                        {/* Distance */}
                        <td className="px-4 py-2.5 text-sm text-gray-400 whitespace-nowrap">
                          {isNewLoad && move.distance ? `${move.distance} mi` : isNewLoad ? "—" : ""}
                        </td>

                        {/* Enroute */}
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-pre-line">
                          {formatTimestamp(move.enroute)}
                        </td>

                        {/* Arrived */}
                        <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-pre-line">
                          {formatTimestamp(move.arrived)}
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-2.5 text-xs text-gray-500 truncate max-w-[160px]" title={move.notes || ""}>
                          {isNewLoad ? (move.notes || "—") : ""}
                        </td>

                        {/* SSL */}
                        <td className="px-4 py-2.5 text-sm text-gray-300 whitespace-nowrap">
                          {isNewLoad ? (move.ssl || "—") : ""}
                        </td>

                        {/* BOL/BKG */}
                        <td className="px-4 py-2.5 text-sm text-gray-300 whitespace-nowrap">
                          {isNewLoad ? (move.bolBkg || "—") : ""}
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default DriverItineraryTab
