// components/equipment/ChassisTable.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AddChassisModal } from "@/components/modals/AddChassisModal"
import { EditChassisModal } from "@/components/modals/EditChassisModal"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"

type Chassis = {
  id: string
  chassis_number: string
  chassis_owner: string | null
  chassis_size: string | null
  chassis_type: string | null
  license_number: string | null
  license_state: string | null
  address: string | null
  vin: string | null
  registration_expiry: string | null
  inspection_expiry: string | null
  insurance_expiry: string | null
  enabled: boolean
  status: string
  notes: string | null
  created_at: string
}

type ChassisTableProps = {
  chassisList: Chassis[]
  statusCounts: {
    total: number
    enabled: number
    disabled: number
  }
}

export function ChassisTable({ chassisList, statusCounts }: ChassisTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">("all")
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedChassis, setSelectedChassis] = useState<Chassis | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Chassis | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return chassisList.filter((c) => {
      const matchesSearch =
        !search ||
        c.chassis_number.toLowerCase().includes(search.toLowerCase()) ||
        c.chassis_owner?.toLowerCase().includes(search.toLowerCase()) ||
        c.license_number?.toLowerCase().includes(search.toLowerCase()) ||
        c.vin?.toLowerCase().includes(search.toLowerCase()) ||
        c.address?.toLowerCase().includes(search.toLowerCase())

      const matchesEnabled =
        enabledFilter === "all" ||
        (enabledFilter === "enabled" && c.enabled !== false) ||
        (enabledFilter === "disabled" && c.enabled === false)

      return matchesSearch && matchesEnabled
    })
  }, [chassisList, search, enabledFilter])

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

  const handleDelete = async (chassis: Chassis) => {
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/chassis/${chassis.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Delete failed")
      }
      setDeleteConfirm(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
      console.error("Delete failed:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddChassis = async (chassisData: Record<string, unknown>) => {
    setError(null)
    try {
      const res = await fetch("/api/chassis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chassisData),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create chassis")
      }
      setAddModalOpen(false)
      router.refresh()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create chassis"
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }

  const handleEditChassis = async (chassisId: string, updates: Record<string, unknown>) => {
    setError(null)
    try {
      const res = await fetch(`/api/chassis/${chassisId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update chassis")
      }
      setEditModalOpen(false)
      router.refresh()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update chassis"
      setError(errorMsg)
      throw new Error(errorMsg)
    }
  }

  const handleOpenEdit = (chassis: Chassis) => {
    setSelectedChassis(chassis)
    setEditModalOpen(true)
  }

  const sizeColor = (size: string | null) => {
    if (!size) return "bg-gray-600/20 text-gray-400 border-gray-600/30"
    switch (size) {
      case "20": return "bg-blue-500/15 text-blue-400 border-blue-500/30"
      case "40": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      case "45": return "bg-purple-500/15 text-purple-400 border-purple-500/30"
      case "20-40": return "bg-amber-500/15 text-amber-400 border-amber-500/30"
      case "20-FO": return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
      default: return "bg-gray-600/20 text-gray-400 border-gray-600/30"
    }
  }

  const typeColor = (type: string | null) => {
    if (!type) return "bg-gray-600/20 text-gray-400 border-gray-600/30"
    switch (type) {
      case "Standard": return "bg-white/5 text-gray-300 border-white/10"
      case "Tri-Axle": return "bg-orange-500/15 text-orange-400 border-orange-500/30"
      case "Tri-axle": return "bg-orange-500/15 text-orange-400 border-orange-500/30"
      case "Combo": return "bg-violet-500/15 text-violet-400 border-violet-500/30"
      default: return "bg-white/5 text-gray-300 border-white/10"
    }
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
            placeholder="Search chassis #, owner, license, VIN..."
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
            Add Chassis
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-white/5">
              <th className="px-3 py-3 w-24 text-center">Actions</th>
              <SortableHeader label="Chassis #" sortKey="chassis_number" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="Address" sortKey="address" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="Chassis Owner" sortKey="chassis_owner" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="Size" sortKey="chassis_size" className="text-center" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="Type" sortKey="chassis_type" className="text-center" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="License #" sortKey="license_number" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="VIN" sortKey="vin" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="Registration" sortKey="registration_expiry" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="Inspection" sortKey="inspection_expiry" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              <SortableHeader label="Insurance" sortKey="insurance_expiry" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedData.map((chassis) => {
              const reg = formatExpiry(chassis.registration_expiry)
              const insp = formatExpiry(chassis.inspection_expiry)
              const ins = formatExpiry(chassis.insurance_expiry)

              return (
                <tr
                  key={chassis.id}
                  className={`hover:bg-white/[0.02] transition-colors ${chassis.enabled === false ? "opacity-50" : ""}`}
                >
                  {/* Actions */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleOpenEdit(chassis)} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-[#FF8C21] transition-colors" title="Edit">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteConfirm(chassis)} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>

                  <td className="px-3 py-2.5"><span className="text-sm font-mono font-medium text-gray-200">{chassis.chassis_number}</span></td>
                  <td className="px-3 py-2.5"><span className="text-xs text-gray-400 max-w-[200px] truncate block" title={chassis.address || undefined}>{chassis.address || "—"}</span></td>
                  <td className="px-3 py-2.5"><span className="text-sm text-gray-300">{chassis.chassis_owner || "—"}</span></td>

                  <td className="px-3 py-2.5 text-center">
                    {chassis.chassis_size ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${sizeColor(chassis.chassis_size)}`}>
                        {chassis.chassis_size}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-center">
                    {chassis.chassis_type ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${typeColor(chassis.chassis_type)}`}>
                        {chassis.chassis_type}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5">
                    {chassis.license_number ? (
                      <div>
                        <span className="text-sm text-gray-300 font-mono">{chassis.license_number}</span>
                        {chassis.license_state && <span className="text-xs text-gray-500 ml-1">({chassis.license_state})</span>}
                      </div>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><span className="text-xs text-gray-400 font-mono max-w-[140px] truncate block">{chassis.vin || "—"}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-xs ${reg.className}`}>{reg.text}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-xs ${insp.className}`}>{insp.text}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-xs ${ins.className}`}>{ins.text}</span></td>
                </tr>
              )
            })}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-sm text-gray-500">
                  {search || enabledFilter !== "all" ? "No chassis match your filters" : "No chassis yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/5">
        <p className="text-xs text-gray-500">Showing {filtered.length} of {chassisList.length} chassis</p>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteConfirm(null)} />
          <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-white">Delete Chassis</h3>
            <p className="mt-2 text-sm text-gray-400">
              Are you sure you want to delete chassis <span className="text-white font-medium">#{deleteConfirm.chassis_number}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={isDeleting} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={isDeleting} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                {isDeleting ? "Deleting..." : "Delete Chassis"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modals */}
      <AddChassisModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddChassis}
      />
      <EditChassisModal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setSelectedChassis(null) }}
        onSave={handleEditChassis}
        chassis={selectedChassis}
      />
    </div>
  )
}
