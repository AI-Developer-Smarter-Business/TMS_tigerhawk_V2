// components/tables/TruckAssignmentsTable.tsx
"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { exportToCSV, type ExportColumn } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

type Driver = {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  username: string | null
  phone: string
  truck_number: string | null
  truck_owner: string | null
  status: string
  enabled: boolean
  activeShipmentCount: number
  currentShipment: {
    reference_number: string
    status: string
    pickup_location: string | null
    delivery_location: string | null
  } | null
}

type Truck = {
  truck_number: string
  truck_owner: string | null
  enabled: boolean
}

type TruckAssignmentsTableProps = {
  drivers: Driver[]
  trucks: Truck[]
}

// Map shipment statuses to PortPro-style load status labels
function getLoadStatus(driver: Driver): { label: string; color: string } | null {
  if (!driver.currentShipment) return null

  const shipStatus = driver.currentShipment.status
  switch (shipStatus) {
    case "Assigned":
      return { label: "Assigned — Awaiting Dispatch", color: "text-blue-400 bg-blue-400/10" }
    case "Dispatched":
      return { label: "Enroute To Pick Container", color: "text-amber-400 bg-amber-400/10" }
    case "In Transit":
      return { label: "Enroute To Deliver Load", color: "text-[#FF8C21] bg-[#E8700A]/10" }
    case "Delivered":
      return { label: "Arrived At Deliver Load", color: "text-emerald-400 bg-emerald-400/10" }
    default:
      return { label: shipStatus, color: "text-gray-400 bg-white/5" }
  }
}

export function TruckAssignmentsTable({ drivers, trucks }: TruckAssignmentsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null)
  const [truckSearch, setTruckSearch] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const enabledDrivers = drivers.filter((d) => d.enabled !== false)

  // Compute which truck numbers are currently assigned to any driver
  const assignedTruckNumbers = useMemo(() => {
    const assigned = new Set<string>()
    for (const d of drivers) {
      if (d.truck_number) assigned.add(d.truck_number)
    }
    return assigned
  }, [drivers])

  // Available trucks = enabled trucks not assigned to any driver
  const availableTrucks = useMemo(() => {
    return trucks.filter(
      (t) => t.enabled && !assignedTruckNumbers.has(t.truck_number)
    )
  }, [trucks, assignedTruckNumbers])

  // Filter available trucks by the truck search input
  const filteredTrucks = useMemo(() => {
    if (!truckSearch) return availableTrucks
    const q = truckSearch.toLowerCase()
    return availableTrucks.filter(
      (t) =>
        t.truck_number.toLowerCase().includes(q) ||
        t.truck_owner?.toLowerCase().includes(q)
    )
  }, [availableTrucks, truckSearch])

  const filtered = enabledDrivers.filter((d) => {
    if (!search) return true
    const q = search.toLowerCase()
    const fullName = `${d.first_name || ""} ${d.last_name || ""} ${d.name || ""}`.toLowerCase()
    return (
      fullName.includes(q) ||
      d.username?.toLowerCase().includes(q) ||
      d.phone?.toLowerCase().includes(q) ||
      d.truck_number?.toLowerCase().includes(q)
    )
  })

  const sortGetValue = useMemo(() => ({
    driverName: (d: Driver) => `${d.first_name || d.name?.split(" ")[0] || ""} ${d.last_name || d.name?.split(" ").slice(1).join(" ") || ""}`,
    username: (d: Driver) => d.username ?? "",
    mobile: (d: Driver) => d.phone ?? "",
    truckNumber: (d: Driver) => d.truck_number ?? "",
    truckOwner: (d: Driver) => d.truck_owner ?? "",
    loadStatus: (d: Driver) => {
      const ls = getLoadStatus(d)
      return ls?.label ?? ""
    },
  }), [])

  const { sortedData, sortConfig, requestSort } = useTableSort(filtered, null, sortGetValue)

  const assignmentExportColumns: ExportColumn<Driver>[] = [
    { header: "Driver Name", accessor: (d) => `${d.first_name || d.name?.split(" ")[0] || ""} ${d.last_name || d.name?.split(" ").slice(1).join(" ") || ""}`.trim() },
    { header: "Username", accessor: (d) => d.username },
    { header: "Phone", accessor: (d) => d.phone },
    { header: "Truck #", accessor: (d) => d.truck_number },
    { header: "Truck Owner", accessor: (d) => d.truck_owner },
    { header: "Status", accessor: (d) => d.status },
    { header: "Load Status", accessor: (d) => getLoadStatus(d)?.label || "" },
    { header: "Active Shipments", accessor: (d) => d.activeShipmentCount },
    { header: "Current Reference", accessor: (d) => d.currentShipment?.reference_number },
  ]

  const handleExportAssignments = () => {
    exportToCSV("truck-assignments", assignmentExportColumns, sortedData)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  const handleAssignTruck = async (driverId: string, truckNumber: string) => {
    if (!truckNumber.trim()) return
    setSaving(true)
    try {
      const response = await fetch(`/api/drivers/${driverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ truck_number: truckNumber.trim() }),
      })
      if (!response.ok) {
        const err = await response.json()
        console.error("Failed to assign truck:", err)
        return
      }
      setAssigningDriverId(null)
      setTruckSearch("")
      setDropdownOpen(false)
      router.refresh()
    } catch (err) {
      console.error("Failed to assign truck:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleUnassignTruck = async (driverId: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/drivers/${driverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ truck_number: null }),
      })
      if (!response.ok) {
        const err = await response.json()
        console.error("Failed to unassign truck:", err)
        return
      }
      router.refresh()
    } catch (err) {
      console.error("Failed to unassign truck:", err)
    } finally {
      setSaving(false)
    }
  }

  const startAssigning = (driverId: string) => {
    setAssigningDriverId(driverId)
    setTruckSearch("")
    setDropdownOpen(true)
    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const cancelAssigning = () => {
    setAssigningDriverId(null)
    setTruckSearch("")
    setDropdownOpen(false)
  }

  // Get initials + a deterministic color for the avatar
  const getAvatar = (driver: Driver) => {
    const first = driver.first_name || driver.name?.split(" ")[0] || ""
    const last = driver.last_name || driver.name?.split(" ").slice(1).join(" ") || ""
    const initials = `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "?"

    const colors = [
      "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-pink-500",
      "bg-amber-500", "bg-cyan-500", "bg-rose-500", "bg-indigo-500",
    ]
    let hash = 0
    for (let i = 0; i < driver.name.length; i++) {
      hash = driver.name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const color = colors[Math.abs(hash) % colors.length]

    return { initials, color }
  }

  // Find the truck owner for a given truck number (for display)
  const getTruckOwner = (truckNumber: string | null) => {
    if (!truckNumber) return null
    const t = trucks.find((tr) => tr.truck_number === truckNumber)
    return t?.truck_owner || null
  }

  return (
    <div>
      {/* Header */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-white/5">
        <p className="text-sm text-gray-400 font-medium">
          {enabledDrivers.length} Drivers &middot; {availableTrucks.length} Trucks Available
        </p>
        <div className="relative w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search drivers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
          />
        </div>
        <ExportButton onClick={handleExportAssignments} count={sortedData.length} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-white/5">
              <SortableHeader sortKey="driverName" label="Driver Name" className="!px-4" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader sortKey="username" label="Username" className="!px-4" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader sortKey="mobile" label="Mobile" className="!px-4" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader sortKey="truckNumber" label="Truck Number" className="!px-4" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader sortKey="truckOwner" label="Truck Owner" className="!px-4" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader sortKey="loadStatus" label="Load Status" className="!px-4" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <th className="px-4 py-3">Locations</th>
              <th className="px-4 py-3 w-16 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedData.map((driver) => {
              const avatar = getAvatar(driver)
              const firstName = driver.first_name || driver.name?.split(" ")[0] || ""
              const lastName = driver.last_name || driver.name?.split(" ").slice(1).join(" ") || ""
              const loadStatus = getLoadStatus(driver)
              const isAssigning = assigningDriverId === driver.id
              const truckOwner = getTruckOwner(driver.truck_number)

              return (
                <tr key={driver.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Driver Name with avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${avatar.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-[11px] font-bold text-white">{avatar.initials}</span>
                      </div>
                      <span className="text-sm text-gray-200 font-medium">
                        {firstName} {lastName}
                      </span>
                    </div>
                  </td>

                  {/* Username */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400 font-mono">{driver.username || "—"}</span>
                  </td>

                  {/* Mobile */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-300">{driver.phone || "—"}</span>
                  </td>

                  {/* Truck Number — dropdown picker */}
                  <td className="px-4 py-3">
                    {isAssigning ? (
                      <div className="relative" ref={dropdownRef}>
                        <input
                          ref={inputRef}
                          type="text"
                          value={truckSearch}
                          onChange={(e) => {
                            setTruckSearch(e.target.value)
                            setDropdownOpen(true)
                          }}
                          onFocus={() => setDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelAssigning()
                            if (e.key === "Enter" && filteredTrucks.length === 1) {
                              handleAssignTruck(driver.id, filteredTrucks[0].truck_number)
                            }
                          }}
                          placeholder="Search truck #..."
                          className="w-40 px-2.5 py-1.5 bg-white/5 border border-[#E8700A]/50 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                        />
                        <button
                          onClick={cancelAssigning}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>

                        {/* Dropdown */}
                        {dropdownOpen && (
                          <div className="absolute z-50 mt-1 w-72 max-h-56 overflow-y-auto bg-[#1a2234] border border-white/10 rounded-lg shadow-xl">
                            {filteredTrucks.length === 0 ? (
                              <div className="px-3 py-3 text-xs text-gray-500 text-center">
                                {truckSearch ? "No matching trucks available" : "No trucks available"}
                              </div>
                            ) : (
                              filteredTrucks.map((truck) => (
                                <button
                                  key={truck.truck_number}
                                  onClick={() => handleAssignTruck(driver.id, truck.truck_number)}
                                  disabled={saving}
                                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-mono font-medium text-[#FF8C21]">
                                      {truck.truck_number}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate max-w-[150px]">
                                      {truck.truck_owner || "—"}
                                    </span>
                                  </div>
                                  <svg className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                  </svg>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ) : driver.truck_number ? (
                      <span className="text-sm text-gray-300 font-mono">{driver.truck_number}</span>
                    ) : (
                      <button
                        onClick={() => startAssigning(driver.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#FF8C21] hover:text-[#E8700A] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Assign Truck
                      </button>
                    )}
                  </td>

                  {/* Truck Owner */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-400">{truckOwner || driver.truck_owner || "—"}</span>
                  </td>

                  {/* Load Status */}
                  <td className="px-4 py-3">
                    {loadStatus ? (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${loadStatus.color}`}>
                        {loadStatus.label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>

                  {/* Locations */}
                  <td className="px-4 py-3">
                    {driver.currentShipment ? (
                      <div className="text-xs text-gray-400 max-w-[200px]">
                        <p className="truncate">{driver.currentShipment.pickup_location || "—"}</p>
                        <p className="truncate text-gray-500">{driver.currentShipment.delivery_location || "—"}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>

                  {/* Actions — unassign truck */}
                  <td className="px-4 py-3 text-center">
                    {driver.truck_number && (
                      <button
                        onClick={() => handleUnassignTruck(driver.id)}
                        disabled={saving}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Unassign truck"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                  {search ? "No drivers match your search" : "No drivers found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/5">
        <p className="text-xs text-gray-500">
          Showing {filtered.length} of {enabledDrivers.length} drivers
        </p>
      </div>
    </div>
  )
}
