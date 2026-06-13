// components/modals/EditDriverModal.tsx
"use client"

import { useState, useEffect, useRef, useCallback } from "react"

type DriverData = {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  username: string | null
  email: string | null
  phone: string | null
  truck_number: string | null
  truck_owner: string | null
  plates: string | null
  license_number: string | null
  license_state: string | null
  license_expiry: string | null
  medical_expiry: string | null
  twic_expiry: string | null
  date_of_birth: string | null
  date_of_hire: string | null
  emergency_contact: string | null
  emergency_phone: string | null
  use_for_pre_appointments: boolean
  enabled: boolean
  status: string
  notes: string | null
  [key: string]: unknown
}

type EditDriverModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (driverId: string, updates: Record<string, unknown>) => Promise<void>
  driver: DriverData | null
}

type DriverDocument = {
  id: string
  driver_id: string
  filename: string
  url: string
  document_type: string
  file_size: number | null
  uploaded_at: string
}

const DRIVER_DOC_TYPES = ["Permit", "Insurance", "Certification", "Other"] as const

export function EditDriverModal({ isOpen, onClose, onSave, driver }: EditDriverModalProps) {
  const [formData, setFormData] = useState<Record<string, string | boolean | null>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DriverDocument[]>([])
  const [selectedDocType, setSelectedDocType] = useState<string>("Permit")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    if (!driver?.id) return
    try {
      const res = await fetch(`/api/drivers/${driver.id}/documents`)
      if (res.ok) {
        const data = await res.json()
        setDocuments(data.documents || [])
      }
    } catch { /* silent */ }
  }, [driver?.id])

  useEffect(() => {
    if (isOpen && driver?.id) fetchDocuments()
  }, [isOpen, driver?.id, fetchDocuments])

  const handleFileUpload = async (files: FileList) => {
    if (!driver?.id || files.length === 0) return
    setIsUploading(true)
    setUploadError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.size > 52428800) {
          setUploadError(`${file.name} exceeds 50MB limit`)
          continue
        }
        const fd = new FormData()
        fd.append("file", file)
        fd.append("document_type", selectedDocType)
        const res = await fetch(`/api/drivers/${driver.id}/documents`, { method: "POST", body: fd })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setUploadError(err.error || `Failed to upload ${file.name}`)
        }
      }
      await fetchDocuments()
    } catch {
      setUploadError("Upload failed")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!driver?.id || !confirm("Delete this document?")) return
    try {
      const res = await fetch(`/api/drivers/${driver.id}/documents/${docId}`, { method: "DELETE" })
      if (res.ok) await fetchDocuments()
    } catch { /* silent */ }
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—"
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  useEffect(() => {
    if (driver) {
      const firstName = driver.first_name || driver.name?.split(" ")[0] || ""
      const lastName = driver.last_name || driver.name?.split(" ").slice(1).join(" ") || ""

      setFormData({
        first_name: firstName,
        last_name: lastName,
        username: driver.username || "",
        email: driver.email || "",
        phone: driver.phone || "",
        truck_number: driver.truck_number || "",
        truck_owner: driver.truck_owner || "",
        plates: driver.plates || "",
        license_number: driver.license_number || "",
        license_state: driver.license_state || "",
        license_expiry: driver.license_expiry || "",
        medical_expiry: driver.medical_expiry || "",
        twic_expiry: driver.twic_expiry || "",
        date_of_birth: driver.date_of_birth || "",
        date_of_hire: driver.date_of_hire || "",
        emergency_contact: driver.emergency_contact || "",
        emergency_phone: driver.emergency_phone || "",
        use_for_pre_appointments: driver.use_for_pre_appointments ?? false,
        enabled: driver.enabled ?? true,
        status: driver.status || "Available",
        notes: driver.notes || "",
      })
    }
  }, [driver])

  if (!isOpen || !driver) return null

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
      const updates = {
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
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
        status: formData.status,
        notes: formData.notes || null,
      }

      await onSave(driver.id, updates)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update driver")
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
            <h3 className="text-lg font-semibold text-white">Edit Driver</h3>
            <p className="mt-1 text-sm text-gray-400">Update driver information</p>
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
                  <input type="text" required value={(formData.first_name as string) || ""} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Last Name <span className="text-red-400">*</span></label>
                  <input type="text" required value={(formData.last_name as string) || ""} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Username</label>
                  <input type="text" value={(formData.username as string) || ""} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone <span className="text-red-400">*</span></label>
                  <input type="tel" required value={(formData.phone as string) || ""} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" value={(formData.email as string) || ""} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Status</h4>
              <select
                value={(formData.status as string) || "Available"}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className={`${inputClass} appearance-none cursor-pointer`}
              >
                <option value="Available" className="bg-[#111827]">Available</option>
                <option value="On Assignment" className="bg-[#111827]">On Assignment</option>
                <option value="Off Duty" className="bg-[#111827]">Off Duty</option>
              </select>
            </div>

            {/* Truck Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Truck Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Truck #</label>
                  <input type="text" value={(formData.truck_number as string) || ""} onChange={(e) => setFormData({ ...formData, truck_number: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Truck Owner</label>
                  <input type="text" value={(formData.truck_owner as string) || ""} onChange={(e) => setFormData({ ...formData, truck_owner: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Plates</label>
                  <select value={(formData.plates as string) || ""} onChange={(e) => setFormData({ ...formData, plates: e.target.value })} className={inputClass}>
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
                  <input type="text" value={(formData.license_number as string) || ""} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>License State</label>
                  <input type="text" value={(formData.license_state as string) || ""} onChange={(e) => setFormData({ ...formData, license_state: e.target.value })} maxLength={2} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>DL Expiry</label>
                  <input type="date" value={(formData.license_expiry as string) || ""} onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Medical Card Expiry</label>
                  <input type="date" value={(formData.medical_expiry as string) || ""} onChange={(e) => setFormData({ ...formData, medical_expiry: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>TWIC Expiry</label>
                  <input type="date" value={(formData.twic_expiry as string) || ""} onChange={(e) => setFormData({ ...formData, twic_expiry: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Personal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input type="date" value={(formData.date_of_birth as string) || ""} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Date of Hire</label>
                  <input type="date" value={(formData.date_of_hire as string) || ""} onChange={(e) => setFormData({ ...formData, date_of_hire: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Contact Name</label>
                  <input type="text" value={(formData.emergency_contact as string) || ""} onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Contact Phone</label>
                  <input type="tel" value={(formData.emergency_phone as string) || ""} onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })} className={inputClass} />
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
              <textarea value={(formData.notes as string) || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Any additional information..." rows={3} className={`${inputClass} resize-none`} />
            </div>

            {/* Documents */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-300">
                Documents
                {documents.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-gray-500">{documents.length}</span>
                )}
              </h4>

              {/* Upload area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files) }}
                className={`border-2 border-dashed rounded-lg p-4 transition-colors ${isDragging ? "border-[#E8700A] bg-[#E8700A]/10" : "border-white/10 hover:border-white/20"}`}
              >
                <input ref={fileInputRef} type="file" multiple onChange={(e) => e.target.files && handleFileUpload(e.target.files)} disabled={isUploading} className="hidden" id="driver-doc-input" />
                <div className="flex items-center gap-3">
                  <select
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#E8700A]"
                  >
                    {DRIVER_DOC_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-[#111827] text-white">{t}</option>
                    ))}
                  </select>
                  <label htmlFor="driver-doc-input" className="flex-1 text-center cursor-pointer text-xs text-gray-400 hover:text-gray-300">
                    {isUploading ? "Uploading..." : "Drop files or click to upload"}
                  </label>
                </div>
              </div>

              {uploadError && (
                <p className="text-xs text-red-400">{uploadError}</p>
              )}

              {/* Document list */}
              {documents.length > 0 && (
                <div className="space-y-1.5">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-300 hover:text-[#FF8C21] truncate flex-1">
                        {doc.filename}
                      </a>
                      <span className="text-[10px] text-gray-500 flex-shrink-0">{doc.document_type}</span>
                      <span className="text-[10px] text-gray-600 flex-shrink-0">{formatFileSize(doc.file_size)}</span>
                      <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
