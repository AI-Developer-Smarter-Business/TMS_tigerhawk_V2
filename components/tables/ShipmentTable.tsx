// components/tables/ShipmentTable.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AssignDriverModal } from "../modals/AssignDriverModal"
import { EditShipmentModal } from "../modals/EditShipmentModal"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { exportToCSV, type ExportColumn, formatDateForExport, formatDateTimeForExport } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

type Shipment = {
  id: string
  reference_number: string
  status: string
  pickup_location: string | null
  delivery_location: string | null
  chassis_number: string | null
  scheduled_pickup: string | null
  actual_pickup: string | null
  actual_delivery: string | null
  rate: number | null
  accessorial_charges: number | null
  detention_charges: number | null
  notes: string | null
  urgency: "normal" | "warning" | "critical"
  created_at: string
  customers: { id: string; name: string; email: string; phone: string } | null
  containers: {
    container_number: string
    bol_number: string | null
    size: string | null
    type: string | null
    status: string
    last_free_day: string | null
  } | null
  drivers: { id: string; name: string; phone: string; status: string } | null
}

export function ShipmentTable({
  shipments,
  availableDrivers,
}: {
  shipments: Shipment[]
  availableDrivers: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedShipmentForAssign, setSelectedShipmentForAssign] = useState<{
    id: string
    reference: string
  } | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedShipmentForEdit, setSelectedShipmentForEdit] = useState<Shipment | null>(null)

  const handleOpenAssignModal = (shipmentId: string, reference: string) => {
    setSelectedShipmentForAssign({ id: shipmentId, reference })
    setAssignModalOpen(true)
  }

  const handleAssignDriver = async (driverId: string) => {
    if (!selectedShipmentForAssign) return

    const response = await fetch(`/api/shipments/${selectedShipmentForAssign.id}/assign-driver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_id: driverId }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to assign driver")
    }

    // Refresh the page to show updated data
    setAssignModalOpen(false)
    router.refresh()
  }

  const handleStatusChange = async (shipmentId: string, newStatus: string) => {
    const response = await fetch(`/api/shipments/${shipmentId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      const message = errorData.error || "Failed to update status"
      throw new Error(message)
    }

    // Refresh the page to show updated data
    router.refresh()
  }

  const handleOpenEditModal = (shipment: Shipment) => {
    setSelectedShipmentForEdit(shipment)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async (shipmentId: string, updates: Record<string, unknown>) => {
    const response = await fetch(`/api/shipments/${shipmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to update shipment")
    }

    // Refresh the page to show updated data
    setEditModalOpen(false)
    router.refresh()
  }

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      const matchesSearch =
        search === "" ||
        s.reference_number.toLowerCase().includes(search.toLowerCase()) ||
        s.customers?.name.toLowerCase().includes(search.toLowerCase()) ||
        s.containers?.container_number.toLowerCase().includes(search.toLowerCase()) ||
        s.containers?.bol_number?.toLowerCase().includes(search.toLowerCase()) ||
        s.drivers?.name.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === "all" || s.status === statusFilter ||
        (statusFilter === "active" && ["Created", "Assigned", "Dispatched", "In Transit"].includes(s.status))

      return matchesSearch && matchesStatus
    })
  }, [shipments, search, statusFilter])

  const sortGetValue = useMemo(() => ({
    reference: (s: Shipment) => s.reference_number,
    customer: (s: Shipment) => s.customers?.name ?? "",
    container: (s: Shipment) => s.containers?.container_number ?? "",
    status: (s: Shipment) => s.status,
    driver: (s: Shipment) => s.drivers?.name ?? "",
    pickup: (s: Shipment) => s.pickup_location ?? "",
    delivery: (s: Shipment) => s.delivery_location ?? "",
  }), [])

  const { sortedData, sortConfig, requestSort } = useTableSort(filtered, null, sortGetValue)

  const shipmentExportColumns: ExportColumn<Shipment>[] = [
    { header: "Reference #", accessor: (s) => s.reference_number },
    { header: "Status", accessor: (s) => s.status },
    { header: "Customer", accessor: (s) => s.customers?.name },
    { header: "Container #", accessor: (s) => s.containers?.container_number },
    { header: "BOL #", accessor: (s) => s.containers?.bol_number },
    { header: "Driver", accessor: (s) => s.drivers?.name },
    { header: "Pickup Location", accessor: (s) => s.pickup_location },
    { header: "Delivery Location", accessor: (s) => s.delivery_location },
    { header: "Chassis #", accessor: (s) => s.chassis_number },
    { header: "Scheduled Pickup", accessor: (s) => formatDateTimeForExport(s.scheduled_pickup) },
    { header: "Actual Pickup", accessor: (s) => formatDateTimeForExport(s.actual_pickup) },
    { header: "Actual Delivery", accessor: (s) => formatDateTimeForExport(s.actual_delivery) },
    { header: "Rate", accessor: (s) => s.rate },
    { header: "Accessorial Charges", accessor: (s) => s.accessorial_charges },
    { header: "Detention Charges", accessor: (s) => s.detention_charges },
    { header: "Urgency", accessor: (s) => s.urgency },
    { header: "Last Free Day", accessor: (s) => formatDateForExport(s.containers?.last_free_day) },
    { header: "Notes", accessor: (s) => s.notes },
    { header: "Created", accessor: (s) => formatDateForExport(s.created_at) },
  ]

  const handleExportShipments = () => {
    exportToCSV("shipments", shipmentExportColumns, sortedData)
  }

  return (
    <>
      <AssignDriverModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        onAssign={handleAssignDriver}
        availableDrivers={availableDrivers}
        shipmentReference={selectedShipmentForAssign?.reference || ""}
      />
      <EditShipmentModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveEdit}
        onStatusChange={handleStatusChange}
        shipment={selectedShipmentForEdit}
        availableDrivers={availableDrivers}
      />
      <div>
        {/* Filters */}
      <div className="px-6 py-3 flex flex-col sm:flex-row gap-3 border-b border-white/5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search reference, customer, container, BOL, or driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none cursor-pointer"
        >
          <option value="all" className="bg-[#111827]">All Statuses</option>
          <option value="active" className="bg-[#111827]">Active Only</option>
          <option value="Created" className="bg-[#111827]">Created</option>
          <option value="Assigned" className="bg-[#111827]">Assigned</option>
          <option value="Dispatched" className="bg-[#111827]">Dispatched</option>
          <option value="In Transit" className="bg-[#111827]">In Transit</option>
          <option value="Delivered" className="bg-[#111827]">Delivered</option>
          <option value="Completed" className="bg-[#111827]">Completed</option>
          <option value="Cancelled" className="bg-[#111827]">Cancelled</option>
        </select>

        <ExportButton onClick={handleExportShipments} count={sortedData.length} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider border-b border-white/5">
              <th className="px-6 py-3 w-8"></th>
              <SortableHeader label="Reference" sortKey="reference" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Customer" sortKey="customer" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Container" sortKey="container" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Status" sortKey="status" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Driver" sortKey="driver" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Pickup" sortKey="pickup" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
              <SortableHeader label="Delivery" sortKey="delivery" currentSortKey={sortConfig?.key as string ?? null} currentDirection={sortConfig?.direction ?? null} onSort={requestSort} className="!px-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedData.map((shipment) => (
              <ShipmentRow
                key={shipment.id}
                shipment={shipment}
                expanded={expandedId === shipment.id}
                onToggle={() => setExpandedId(expandedId === shipment.id ? null : shipment.id)}
                availableDrivers={availableDrivers}
                onOpenAssignModal={handleOpenAssignModal}
                onStatusChange={handleStatusChange}
                onOpenEditModal={handleOpenEditModal}
              />
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500">
                  {search || statusFilter !== "all"
                    ? "No shipments match your filters"
                    : "No shipments yet"
                  }
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Showing {filtered.length} of {shipments.length} shipments
        </p>
        <p className="text-xs text-gray-500">
          {availableDrivers.length} driver{availableDrivers.length !== 1 ? "s" : ""} available
        </p>
      </div>
      </div>
    </>
  )
}

function ShipmentRow({
  shipment,
  expanded,
  onToggle,
  availableDrivers,
  onOpenAssignModal,
  onStatusChange,
  onOpenEditModal,
}: {
  shipment: Shipment
  expanded: boolean
  onToggle: () => void
  availableDrivers: { id: string; name: string }[]
  onOpenAssignModal: (shipmentId: string, reference: string) => void
  onStatusChange: (shipmentId: string, newStatus: string) => void
  onOpenEditModal: (shipment: Shipment) => void
}) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdating(true)
    try {
      await onStatusChange(shipment.id, newStatus)
    } finally {
      setIsUpdating(false)
    }
  }
  const statusStyles: Record<string, string> = {
    "Created": "bg-gray-500/10 text-gray-400",
    "Assigned": "bg-blue-500/10 text-blue-400",
    "Dispatched": "bg-purple-500/10 text-purple-400",
    "In Transit": "bg-[#E8700A]/15 text-[#FF8C21]",
    "At Warehouse": "bg-cyan-500/10 text-cyan-400",
    "Delivered": "bg-emerald-500/10 text-emerald-400",
    "Completed": "bg-emerald-500/10 text-emerald-400",
    "Cancelled": "bg-red-500/10 text-red-400",
  }

  const urgencyBorder = shipment.urgency === "critical"
    ? "border-l-2 border-l-red-500"
    : shipment.urgency === "warning"
    ? "border-l-2 border-l-amber-500"
    : ""

  return (
    <>
      <tr
        className={`hover:bg-white/[0.02] transition-colors cursor-pointer group ${urgencyBorder}`}
        onClick={onToggle}
      >
        <td className="px-6 py-3.5">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </td>
        <td className="px-6 py-3.5">
          <p className="text-sm font-medium text-gray-200 group-hover:text-white font-mono">
            {shipment.reference_number}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {new Date(shipment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </td>
        <td className="px-6 py-3.5">
          {shipment.customers ? (
            <div>
              <p className="text-sm text-gray-300">{shipment.customers.name}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">—</p>
          )}
        </td>
        <td className="px-6 py-3.5">
          {shipment.containers ? (
            <div>
              <p className="text-xs font-mono text-gray-300">{shipment.containers.container_number}</p>
              <p className="text-[11px] text-gray-500">{shipment.containers.size ? `${shipment.containers.size}' ${shipment.containers.type || ""}` : ""}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">—</p>
          )}
        </td>
        <td className="px-6 py-3.5">
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[shipment.status] || "bg-gray-500/10 text-gray-400"}`}>
            {shipment.status}
          </span>
        </td>
        <td className="px-6 py-3.5">
          {shipment.drivers ? (
            <div>
              <p className="text-sm text-gray-300">{shipment.drivers.name}</p>
              <p className="text-[11px] text-gray-500">{shipment.drivers.phone}</p>
            </div>
          ) : shipment.status === "Created" ? (
            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400">
              Needs driver
            </span>
          ) : (
            <p className="text-sm text-gray-500">—</p>
          )}
        </td>
        <td className="px-6 py-3.5">
          <p className="text-xs text-gray-400 max-w-[150px] truncate">{shipment.pickup_location || "—"}</p>
          {shipment.scheduled_pickup && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              {new Date(shipment.scheduled_pickup).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </td>
        <td className="px-6 py-3.5">
          <p className="text-xs text-gray-400 max-w-[150px] truncate">{shipment.delivery_location || "—"}</p>
          {shipment.actual_delivery && (
            <p className="text-[11px] text-emerald-400 mt-0.5">
              Delivered {new Date(shipment.actual_delivery).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </td>
      </tr>

      {/* Expanded Detail Row */}
      {expanded && (
        <tr className="bg-white/[0.01]">
          <td colSpan={8} className="px-6 py-5">
            <div className="ml-10 space-y-4">
              {/* Detail Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <DetailItem label="Reference" value={shipment.reference_number} />
                <DetailItem label="Customer" value={shipment.customers?.name || "—"} />
                <DetailItem label="Customer Phone" value={shipment.customers?.phone || "—"} />
                <DetailItem label="Customer Email" value={shipment.customers?.email || "—"} />
                <DetailItem label="Container" value={shipment.containers?.container_number || "—"} />
                <DetailItem label="BOL" value={shipment.containers?.bol_number || "—"} />
                <DetailItem label="Container Status" value={shipment.containers?.status || "—"} />
                <DetailItem
                  label="Last Free Day"
                  value={shipment.containers?.last_free_day
                    ? new Date(shipment.containers.last_free_day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "—"
                  }
                />
                <DetailItem label="Driver" value={shipment.drivers?.name || "Unassigned"} />
                <DetailItem label="Driver Phone" value={shipment.drivers?.phone || "—"} />
                <DetailItem label="Chassis" value={shipment.chassis_number || "—"} />
                <DetailItem label="Status" value={shipment.status} />
                <DetailItem label="Pickup" value={shipment.pickup_location || "—"} />
                <DetailItem
                  label="Scheduled Pickup"
                  value={shipment.scheduled_pickup
                    ? new Date(shipment.scheduled_pickup).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"
                  }
                />
                <DetailItem label="Delivery" value={shipment.delivery_location || "—"} />
                <DetailItem
                  label="Actual Delivery"
                  value={shipment.actual_delivery
                    ? new Date(shipment.actual_delivery).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"
                  }
                />
              </div>

              {/* Financial */}
              {(shipment.rate || shipment.accessorial_charges || shipment.detention_charges) && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Charges</p>
                  <div className="flex gap-6">
                    {shipment.rate && (
                      <div>
                        <p className="text-xs text-gray-500">Rate</p>
                        <p className="text-sm font-medium text-white">${shipment.rate.toLocaleString()}</p>
                      </div>
                    )}
                    {(shipment.accessorial_charges ?? 0) > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Accessorials</p>
                        <p className="text-sm font-medium text-white">${shipment.accessorial_charges?.toLocaleString()}</p>
                      </div>
                    )}
                    {(shipment.detention_charges ?? 0) > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Detention</p>
                        <p className="text-sm font-medium text-amber-400">${shipment.detention_charges?.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {shipment.notes && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-300">{shipment.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/5 flex gap-2">
                {shipment.status === "Created" && !shipment.drivers && (
                  <button
                    onClick={() => onOpenAssignModal(shipment.id, shipment.reference_number)}
                    disabled={isUpdating || availableDrivers.length === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {availableDrivers.length === 0 ? "No Drivers Available" : "Assign Driver"}
                  </button>
                )}
                {shipment.status === "Assigned" && (
                  <button
                    onClick={() => handleStatusUpdate("Dispatched")}
                    disabled={isUpdating}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? "Updating..." : "Dispatch"}
                  </button>
                )}
                {shipment.status === "Dispatched" && (
                  <button
                    onClick={() => handleStatusUpdate("In Transit")}
                    disabled={isUpdating}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#E8700A]/15 text-[#E8700A] hover:bg-[#E8700A]/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? "Updating..." : "Mark In Transit"}
                  </button>
                )}
                {shipment.status === "In Transit" && (
                  <button
                    onClick={() => handleStatusUpdate("Delivered")}
                    disabled={isUpdating}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? "Updating..." : "Mark Delivered"}
                  </button>
                )}
                {shipment.status === "Delivered" && (
                  <button
                    onClick={() => handleStatusUpdate("Completed")}
                    disabled={isUpdating}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? "Updating..." : "Complete & Invoice"}
                  </button>
                )}
                <button
                  onClick={() => onOpenEditModal(shipment)}
                  disabled={isUpdating}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Edit
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-300 mt-0.5">{value}</p>
    </div>
  )
}
