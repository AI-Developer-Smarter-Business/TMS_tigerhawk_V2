// components/modals/EditShipmentModal.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type ShipmentStatus =
  | "Created"
  | "Assigned"
  | "Dispatched"
  | "In Transit"
  | "At Warehouse"
  | "Delivered"
  | "Completed"
  | "Cancelled"

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  Created: ["Assigned", "Cancelled"],
  Assigned: ["Dispatched", "Created", "Cancelled"],
  Dispatched: ["In Transit", "Assigned", "Cancelled"],
  "In Transit": ["At Warehouse", "Delivered", "Dispatched", "Cancelled"],
  "At Warehouse": ["In Transit", "Delivered", "Cancelled"],
  Delivered: ["Completed", "In Transit", "Cancelled"],
  Completed: [],
  Cancelled: [],
}

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  Created: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  Assigned: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Dispatched: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "In Transit": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "At Warehouse": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  Delivered: "bg-green-500/20 text-green-300 border-green-500/30",
  Completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
}

type ShipmentData = {
  id: string
  reference_number: string
  status: string
  pickup_location: string | null
  delivery_location: string | null
  chassis_number: string | null
  scheduled_pickup: string | null
  rate: number | null
  accessorial_charges: number | null
  detention_charges: number | null
  notes: string | null
  driver_id?: string | null
  drivers?: { id: string } | null
  // Allow additional fields from ShipmentTable type
  [key: string]: unknown
}

type EditShipmentModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (shipmentId: string, updates: Partial<ShipmentData>) => Promise<void>
  onStatusChange: (shipmentId: string, newStatus: string) => Promise<void>
  shipment: ShipmentData | null
  availableDrivers: { id: string; name: string }[]
}

export function EditShipmentModal({
  isOpen,
  onClose,
  onSave,
  onStatusChange,
  shipment,
  availableDrivers,
}: EditShipmentModalProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<Partial<ShipmentData>>({})
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize form data when shipment changes
  useEffect(() => {
    if (shipment) {
      // Get driver_id from either direct property or nested drivers object
      const driverId = shipment.driver_id || shipment.drivers?.id || ""

      setFormData({
        pickup_location: shipment.pickup_location || "",
        delivery_location: shipment.delivery_location || "",
        chassis_number: shipment.chassis_number || "",
        scheduled_pickup: shipment.scheduled_pickup
          ? new Date(shipment.scheduled_pickup).toISOString().slice(0, 16)
          : "",
        rate: shipment.rate ?? null,
        accessorial_charges: shipment.accessorial_charges ?? null,
        detention_charges: shipment.detention_charges ?? null,
        notes: shipment.notes || "",
        driver_id: driverId,
      })
      setSelectedStatus(shipment.status || "")
    }
  }, [shipment])

  if (!isOpen || !shipment) return null

  const currentStatus = (shipment.status || "Created") as ShipmentStatus
  const validNextStatuses = VALID_TRANSITIONS[currentStatus] || []
  const statusChanged = selectedStatus !== shipment.status

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // If status was changed, call the status endpoint first
      if (statusChanged) {
        await onStatusChange(shipment.id, selectedStatus)
      }

      // Convert empty strings to null for optional fields
      const updates: Partial<ShipmentData> = {
        pickup_location: formData.pickup_location || null,
        delivery_location: formData.delivery_location || null,
        chassis_number: formData.chassis_number || null,
        scheduled_pickup: formData.scheduled_pickup || null,
        rate: formData.rate || null,
        accessorial_charges: formData.accessorial_charges || null,
        detention_charges: formData.detention_charges || null,
        notes: formData.notes || null,
        driver_id: formData.driver_id || null,
      }

      // Only call onSave if there are non-status field changes
      const hasFieldChanges = Object.entries(updates).some(([key, value]) => {
        const original = shipment[key]
        // Normalize both sides: treat empty string, null, undefined as equivalent
        const normalizedValue = value === "" ? null : value
        const normalizedOriginal = original === "" || original === undefined ? null : original
        return normalizedValue !== normalizedOriginal
      })

      if (hasFieldChanges) {
        await onSave(shipment.id, updates)
      }

      onClose()
      // Refresh if status changed (even if no other field changes)
      if (statusChanged && !hasFieldChanges) {
        router.refresh()
      } else if (hasFieldChanges) {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update shipment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-2xl w-full my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Edit Shipment</h3>
            <p className="mt-1 text-sm text-gray-400">
              Reference: <span className="font-mono text-gray-300">{shipment.reference_number}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {/* Status */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Status</h4>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[currentStatus] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
                  {currentStatus}
                </span>
                {validNextStatuses.length > 0 ? (
                  <>
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50 appearance-none cursor-pointer"
                    >
                      <option value={currentStatus} className="bg-[#111827]">
                        {currentStatus} (current)
                      </option>
                      {validNextStatuses.map((s) => (
                        <option key={s} value={s} className="bg-[#111827]">
                          {s}
                        </option>
                      ))}
                    </select>
                    {statusChanged && (
                      <span className="text-xs text-[#FF8C21] font-medium">
                        Will update to {selectedStatus}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-500 italic">
                    Terminal status — no further transitions available
                  </span>
                )}
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Locations</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Pickup Location
                  </label>
                  <input
                    type="text"
                    value={formData.pickup_location || ""}
                    onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
                    placeholder="123 Port St, Los Angeles, CA"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Delivery Location
                  </label>
                  <input
                    type="text"
                    value={formData.delivery_location || ""}
                    onChange={(e) => setFormData({ ...formData, delivery_location: e.target.value })}
                    placeholder="456 Warehouse Rd, Ontario, CA"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                  />
                </div>
              </div>
            </div>

            {/* Schedule & Equipment */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Schedule & Equipment</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Scheduled Pickup
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_pickup || ""}
                    onChange={(e) => setFormData({ ...formData, scheduled_pickup: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Chassis Number
                  </label>
                  <input
                    type="text"
                    value={formData.chassis_number || ""}
                    onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
                    placeholder="CHSS123456"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                  />
                </div>
              </div>
            </div>

            {/* Driver Assignment */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Driver (Optional)</h4>
              <select
                value={formData.driver_id || ""}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50 appearance-none cursor-pointer"
              >
                <option value="" className="bg-[#111827]">No driver assigned</option>
                {availableDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id} className="bg-[#111827]">
                    {driver.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                Note: Changing the driver here won't update the shipment status
              </p>
            </div>

            {/* Financial */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Charges</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Rate ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.rate ?? ""}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="500.00"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Accessorial Charges ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.accessorial_charges ?? ""}
                    onChange={(e) => setFormData({ ...formData, accessorial_charges: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="50.00"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Detention Charges ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.detention_charges ?? ""}
                    onChange={(e) => setFormData({ ...formData, detention_charges: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="75.00"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Notes</h4>
              <textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any special instructions or notes..."
                rows={3}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50 resize-none"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#E8700A] text-white hover:bg-[#FF8C21] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#E8700A]/20"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
