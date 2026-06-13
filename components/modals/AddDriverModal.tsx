// components/modals/AddDriverModal.tsx
"use client"

import { useState } from "react"

type AddDriverModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (driverData: Record<string, unknown>) => Promise<void>
}

export function AddDriverModal({ isOpen, onClose, onSave }: AddDriverModalProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
    truck_number: "",
    truck_owner: "",
    plates: "",
    license_number: "",
    license_state: "",
    license_expiry: "",
    medical_expiry: "",
    twic_expiry: "",
    date_of_birth: "",
    date_of_hire: "",
    emergency_contact: "",
    emergency_phone: "",
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

    if (!formData.first_name || !formData.last_name || !formData.phone) {
      setError("First name, last name, and phone are required")
      setIsSubmitting(false)
      return
    }

    try {
      const driverData = {
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username || null,
        email: formData.email || null,
        phone: formData.phone,
        truck_number: formData.truck_number || null,
        truck_owner: formData.truck_owner || null,
        plates: formData.plates || null,
        license_number: formData.license_number || null,
        license_state: formData.license_state || null,
        license_expiry: formData.license_expiry || null,
        medical_expiry: formData.medical_expiry || null,
        twic_expiry: formData.twic_expiry || null,
        date_of_birth: formData.date_of_birth || null,
        date_of_hire: formData.date_of_hire || null,
        emergency_contact: formData.emergency_contact || null,
        emergency_phone: formData.emergency_phone || null,
        use_for_pre_appointments: formData.use_for_pre_appointments,
        enabled: formData.enabled,
        status: "Available",
        notes: formData.notes || null,
      }

      await onSave(driverData)

      // Reset form
      setFormData({
        first_name: "", last_name: "", username: "", email: "", phone: "",
        truck_number: "", truck_owner: "", plates: "", license_number: "", license_state: "",
        license_expiry: "", medical_expiry: "", twic_expiry: "", date_of_birth: "",
        date_of_hire: "", emergency_contact: "", emergency_phone: "",
        use_for_pre_appointments: false, enabled: true, notes: "",
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create driver")
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
            <h3 className="text-lg font-semibold text-white">Add New Driver</h3>
            <p className="mt-1 text-sm text-gray-400">Create a new driver profile</p>
          </div>
          <button onClick={handleClose} disabled={isSubmitting} className="text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Basic Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>First Name <span className="text-red-400">*</span></label>
                  <input type="text" required value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} placeholder="John" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Last Name <span className="text-red-400">*</span></label>
                  <input type="text" required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} placeholder="Smith" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Username</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="jsmith" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone <span className="text-red-400">*</span></label>
                  <input type="tel" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(555) 123-4567" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john.smith@example.com" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Truck Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Truck Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Truck #</label>
                  <input type="text" value={formData.truck_number} onChange={(e) => setFormData({ ...formData, truck_number: e.target.value })} placeholder="T-101" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Truck Owner</label>
                  <input type="text" value={formData.truck_owner} onChange={(e) => setFormData({ ...formData, truck_owner: e.target.value })} placeholder="Company name or owner" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Plates</label>
                  <select value={formData.plates} onChange={(e) => setFormData({ ...formData, plates: e.target.value })} className={inputClass}>
                    <option value="" className="bg-[#111827] text-white">—</option>
                    <option value="Standard" className="bg-[#111827] text-white">Standard</option>
                    <option value="Combo" className="bg-[#111827] text-white">Combo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* License & Compliance */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">License & Compliance</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>License Number</label>
                  <input type="text" value={formData.license_number} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} placeholder="DL12345678" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>License State</label>
                  <input type="text" value={formData.license_state} onChange={(e) => setFormData({ ...formData, license_state: e.target.value })} placeholder="CA" maxLength={2} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>DL Expiry</label>
                  <input type="date" value={formData.license_expiry} onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Medical Card Expiry</label>
                  <input type="date" value={formData.medical_expiry} onChange={(e) => setFormData({ ...formData, medical_expiry: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>TWIC Expiry</label>
                  <input type="date" value={formData.twic_expiry} onChange={(e) => setFormData({ ...formData, twic_expiry: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Date of Hire</label>
                  <input type="date" value={formData.date_of_hire} onChange={(e) => setFormData({ ...formData, date_of_hire: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Contact Name</label>
                  <input type="text" value={formData.emergency_contact} onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })} placeholder="Jane Smith" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Contact Phone</label>
                  <input type="tel" value={formData.emergency_phone} onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })} placeholder="(555) 987-6543" className={inputClass} />
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Settings</h4>
              <div className="space-y-3">
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
              {isSubmitting ? "Creating..." : "Create Driver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
