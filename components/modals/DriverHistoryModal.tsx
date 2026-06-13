// components/modals/DriverHistoryModal.tsx
"use client"

type Shipment = {
  id: string
  reference_number: string
  status: string
  pickup_location: string | null
  delivery_location: string | null
  scheduled_pickup: string | null
}

type DriverData = {
  id: string
  name: string
  shipments?: Shipment[]
  [key: string]: unknown
}

type DriverHistoryModalProps = {
  isOpen: boolean
  onClose: () => void
  driver: DriverData | null
}

export function DriverHistoryModal({ isOpen, onClose, driver }: DriverHistoryModalProps) {
  if (!isOpen || !driver) return null

  const allShipments = driver.shipments || []
  const activeShipments = allShipments.filter((s) =>
    ["Assigned", "Dispatched", "In Transit"].includes(s.status)
  )
  const completedShipments = allShipments.filter((s) => s.status === "Completed")
  const deliveredShipments = allShipments.filter((s) => s.status === "Delivered")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Assignment History</h3>
            <p className="mt-1 text-sm text-gray-400">
              {driver.name}'s shipment history ({allShipments.length} total)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
          {allShipments.length === 0 ? (
            <div className="py-12 text-center">
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
                  d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                />
              </svg>
              <p className="mt-4 text-sm text-gray-400">No shipments assigned yet</p>
              <p className="mt-1 text-xs text-gray-500">
                This driver hasn't been assigned to any shipments
              </p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#E8700A]/10 border border-[#E8700A]/20 rounded-lg px-4 py-3">
                  <p className="text-2xl font-bold text-[#FF8C21]">{activeShipments.length}</p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Active</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
                  <p className="text-2xl font-bold text-emerald-400">{deliveredShipments.length}</p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Delivered</p>
                </div>
                <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg px-4 py-3">
                  <p className="text-2xl font-bold text-gray-400">{completedShipments.length}</p>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-1">Completed</p>
                </div>
              </div>

              {/* Active Shipments */}
              {activeShipments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Active Shipments</h4>
                  <div className="space-y-2">
                    {activeShipments.map((shipment) => (
                      <ShipmentCard key={shipment.id} shipment={shipment} isActive />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Shipments */}
              {(completedShipments.length > 0 || deliveredShipments.length > 0) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Past Shipments</h4>
                  <div className="space-y-2">
                    {[...deliveredShipments, ...completedShipments].map((shipment) => (
                      <ShipmentCard key={shipment.id} shipment={shipment} isActive={false} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ShipmentCard({ shipment, isActive }: { shipment: Shipment; isActive: boolean }) {
  const statusStyles: Record<string, string> = {
    Assigned: "bg-blue-500/10 text-blue-400",
    Dispatched: "bg-purple-500/10 text-purple-400",
    "In Transit": "bg-[#E8700A]/15 text-[#FF8C21]",
    Delivered: "bg-emerald-500/10 text-emerald-400",
    Completed: "bg-gray-500/10 text-gray-400",
  }

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        isActive
          ? "bg-white/5 border-white/10 hover:bg-white/[0.07]"
          : "bg-white/[0.02] border-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-mono font-medium text-gray-200">{shipment.reference_number}</p>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                statusStyles[shipment.status] || "bg-gray-500/10 text-gray-400"
              }`}
            >
              {shipment.status}
            </span>
          </div>
          {(shipment.pickup_location || shipment.delivery_location) && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="truncate">{shipment.pickup_location || "—"}</span>
              <svg className="w-3 h-3 flex-shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              <span className="truncate">{shipment.delivery_location || "—"}</span>
            </div>
          )}
          {shipment.scheduled_pickup && (
            <p className="text-xs text-gray-500 mt-1">
              Scheduled: {new Date(shipment.scheduled_pickup).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
