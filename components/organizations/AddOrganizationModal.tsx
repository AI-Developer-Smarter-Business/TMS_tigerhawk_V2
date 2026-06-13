// components/organizations/AddOrganizationModal.tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

type OrgType = "customer" | "terminal" | "warehouse" | "yard"

type FormData = {
  // Types (which tables to insert into)
  types: Set<OrgType>
  // Company
  name: string
  address: string
  city: string
  state: string
  zip_code: string
  country: string
  phone: string
  // Contact
  main_contact_name: string
  main_phone: string
  secondary_contact_name: string
  secondary_phone: string
  office_hours_start: string
  office_hours_end: string
  // Email
  email: string
  billing_email: string
  // Payment
  credit_limit: string
  account_hold: boolean
  credit_hold: boolean
  currency: string
  default_payment_terms: string
  // Org meta
  customer_type: string
  notes: string
}

const INITIAL: FormData = {
  types: new Set<OrgType>(["customer"]),
  name: "", address: "", city: "", state: "", zip_code: "", country: "US", phone: "",
  main_contact_name: "", main_phone: "", secondary_contact_name: "", secondary_phone: "",
  office_hours_start: "", office_hours_end: "",
  email: "", billing_email: "",
  credit_limit: "", account_hold: false, credit_hold: false, currency: "USD", default_payment_terms: "30",
  customer_type: "", notes: "",
}

const ORG_TYPE_OPTIONS: { key: OrgType; label: string }[] = [
  { key: "customer", label: "Customer" },
  { key: "terminal", label: "Terminal" },
  { key: "warehouse", label: "Warehouse" },
  { key: "yard", label: "Yard" },
]

const CUSTOMER_TYPE_OPTIONS = [
  "caller", "consignee", "shipper", "containerReturn",
  "chassisTermination", "chassisPick", "ALL",
]

const CURRENCY_OPTIONS = ["USD", "CAD", "EUR", "GBP", "MXN"]

const STATE_OPTIONS = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]

const inputCls = "w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
const selectCls = "w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none"
const labelCls = "block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1"

function SH({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-1.5 mb-3 mt-5 first:mt-0">{title}</h3>
}

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
  /** Optional: called with the first created org's id and name (for customer selection flows) */
  onCreatedWithId?: (data: { id: string; name: string }) => void
  /** Optional: pre-select org types when opening (e.g., ["customer"] for Add New Customer) */
  defaultTypes?: OrgType[]
}

export function AddOrganizationModal({ open, onClose, onCreated, onCreatedWithId, defaultTypes }: Props) {
  const [form, setForm] = useState<FormData>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const u = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleType = useCallback((t: OrgType) => {
    setForm(prev => {
      const next = new Set(prev.types)
      if (next.has(t)) {
        if (next.size > 1) next.delete(t) // must keep at least one
      } else {
        next.add(t)
      }
      return { ...prev, types: next }
    })
  }, [])

  const toggleAll = useCallback(() => {
    setForm(prev => {
      const allSelected = prev.types.size === 4
      return {
        ...prev,
        types: allSelected
          ? new Set<OrgType>(["customer"])
          : new Set<OrgType>(["customer", "terminal", "warehouse", "yard"]),
      }
    })
  }, [])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Reset on close/open
  useEffect(() => {
    if (!open) {
      setForm(INITIAL)
      setError(null)
      setSaving(false)
    } else if (defaultTypes && defaultTypes.length > 0) {
      // Apply default types when opening
      setForm(prev => ({ ...prev, types: new Set(defaultTypes) }))
    }
  }, [open, defaultTypes])

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) { setError("Company name is required"); return }
    if (form.types.size === 0) { setError("Select at least one organization type"); return }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      const record = {
        name: form.name.trim(),
        phone: form.phone || null,
        main_contact_name: form.main_contact_name || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        customer_type: form.customer_type || null,
        credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
        default_payment_terms: form.default_payment_terms ? parseInt(form.default_payment_terms) : null,
        credit_hold: form.credit_hold,
        account_hold: form.account_hold,
        currency: form.currency || "USD",
      }

      // Insert into each selected table
      const tables = Array.from(form.types).map(t => {
        switch (t) {
          case "customer": return "customers"
          case "terminal": return "terminals"
          case "warehouse": return "warehouses"
          case "yard": return "yards"
        }
      })

      const results = await Promise.all(
        tables.map(table => supabase.from(table).insert(record).select("id, name").single())
      )

      const firstError = results.find(r => r.error)
      if (firstError?.error) {
        setError(firstError.error.message)
        setSaving(false)
        return
      }

      // If onCreatedWithId callback provided, return the first result's id/name
      if (onCreatedWithId && results[0]?.data) {
        onCreatedWithId({ id: results[0].data.id, name: results[0].data.name })
      }

      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization")
      setSaving(false)
    }
  }, [form, onCreated, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative mt-8 mb-8 w-full max-w-3xl max-h-[calc(100vh-64px)] bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Add Organization</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex-shrink-0">
            {error}
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Type checkboxes */}
          <div className="flex items-center gap-4 mb-5">
            {ORG_TYPE_OPTIONS.map(opt => (
              <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.types.has(opt.key)}
                  onChange={() => toggleType(opt.key)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#E8700A]"
                />
                <span className="text-sm text-gray-300">{opt.label}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={form.types.size === 4}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#E8700A]"
              />
              <span className="text-sm text-gray-400">ALL</span>
            </label>
          </div>

          {/* Company */}
          <SH title="Company" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Company Name *</label>
              <input type="text" value={form.name} onChange={(e) => u("name", e.target.value)} placeholder="Company Name" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input type="text" value={form.address} onChange={(e) => u("address", e.target.value)} placeholder="Street Address" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input type="text" value={form.city} onChange={(e) => u("city", e.target.value)} placeholder="City" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State</label>
              <select value={form.state} onChange={(e) => u("state", e.target.value)} className={selectCls}>
                <option value="" className="bg-[#111827]">Select...</option>
                {STATE_OPTIONS.map(s => <option key={s} value={s} className="bg-[#111827]">{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Zip Code</label>
              <input type="text" value={form.zip_code} onChange={(e) => u("zip_code", e.target.value)} placeholder="Zip Code" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <select value={form.country} onChange={(e) => u("country", e.target.value)} className={selectCls}>
                <option value="US" className="bg-[#111827]">US</option>
                <option value="CA" className="bg-[#111827]">CA</option>
                <option value="MX" className="bg-[#111827]">MX</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => u("phone", e.target.value)} placeholder="Phone" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Organization Type</label>
              <select
                value={form.customer_type}
                onChange={(e) => u("customer_type", e.target.value)}
                className={selectCls}
              >
                <option value="" className="bg-[#111827]">Select...</option>
                {CUSTOMER_TYPE_OPTIONS.map(t => <option key={t} value={t} className="bg-[#111827]">{t}</option>)}
              </select>
            </div>
          </div>

          {/* Email */}
          <SH title="Email" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={(e) => u("email", e.target.value)} placeholder="Email" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Billing Email</label>
              <input type="email" value={form.billing_email} onChange={(e) => u("billing_email", e.target.value)} placeholder="Billing Email" className={inputCls} />
            </div>
          </div>

          {/* Contact */}
          <SH title="Contact" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Main Contact Name</label>
              <input type="text" value={form.main_contact_name} onChange={(e) => u("main_contact_name", e.target.value)} placeholder="Main Contact" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Main Phone</label>
              <input type="tel" value={form.main_phone} onChange={(e) => u("main_phone", e.target.value)} placeholder="Phone" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Secondary Contact</label>
              <input type="text" value={form.secondary_contact_name} onChange={(e) => u("secondary_contact_name", e.target.value)} placeholder="Secondary Contact" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Secondary Phone</label>
              <input type="tel" value={form.secondary_phone} onChange={(e) => u("secondary_phone", e.target.value)} placeholder="Phone" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Office Hours Start</label>
              <input type="time" value={form.office_hours_start} onChange={(e) => u("office_hours_start", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Office Hours End</label>
              <input type="time" value={form.office_hours_end} onChange={(e) => u("office_hours_end", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Payment */}
          <SH title="Payment" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>Credit Limit ($)</label>
              <input type="number" value={form.credit_limit} onChange={(e) => u("credit_limit", e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Account Hold</label>
              <select
                value={form.account_hold ? "yes" : "no"}
                onChange={(e) => u("account_hold", e.target.value === "yes")}
                className={selectCls}
              >
                <option value="no" className="bg-[#111827]">No</option>
                <option value="yes" className="bg-[#111827]">Yes</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select value={form.currency} onChange={(e) => u("currency", e.target.value)} className={selectCls}>
                {CURRENCY_OPTIONS.map(c => <option key={c} value={c} className="bg-[#111827]">{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment Terms (days)</label>
              <input type="number" value={form.default_payment_terms} onChange={(e) => u("default_payment_terms", e.target.value)} placeholder="30" className={inputCls} />
            </div>
          </div>

          {/* Notes */}
          <SH title="Notes" />
          <textarea
            value={form.notes}
            onChange={(e) => u("notes", e.target.value)}
            rows={2}
            placeholder="Additional notes..."
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-white/5 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#E8700A]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Adding...
              </>
            ) : "Add New Organization"}
          </button>
        </div>
      </div>
    </div>
  )
}
