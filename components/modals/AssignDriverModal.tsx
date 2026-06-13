// components/modals/AssignDriverModal.tsx
"use client"

import { useState } from "react"

type Driver = {
  id: string
  name: string
}

type AssignDriverModalProps = {
  isOpen: boolean
  onClose: () => void
  onAssign: (driverId: string) => Promise<void>
  availableDrivers: Driver[]
  shipmentReference: string
}

export function AssignDriverModal({
  isOpen,
  onClose,
  onAssign,
  availableDrivers,
  shipmentReference,
}: AssignDriverModalProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleAssign = async () => {
    if (!selectedDriverId) {
      setError("Please select a driver")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onAssign(selectedDriverId)
      onClose()
      setSelectedDriverId("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign driver")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedDriverId("")
      setError(null)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white">Assign Driver</h3>
          <p className="mt-1 text-sm text-gray-400">
            Shipment: <span className="font-mono text-gray-300">{shipmentReference}</span>
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {availableDrivers.length === 0 ? (
            <div className="py-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
              <p className="mt-4 text-sm text-gray-400">No drivers available</p>
              <p className="mt-1 text-xs text-gray-500">
                All drivers are currently on assignment or unavailable
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Driver
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableDrivers.map((driver) => (
                    <label
                      key={driver.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedDriverId === driver.id
                          ? "bg-[#E8700A]/10 border-[#E8700A]/50 ring-2 ring-[#E8700A]/30"
                          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                      }`}
                    >
                      <input
                        type="radio"
                        name="driver"
                        value={driver.id}
                        checked={selectedDriverId === driver.id}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                            selectedDriverId === driver.id
                              ? "bg-[#E8700A]/20 text-[#FF8C21]"
                              : "bg-white/10 text-gray-400"
                          }`}
                        >
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{driver.name}</p>
                          <p className="text-xs text-gray-500">Available</p>
                        </div>
                        {selectedDriverId === driver.id && (
                          <svg
                            className="w-5 h-5 text-[#E8700A]"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          {availableDrivers.length > 0 && (
            <button
              onClick={handleAssign}
              disabled={isSubmitting || !selectedDriverId}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#E8700A] text-white hover:bg-[#FF8C21] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#E8700A]/20"
            >
              {isSubmitting ? "Assigning..." : "Assign Driver"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
