"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { invalidateOrgCache } from "./LocationSearch"

type Props = {
  open: boolean
  onClose: () => void
  onCreated: (customer: { id: string; name: string }) => void
}

export function AddCustomerModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setForm({ name: "", email: "", phone: "", address: "", city: "", state: "", zip_code: "" })
      setError(null)
      setSaving(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Customer name is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: insertError } = await supabase
        .from("customers")
        .insert({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          zip_code: form.zip_code.trim() || null,
        })
        .select("id, name")
        .single()

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }

      // Invalidate the org cache so LocationSearch picks up the new customer
      invalidateOrgCache()
      onCreated(data)
      onClose()
    } catch {
      setError("Failed to create customer")
      setSaving(false)
    }
  }

  if (!open) return null

  const inputCls = "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#1F2937] rounded-xl border border-white/10 shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Add New Customer</h3>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Company name" className={inputCls} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input type="text" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Street address" className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">City</label>
              <input type="text" value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">State</label>
              <input type="text" value={form.state} onChange={(e) => setForm(p => ({ ...p, state: e.target.value }))} maxLength={2} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ZIP</label>
              <input type="text" value={form.zip_code} onChange={(e) => setForm(p => ({ ...p, zip_code: e.target.value }))} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-gray-300 text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#E8700A] text-white text-sm font-medium hover:bg-[#FF8C21] transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Customer"}
          </button>
        </div>
      </div>
    </div>
  )
}
