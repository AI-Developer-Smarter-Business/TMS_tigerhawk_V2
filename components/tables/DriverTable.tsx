// components/tables/DriverTable.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AddDriverModal } from "../modals/AddDriverModal"
import { ImportStaffCsvModal } from "../drivers/ImportStaffCsvModal"
import { EditDriverModal } from "../modals/EditDriverModal"
import { DriverHistoryModal } from "../modals/DriverHistoryModal"
import { ChangePasswordModal } from "../modals/ChangePasswordModal"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { exportToCSV, type ExportColumn, formatDateForExport } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

type Driver = {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  username: string | null
  email: string | null
  phone: string | null
  license_number: string | null
  license_state: string | null
  license_expiry: string | null
  medical_expiry: string | null
  twic_expiry: string | null
  date_of_birth: string | null
  date_of_hire: string | null
  truck_number: string | null
  truck_owner: string | null
  plates: string | null
  emergency_contact: string | null
  emergency_phone: string | null
  use_for_pre_appointments: boolean
  enabled: boolean
  status: string
  notes: string | null
  created_at: string
  activeShipmentCount: number
  completedShipmentCount: number
  currentShipment: {
    reference_number: string
    pickup_location: string | null
    delivery_location: string | null
  } | null
  shipments?: Array<{
    id: string
    reference_number: string
    status: string
    pickup_location: string | null
    delivery_location: string | null
    scheduled_pickup: string | null
  }>
}

type StatusCounts = {
  total: number
  available: number
  dispatched: number
  enabled: number
  disabled: number
}

export function DriverTable({
  drivers,
  statusCounts,
}: {
  drivers: Driver[]
  statusCounts: StatusCounts
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [enabledFilter, setEnabledFilter] = useState<"all" | "enabled" | "disabled">("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Driver | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordDriver, setPasswordDriver] = useState<Driver | null>(null)
  const [importCsvOpen, setImportCsvOpen] = useState(false)

  const filtered = useMemo(() => {
    return drivers.filter((d) => {
      const fullName = `${d.first_name || ""} ${d.last_name || ""} ${d.name || ""}`.toLowerCase()
      const matchesSearch =
        search === "" ||
        fullName.includes(search.toLowerCase()) ||
        d.email?.toLowerCase().includes(search.toLowerCase()) ||
        d.phone?.toLowerCase().includes(search.toLowerCase()) ||
        d.license_number?.toLowerCase().includes(search.toLowerCase()) ||
        d.truck_number?.toLowerCase().includes(search.toLowerCase()) ||
        d.username?.toLowerCase().includes(search.toLowerCase())

      const matchesEnabled =
        enabledFilter === "all" ||
        (enabledFilter === "enabled" && d.enabled !== false) ||
        (enabledFilter === "disabled" && d.enabled === false)

      const matchesStatus = statusFilter === "all" || d.status === statusFilter

      return matchesSearch && matchesEnabled && matchesStatus
    })
  }, [drivers, search, enabledFilter, statusFilter])

  const sortGetValue = useMemo(() => ({
    first_name: (d: Driver) => d.first_name || d.name?.split(" ")[0] || "",
    last_name: (d: Driver) => d.last_name || d.name?.split(" ").slice(1).join(" ") || "",
  }), [])

  const { sortedData, sortConfig, requestSort } = useTableSort(filtered, null, sortGetValue)

  const driverExportColumns: ExportColumn<Driver>[] = [
    { header: "First Name", accessor: (d) => d.first_name || d.name?.split(" ")[0] || "" },
    { header: "Last Name", accessor: (d) => d.last_name || d.name?.split(" ").slice(1).join(" ") || "" },
    { header: "Username", accessor: (d) => d.username },
    { header: "Email", accessor: (d) => d.email },
    { header: "Phone", accessor: (d) => d.phone },
    { header: "Status", accessor: (d) => d.status },
    { header: "Enabled", accessor: (d) => d.enabled ? "Yes" : "No" },
    { header: "Truck #", accessor: (d) => d.truck_number },
    { header: "Truck Owner", accessor: (d) => d.truck_owner },
    { header: "Plates", accessor: (d) => d.plates },
    { header: "License #", accessor: (d) => d.license_number },
    { header: "License State", accessor: (d) => d.license_state },
    { header: "License Expiry", accessor: (d) => formatDateForExport(d.license_expiry) },
    { header: "Medical Expiry", accessor: (d) => formatDateForExport(d.medical_expiry) },
    { header: "TWIC Expiry", accessor: (d) => formatDateForExport(d.twic_expiry) },
    { header: "Date of Birth", accessor: (d) => formatDateForExport(d.date_of_birth) },
    { header: "Date of Hire", accessor: (d) => formatDateForExport(d.date_of_hire) },
    { header: "Emergency Contact", accessor: (d) => d.emergency_contact },
    { header: "Emergency Phone", accessor: (d) => d.emergency_phone },
    { header: "Pre-Appointment", accessor: (d) => d.use_for_pre_appointments ? "Yes" : "No" },
    { header: "Active Shipments", accessor: (d) => d.activeShipmentCount },
    { header: "Completed Shipments", accessor: (d) => d.completedShipmentCount },
    { header: "Notes", accessor: (d) => d.notes },
  ]

  const handleExportDrivers = () => {
    exportToCSV("drivers", driverExportColumns, sortedData)
  }

  const handleAddDriver = async (driverData: Record<string, unknown>) => {
    const response = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(driverData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to create driver")
    }

    setAddModalOpen(false)
    router.refresh()
  }

  const handleEditDriver = async (driverId: string, updates: Record<string, unknown>) => {
    const response = await fetch(`/api/drivers/${driverId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update driver")
    }

    setEditModalOpen(false)
    router.refresh()
  }

  const handleOpenEdit = (driver: Driver) => {
    setSelectedDriver(driver)
    setEditModalOpen(true)
  }

  const handleOpenHistory = (driver: Driver) => {
    setSelectedDriver(driver)
    setHistoryModalOpen(true)
  }

  const handleDeleteDriver = async (driver: Driver) => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete driver")
      }

      setDeleteConfirm(null)
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete driver")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTogglePreAppt = async (driver: Driver) => {
    const newValue = !driver.use_for_pre_appointments
    try {
      const response = await fetch(`/api/drivers/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_for_pre_appointments: newValue }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error("Failed to toggle pre-appointment:", error)
        return
      }

      router.refresh()
    } catch (err) {
      console.error("Failed to toggle pre-appointment:", err)
    }
  }

  // Format a date for display, highlight if expired or expiring soon
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

  return (
    <>
      <AddDriverModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddDriver}
      />
      <EditDriverModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleEditDriver}
        driver={selectedDriver}
      />
      <DriverHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        driver={selectedDriver}
      />
      <ChangePasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        driverName={passwordDriver?.name || null}
        driverEmail={passwordDriver?.email || null}
      />
      <ImportStaffCsvModal
        open={importCsvOpen}
        onClose={() => setImportCsvOpen(false)}
        entity="drivers"
        templateUrl="/api/admin/csv-template/drivers"
        title="Import drivers (CSV)"
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteConfirm(null)} />
          <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">Delete Driver</h3>
                <p className="mt-2 text-sm text-gray-400">
                  Are you sure you want to delete <span className="text-white font-medium">{deleteConfirm.name}</span>?
                  This action cannot be undone. Any completed shipments will be unlinked from this driver.
                </p>
                {deleteConfirm.activeShipmentCount > 0 && (
                  <p className="mt-2 text-sm text-amber-400">
                    This driver has {deleteConfirm.activeShipmentCount} active shipment(s). You must reassign or complete them before deleting.
                  </p>
                )}
                {deleteError && (
                  <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400">{deleteError}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDriver(deleteConfirm)}
                disabled={isDeleting || deleteConfirm.activeShipmentCount > 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Driver"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        {/* Toolbar */}
        <div className="px-6 py-3 flex flex-col sm:flex-row gap-3 border-b border-white/5 items-start sm:items-center">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search name, phone, email, license, truck..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
            />
          </div>

          {/* Enabled / Disabled toggles */}
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
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none cursor-pointer"
          >
            <option value="all" className="bg-[#111827]">All</option>
            <option value="Available" className="bg-[#111827]">Available</option>
            <option value="On Assignment" className="bg-[#111827]">On Assignment</option>
            <option value="Off Duty" className="bg-[#111827]">Off Duty</option>
          </select>

          <ExportButton onClick={handleExportDrivers} count={sortedData.length} />

          <button
            type="button"
            onClick={() => setImportCsvOpen(true)}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-white/15 text-gray-300 hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            Import CSV
          </button>

          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors shadow-lg shadow-[#E8700A]/20 whitespace-nowrap"
          >
            + Add Driver
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-white/5">
                <th className="px-3 py-3 w-36 text-center">Actions</th>
                <SortableHeader label="First Name" sortKey="first_name" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="Last Name" sortKey="last_name" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="Username" sortKey="username" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <th className="px-3 py-3 text-center">Pre-Appt</th>
                <SortableHeader label="Truck #" sortKey="truck_number" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="Truck Owner" sortKey="truck_owner" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="Plates" sortKey="plates" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="Phone" sortKey="phone" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="DL Exp" sortKey="license_expiry" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="Medical Exp" sortKey="medical_expiry" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="TWIC Exp" sortKey="twic_expiry" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="DOB" sortKey="date_of_birth" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="DOH" sortKey="date_of_hire" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="Email" sortKey="email" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
                <SortableHeader label="Emergency" sortKey="emergency_contact" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedData.map((driver) => {
                const dlExp = formatExpiry(driver.license_expiry)
                const medExp = formatExpiry(driver.medical_expiry)
                const twicExp = formatExpiry(driver.twic_expiry)

                // Derive first/last from name if separate fields not set
                const firstName = driver.first_name || driver.name?.split(" ")[0] || ""
                const lastName = driver.last_name || driver.name?.split(" ").slice(1).join(" ") || ""

                return (
                  <tr
                    key={driver.id}
                    className={`hover:bg-white/2 transition-colors ${
                      driver.enabled === false ? "opacity-50" : ""
                    }`}
                  >
                    {/* Actions */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(driver)}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-[#FF8C21] transition-colors"
                          title="Edit driver"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleOpenHistory(driver)}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-purple-400 transition-colors"
                          title="View history"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { setPasswordDriver(driver); setPasswordModalOpen(true) }}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-colors"
                          title="Change password"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => { setDeleteError(null); setDeleteConfirm(driver) }}
                          className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete driver"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>

                    {/* First Name */}
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-gray-200">{firstName}</p>
                    </td>

                    {/* Last Name */}
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-gray-200">{lastName}</p>
                    </td>

                    {/* Username */}
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-gray-400 font-mono">{driver.username || "—"}</p>
                    </td>

                    {/* Pre-Appointment Toggle */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleTogglePreAppt(driver)}
                        className="inline-flex w-8 h-5 rounded-full transition-colors cursor-pointer"
                        style={{ backgroundColor: driver.use_for_pre_appointments ? "#10b981" : "#4b5563" }}
                        title={driver.use_for_pre_appointments ? "Disable pre-appointments" : "Enable pre-appointments"}
                      >
                        <span className={`w-4 h-4 m-0.5 rounded-full bg-white transition-transform ${
                          driver.use_for_pre_appointments ? "translate-x-3" : ""
                        }`} />
                      </button>
                    </td>

                    {/* Truck # */}
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-mono text-gray-300">{driver.truck_number || "—"}</p>
                    </td>

                    {/* Truck Owner */}
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-gray-300">{driver.truck_owner || "—"}</p>
                    </td>

                    {/* Plates */}
                    <td className="px-3 py-2.5">
                      <select
                        value={driver.plates || ""}
                        onChange={async (e) => {
                          const value = e.target.value || null
                          try {
                            const res = await fetch(`/api/drivers/${driver.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ plates: value }),
                            })
                            if (res.ok) {
                              router.refresh()
                            }
                          } catch (err) {
                            console.error("Failed to update plates:", err)
                          }
                        }}
                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-[#E8700A] cursor-pointer"
                      >
                        <option value="" className="bg-[#111827] text-white">—</option>
                        <option value="Standard" className="bg-[#111827] text-white">Standard</option>
                        <option value="Combo" className="bg-[#111827] text-white">Combo</option>
                      </select>
                    </td>

                    {/* Phone */}
                    <td className="px-3 py-2.5">
                      <p className="text-sm text-gray-300">{driver.phone || "—"}</p>
                    </td>

                    {/* DL Expiry */}
                    <td className="px-3 py-2.5">
                      <p className={`text-xs ${dlExp.className}`}>{dlExp.text}</p>
                    </td>

                    {/* Medical Expiry */}
                    <td className="px-3 py-2.5">
                      <p className={`text-xs ${medExp.className}`}>{medExp.text}</p>
                    </td>

                    {/* TWIC Expiry */}
                    <td className="px-3 py-2.5">
                      <p className={`text-xs ${twicExp.className}`}>{twicExp.text}</p>
                    </td>

                    {/* DOB */}
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-gray-400">
                        {driver.date_of_birth
                          ? new Date(driver.date_of_birth).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
                          : "—"
                        }
                      </p>
                    </td>

                    {/* DOH */}
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-gray-400">
                        {driver.date_of_hire
                          ? new Date(driver.date_of_hire).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
                          : "—"
                        }
                      </p>
                    </td>

                    {/* Email */}
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-gray-400 max-w-[160px] truncate">{driver.email || "—"}</p>
                    </td>

                    {/* Emergency */}
                    <td className="px-3 py-2.5">
                      {driver.emergency_contact || driver.emergency_phone ? (
                        <div>
                          <p className="text-xs text-gray-400">{driver.emergency_contact || "—"}</p>
                          <p className="text-[11px] text-gray-500">{driver.emergency_phone || ""}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">—</p>
                      )}
                    </td>
                  </tr>
                )
              })}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={15} className="px-6 py-12 text-center text-sm text-gray-500">
                    {search || enabledFilter !== "all" || statusFilter !== "all"
                      ? "No drivers match your filters"
                      : "No drivers yet — click '+ Add Driver' to create one"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5">
          <p className="text-xs text-gray-500">
            Showing {filtered.length} of {drivers.length} drivers
          </p>
        </div>
      </div>
    </>
  )
}
