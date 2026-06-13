// components/modals/AddChassisModal.tsx
"use client"

import { useState } from "react"

type AddChassisModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (chassisData: Record<string, unknown>) => Promise<void>
}

export function AddChassisModal({ isOpen, onClose, onSave }: AddChassisModalProps) {
  const [formData, setFormData] = useState({
    chassis_number: "",
    chassis_owner: "",
    chassis_size: "",
    chassis_type: "Standard",
    license_number: "",
    license_state: "",
    address: "",
    vin: "",
    registration_expiry: "",
    inspection_expiry: "",
    insurance_expiry: "",
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

    if (!formData.chassis_number.trim()) {
      setError("Chassis number is required")
      setIsSubmitting(false)
      return
    }

    try {
      const chassisData = {
        chassis_number: formData.chassis_number.trim(),
        chassis_owner: formData.chassis_owner || null,
        chassis_size: formData.chassis_size || null,
        chassis_type: formData.chassis_type || "Standard",
        license_number: formData.license_number || null,
        license_state: formData.license_state || null,
        address: formData.address || null,
        vin: formData.vin || null,
        registration_expiry: formData.registration_expiry || null,
        inspection_expiry: formData.inspection_expiry || null,
        insurance_expiry: formData.insurance_expiry || null,
        enabled: formData.enabled,
        status: "Available",
        notes: formData.notes || null,
      }

      await onSave(chassisData)

      // Reset form
      setFormData({
        chassis_number: "", chassis_owner: "", chassis_size: "", chassis_type: "Standard",
        license_number: "", license_state: "", address: "", vin: "",
        registration_expiry: "", inspection_expiry: "", insurance_expiry: "",
        enabled: true, notes: "",
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chassis")
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
  const selectClass = `${inputClass} appearance-none cursor-pointer`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Add New Chassis</h3>
            <p className="mt-1 text-sm text-gray-400">Register a new chassis in the fleet</p>
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
                  <label className={labelClass}>Chassis # <span className="text-red-400">*</span></label>
                  <input type="text" required value={formData.chassis_number} onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })} placeholder="CH-001" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Chassis Owner</label>
                  <input type="text" value={formData.chassis_owner} onChange={(e) => setFormData({ ...formData, chassis_owner: e.target.value })} placeholder="Owner name or company" className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Chassis address or location" className={inputClass} />
              </div>
            </div>

            {/* Specifications */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Specifications</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Size</label>
                  <select value={formData.chassis_size} onChange={(e) => setFormData({ ...formData, chassis_size: e.target.value })} className={selectClass}>
                    <option value="" className="bg-[#111827]">Select size...</option>
                    <option value="20" className="bg-[#111827]">20</option>
                    <option value="40" className="bg-[#111827]">40</option>
                    <option value="45" className="bg-[#111827]">45</option>
                    <option value="20-40" className="bg-[#111827]">20-40</option>
                    <option value="20-FO" className="bg-[#111827]">20-FO</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Type</label>
                  <select value={formData.chassis_type} onChange={(e) => setFormData({ ...formData, chassis_type: e.target.value })} className={selectClass}>
                    <option value="Standard" className="bg-[#111827]">Standard</option>
                    <option value="Tri-Axle" className="bg-[#111827]">Tri-Axle</option>
                    <option value="Combo" className="bg-[#111827]">Combo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Registration */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Registration</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>License #</label>
                  <input type="text" value={formData.license_number} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} placeholder="License number" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input type="text" value={formData.license_state} onChange={(e) => setFormData({ ...formData, license_state: e.target.value })} placeholder="TX" maxLength={2} className={inputClass} />
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Registration Expiry</label>
                  <input type="date" value={formData.registration_expiry} onChange={(e) => setFormData({ ...formData, registration_expiry: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Inspection Expiry</label>
                  <input type="date" value={formData.inspection_expiry} onChange={(e) => setFormData({ ...formData, inspection_expiry: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Insurance Expiry</label>
                  <input type="date" value={formData.insurance_expiry} onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Settings</h4>
              <div className="space-y-3">
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
              {isSubmitting ? "Creating..." : "Create Chassis"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
