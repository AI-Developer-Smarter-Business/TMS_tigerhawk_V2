// components/equipment/TrucksTable.tsx
"use client"

import { useState, useMemo } from "react"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { AddTruckModal } from "@/components/modals/AddTruckModal"
import { EditTruckModal } from "@/components/modals/EditTruckModal"

type Truck = {
  id: string
  truck_number: string
  truck_owner: string | null
  license_plate: string | null
  license_plate_state: string | null
  vin: string | null
  address: string | null
  registration_expiry: string | null
  inspection_expiry: string | null
  annual_inspection_expiry: string | null
  insurance_expiry: string | null
  engine_family: string | null
  has_sleeper: boolean
  use_for_pre_appointments: boolean
  enabled: boolean
  status: string
  notes: string | null
  created_at: string
  assigned_driver?: string | null
}

type TrucksTableProps = {
  trucks: Truck[]
  statusCounts: {
    total: number
    available: number
    dispatched: number
    enabled: number
    disabled: number
  }
}

export function TrucksTable({ trucks, statusCounts }: TrucksTableProps) {
  const [search, setSearch] = useState("")
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">("all")
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Truck | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filtered = useMemo(() => {
    return trucks.filter((t) => {
      const matchesSearch =
        !search ||
        t.truck_number.toLowerCase().includes(search.toLowerCase()) ||
        t.truck_owner?.toLowerCase().includes(search.toLowerCase()) ||
        t.license_plate?.toLowerCase().includes(search.toLowerCase()) ||
        t.vin?.toLowerCase().includes(search.toLowerCase())

      const matchesEnabled =
        enabledFilter === "all" ||
        (enabledFilter === "enabled" && t.enabled !== false) ||
        (enabledFilter === "disabled" && t.enabled === false)

      return matchesSearch && matchesEnabled
    })
  }, [trucks, search, enabledFilter])

  const { sortedData, sortConfig, requestSort } = useTableSort(filtered)

  const formatExpiry = (dateStr: string | null) => {
    if (!dateStr) return { text: "—", className: "text-gray-500" }
    const date = new Date(dateStr)
    const now = new Date()
    const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const text = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    if (daysUntil < 0) return { text, className: "text-red-400 font-medium" }
    if (daysUntil <= 30) return { text, className: "text-amber-400 font-medium" }
    return { text, className: "text-gray-300" }
  }

  const handleTogglePreAppt = async (truck: Truck) => {
    try {
      await fetch(`/api/trucks/${truck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_for_pre_appointments: !truck.use_for_pre_appointments }),
      })
      window.location.reload()
    } catch (err) {
      console.error("Toggle pre-appt failed:", err)
    }
  }

  const handleDelete = async (truck: Truck) => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/trucks/${truck.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        console.error("Delete failed:", err)
      }
      setDeleteConfirm(null)
      window.location.reload()
    } catch (err) {
      console.error("Delete failed:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddTruck = async (truckData: Record<string, unknown>) => {
    const res = await fetch("/api/trucks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(truckData),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || "Failed to create truck")
    }
    window.location.reload()
  }

  const handleEditTruck = async (truckId: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/trucks/${truckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || "Failed to update truck")
    }
    window.location.reload()
  }

  const handleOpenEdit = (truck: Truck) => {
    setSelectedTruck(truck)
    setEditModalOpen(true)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="px-6 py-3 flex flex-col sm:flex-row gap-3 border-b border-white/5 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search truck #, owner, plate, VIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEnabledFilter(enabledFilter === "enabled" ? "all" : "enabled")}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              enabledFilter === "enabled"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
            }`}
          >
            Enabled {statusCounts.enabled}
          </button>
          <button
            onClick={() => setEnabledFilter(enabledFilter === "disabled" ? "all" : "disabled")}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              enabledFilter === "disabled"
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
            }`}
          >
            Disabled {statusCounts.disabled}
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-[#E8700A] text-white hover:bg-[#FF8C21] transition-colors shadow-lg shadow-[#E8700A]/20 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Truck
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-white/5">
              <th className="px-3 py-3 w-24 text-center">Actions</th>
              <SortableHeader
                label="Truck #"
                sortKey="truck_number"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <th className="px-3 py-3 text-center">Pre-Appt</th>
              <SortableHeader
                label="Truck Owner"
                sortKey="truck_owner"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <SortableHeader
                label="License Plate #"
                sortKey="license_plate"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <SortableHeader
                label="State"
                sortKey="license_plate_state"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <SortableHeader
                label="VIN"
                sortKey="vin"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <SortableHeader
                label="Registration"
                sortKey="registration_expiry"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <SortableHeader
                label="Inspection"
                sortKey="inspection_expiry"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <SortableHeader
                label="Annual Insp"
                sortKey="annual_inspection_expiry"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <SortableHeader
                label="Insurance"
                sortKey="insurance_expiry"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <SortableHeader
                label="Engine Family"
                sortKey="engine_family"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
              <th className="px-3 py-3 text-center">Sleeper</th>
              <SortableHeader
                label="Driver"
                sortKey="assigned_driver"
                currentSortKey={sortConfig?.key ?? null}
                currentDirection={sortConfig?.direction ?? null}
                onSort={requestSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedData.map((truck) => {
              const reg = formatExpiry(truck.registration_expiry)
              const insp = formatExpiry(truck.inspection_expiry)
              const annInsp = formatExpiry(truck.annual_inspection_expiry)
              const ins = formatExpiry(truck.insurance_expiry)

              return (
                <tr
                  key={truck.id}
                  className={`hover:bg-white/[0.02] transition-colors ${truck.enabled === false ? "opacity-50" : ""}`}
                >
                  {/* Actions */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleOpenEdit(truck)} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-[#FF8C21] transition-colors" title="Edit">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteConfirm(truck)} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>

                  <td className="px-3 py-2.5"><span className="text-sm font-mono font-medium text-gray-200">{truck.truck_number}</span></td>

                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => handleTogglePreAppt(truck)} className="inline-flex w-8 h-5 rounded-full transition-colors cursor-pointer" style={{ backgroundColor: truck.use_for_pre_appointments ? "#10b981" : "#4b5563" }} title={truck.use_for_pre_appointments ? "Disable pre-appointments" : "Enable pre-appointments"}>
                      <span className={`w-4 h-4 m-0.5 rounded-full bg-white transition-transform ${truck.use_for_pre_appointments ? "translate-x-3" : ""}`} />
                    </button>
                  </td>

                  <td className="px-3 py-2.5"><span className="text-sm text-gray-300">{truck.truck_owner || "—"}</span></td>
                  <td className="px-3 py-2.5"><span className="text-sm text-gray-300 font-mono">{truck.license_plate || "—"}</span></td>
                  <td className="px-3 py-2.5"><span className="text-sm text-gray-400">{truck.license_plate_state || "—"}</span></td>
                  <td className="px-3 py-2.5"><span className="text-xs text-gray-400 font-mono max-w-[140px] truncate block">{truck.vin || "—"}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-xs ${reg.className}`}>{reg.text}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-xs ${insp.className}`}>{insp.text}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-xs ${annInsp.className}`}>{annInsp.text}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-xs ${ins.className}`}>{ins.text}</span></td>
                  <td className="px-3 py-2.5"><span className="text-xs text-gray-400">{truck.engine_family || "—"}</span></td>

                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${truck.has_sleeper ? "bg-emerald-500" : "bg-gray-600"}`} />
                  </td>

                  <td className="px-3 py-2.5"><span className="text-xs text-gray-400">{truck.assigned_driver || "—"}</span></td>
                </tr>
              )
            })}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={14} className="px-6 py-12 text-center text-sm text-gray-500">
                  {search || enabledFilter !== "all" ? "No trucks match your filters" : "No trucks yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/5">
        <p className="text-xs text-gray-500">Showing {filtered.length} of {trucks.length} trucks</p>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteConfirm(null)} />
          <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white">Delete Truck</h3>
            <p className="mt-2 text-sm text-gray-400">
              Are you sure you want to delete truck <span className="text-white font-medium">#{deleteConfirm.truck_number}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={isDeleting} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={isDeleting} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                {isDeleting ? "Deleting..." : "Delete Truck"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modals */}
      <AddTruckModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddTruck}
      />
      <EditTruckModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setSelectedTruck(null) }}
        onSave={handleEditTruck}
        truck={selectedTruck}
      />
    </div>
  )
}
