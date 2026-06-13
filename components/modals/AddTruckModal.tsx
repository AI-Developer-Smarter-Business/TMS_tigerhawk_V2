// components/modals/AddTruckModal.tsx
"use client"

import { useState } from "react"

type AddTruckModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (truckData: Record<string, unknown>) => Promise<void>
}

export function AddTruckModal({ isOpen, onClose, onSave }: AddTruckModalProps) {
  const [formData, setFormData] = useState({
    truck_number: "",
    truck_owner: "",
    license_plate: "",
    license_plate_state: "",
    vin: "",
    address: "",
    registration_expiry: "",
    inspection_expiry: "",
    annual_inspection_expiry: "",
    insurance_expiry: "",
    engine_family: "",
    has_sleeper: false,
    use_for_pre_appointments: false,
    enabled: true,
    notes: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (!formData.truck_number.trim()) {
      setError("Truck number is required")
      setIsSubmitting(false)
      return
    }

    try {
      const truckData = {
        truck_number: formData.truck_number.trim(),
        truck_owner: formData.truck_owner || null,
        license_plate: formData.license_plate || null,
        license_plate_state: formData.license_plate_state || null,
        vin: formData.vin || null,
        address: formData.address || null,
        registration_expiry: formData.registration_expiry || null,
        inspection_expiry: formData.inspection_expiry || null,
        annual_inspection_expiry: formData.annual_inspection_expiry || null,
        insurance_expiry: formData.insurance_expiry || null,
        engine_family: formData.engine_family || null,
        has_sleeper: formData.has_sleeper,
        use_for_pre_appointments: formData.use_for_pre_appointments,
        enabled: formData.enabled,
        status: "Available",
        notes: formData.notes || null,
      }

      await onSave(truckData)

      // Reset form
      setFormData({
        truck_number: "", truck_owner: "", license_plate: "", license_plate_state: "",
        vin: "", address: "", registration_expiry: "", inspection_expiry: "",
        annual_inspection_expiry: "", insurance_expiry: "", engine_family: "",
        has_sleeper: false, use_for_pre_appointments: false, enabled: true, notes: "",
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create truck")
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

  const inputClass = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Add New Truck</h3>
            <p className="mt-1 text-sm text-gray-400">Register a new truck in the fleet</p>
          </div>
          <button onClick={handleClose} disabled={isSubmitting} className="text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {/* Identification */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Identification</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Truck # <span className="text-red-400">*</span></label>
                  <input type="text" required value={formData.truck_number} onChange={(e) => setFormData({ ...formData, truck_number: e.target.value })} placeholder="T-101" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Truck Owner</label>
                  <input type="text" value={formData.truck_owner} onChange={(e) => setFormData({ ...formData, truck_owner: e.target.value })} placeholder="Owner name or company" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Truck address or location" className={inputClass} />
              </div>
            </div>

            {/* Registration */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Registration</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>License Plate #</label>
                  <input type="text" value={formData.license_plate} onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })} placeholder="ABC-1234" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input type="text" value={formData.license_plate_state} onChange={(e) => setFormData({ ...formData, license_plate_state: e.target.value })} placeholder="TX" maxLength={2} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>VIN</label>
                  <input type="text" value={formData.vin} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} placeholder="Vehicle Identification Number" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Compliance Dates */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Compliance & Expiry Dates</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Registration Expiry</label>
                  <input type="date" value={formData.registration_expiry} onChange={(e) => setFormData({ ...formData, registration_expiry: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Inspection Expiry</label>
                  <input type="date" value={formData.inspection_expiry} onChange={(e) => setFormData({ ...formData, inspection_expiry: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Annual Inspection Expiry</label>
                  <input type="date" value={formData.annual_inspection_expiry} onChange={(e) => setFormData({ ...formData, annual_inspection_expiry: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Insurance Expiry</label>
                  <input type="date" value={formData.insurance_expiry} onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Equipment Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Equipment Details</h4>
              <div>
                <label className={labelClass}>Engine Family</label>
                <input type="text" value={formData.engine_family} onChange={(e) => setFormData({ ...formData, engine_family: e.target.value })} placeholder="e.g. Cummins ISX15" className={inputClass} />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Settings</h4>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`relative w-10 h-6 rounded-full transition-colors ${formData.has_sleeper ? "bg-emerald-500" : "bg-gray-600"}`}
                    onClick={() => setFormData({ ...formData, has_sleeper: !formData.has_sleeper })}>
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${formData.has_sleeper ? "translate-x-4" : ""}`} />
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Has Sleeper</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`relative w-10 h-6 rounded-full transition-colors ${formData.use_for_pre_appointments ? "bg-emerald-500" : "bg-gray-600"}`}
                    onClick={() => setFormData({ ...formData, use_for_pre_appointments: !formData.use_for_pre_appointments })}>
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${formData.use_for_pre_appointments ? "translate-x-4" : ""}`} />
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Use for Pre-Appointments</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`relative w-10 h-6 rounded-full transition-colors ${formData.enabled ? "bg-emerald-500" : "bg-gray-600"}`}
                    onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}>
                    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${formData.enabled ? "translate-x-4" : ""}`} />
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Enabled</span>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Notes</h4>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional information..." rows={3} className={`${inputClass} resize-none`} />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">
            <button type="button" onClick={handleClose} disabled={isSubmitting} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#E8700A] text-white hover:bg-[#FF8C21] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#E8700A]/20">
              {isSubmitting ? "Creating..." : "Create Truck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
