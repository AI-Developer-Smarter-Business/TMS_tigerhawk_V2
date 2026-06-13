// components/dispatcher/QuickAddLoad.tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SearchableSelect } from "@/components/ui/SearchableSelect"
import { LoadType, RouteType } from "@/types/dispatcher"

type OrgOption = { id: string; name: string }

type QuickFormData = {
  load_type: LoadType | ""
  customer_id: string
  container_number: string
  pickup_location: string
  delivery_location: string
  return_location: string
  delivery_apt_from: string
  delivery_apt_to: string
  ssl: string
  mbol: string
}

const INITIAL_QUICK: QuickFormData = {
  load_type: "",
  customer_id: "",
  container_number: "",
  pickup_location: "",
  delivery_location: "",
  return_location: "",
  delivery_apt_from: "",
  delivery_apt_to: "",
  ssl: "",
  mbol: "",
}

const LOAD_TYPES: LoadType[] = ["Import", "Export", "Road", "Bill Only"]

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function QuickAddLoad({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<QuickFormData>(INITIAL_QUICK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Org data for dropdowns (fetched client-side for quick add)
  const [customers, setCustomers] = useState<OrgOption[]>([])
  const [locations, setLocations] = useState<OrgOption[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!open || loaded) return
    const supabase = createClient()

    async function fetchOrgs() {
      const [
        { data: custs },
        { data: terms },
        { data: whs },
        { data: yds },
      ] = await Promise.all([
        supabase.from("customers").select("id, name").order("name"),
        supabase.from("terminals").select("id, name").order("name"),
        supabase.from("warehouses").select("id, name").order("name"),
        supabase.from("yards").select("id, name").order("name"),
      ])

      setCustomers((custs || []) as OrgOption[])
      setLocations([
        ...(terms || []).map((t: OrgOption) => ({ id: t.id, name: `[Terminal] ${t.name}` })),
        ...(whs || []).map((w: OrgOption) => ({ id: w.id, name: `[Warehouse] ${w.name}` })),
        ...(yds || []).map((y: OrgOption) => ({ id: y.id, name: `[Yard] ${y.name}` })),
      ])
      setLoaded(true)
    }

    fetchOrgs()
  }, [open, loaded])

  const updateField = useCallback(<K extends keyof QuickFormData>(key: K, value: QuickFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!form.load_type) {
      setError("Load type is required")
      return
    }
    if (!form.customer_id) {
      setError("Customer is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      // Generate reference number
      const timestamp = Date.now().toString(36).toUpperCase()
      const random = Math.random().toString(36).substring(2, 6).toUpperCase()
      const reference_number = `TH-${timestamp}-${random}`

      // Create container if provided
      let container_id: string | null = null
      if (form.container_number.trim()) {
        const { data: container, error: containerErr } = await supabase
          .from("containers")
          .insert({
            container_number: form.container_number.trim(),
            status: "Active",
            shipping_line: form.ssl || null,
          })
          .select("id")
          .single()

        if (containerErr) {
          const { data: existing } = await supabase
            .from("containers")
            .select("id")
            .eq("container_number", form.container_number.trim())
            .single()
          container_id = existing?.id || null
        } else {
          container_id = container?.id || null
        }
      }

      const { error: loadErr } = await supabase.from("loads").insert({
        reference_number,
        status: "Created",
        load_type: form.load_type || null,
        customer_id: form.customer_id || null,
        container_id,
        pickup_location: form.pickup_location || null,
        delivery_location: form.delivery_location || null,
        return_location: form.return_location || null,
        delivery_apt_from: form.delivery_apt_from || null,
        delivery_apt_to: form.delivery_apt_to || null,
        ssl: form.ssl || null,
        mbol: form.mbol || null,
      })

      if (loadErr) {
        setError(loadErr.message)
        setSaving(false)
        return
      }

      // Reset and close
      setForm(INITIAL_QUICK)
      setSaving(false)
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create load")
      setSaving(false)
    }
  }, [form, onCreated, onClose])

  if (!open) return null

  return (
    <div className="bg-[#111827] rounded-xl border border-white/5 p-4 mb-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Quick Add Load</h3>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Load Type */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Type *</label>
          <select
            value={form.load_type}
            onChange={(e) => updateField("load_type", e.target.value as LoadType)}
            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none"
          >
            <option value="" className="bg-[#111827]">Select...</option>
            {LOAD_TYPES.map(t => (
              <option key={t} value={t} className="bg-[#111827]">{t}</option>
            ))}
          </select>
        </div>

        {/* Customer */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Customer *</label>
          <SearchableSelect
            options={customers}
            value={form.customer_id}
            onChange={(v) => updateField("customer_id", v)}
            placeholder="Search..."
          />
        </div>

        {/* Container # */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Container #</label>
          <input
            type="text"
            value={form.container_number}
            onChange={(e) => updateField("container_number", e.target.value)}
            placeholder="MSKU1234567"
            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
          />
        </div>

        {/* SSL */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">SSL</label>
          <input
            type="text"
            value={form.ssl}
            onChange={(e) => updateField("ssl", e.target.value)}
            placeholder="MAERSK"
            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
          />
        </div>

        {/* MBOL */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Master BOL</label>
          <input
            type="text"
            value={form.mbol}
            onChange={(e) => updateField("mbol", e.target.value)}
            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
          />
        </div>

        {/* Pickup Location */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Pickup</label>
          <SearchableSelect
            options={locations}
            value={form.pickup_location}
            onChange={(v) => updateField("pickup_location", v)}
            placeholder="Search..."
            allowFreeText
          />
        </div>

        {/* Delivery Location */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Delivery</label>
          <SearchableSelect
            options={locations}
            value={form.delivery_location}
            onChange={(v) => updateField("delivery_location", v)}
            placeholder="Search..."
            allowFreeText
          />
        </div>

        {/* Return Location */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Return</label>
          <SearchableSelect
            options={locations}
            value={form.return_location}
            onChange={(v) => updateField("return_location", v)}
            placeholder="Search..."
            allowFreeText
          />
        </div>

        {/* Delivery Appt From */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Del Appt From</label>
          <input
            type="datetime-local"
            value={form.delivery_apt_from}
            onChange={(e) => updateField("delivery_apt_from", e.target.value)}
            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
          />
        </div>

        {/* Delivery Appt To */}
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Del Appt To</label>
          <input
            type="datetime-local"
            value={form.delivery_apt_to}
            onChange={(e) => updateField("delivery_apt_to", e.target.value)}
            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-1.5 bg-[#E8700A] rounded-lg text-xs font-medium text-white hover:bg-[#E8700A]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {saving ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : (
            "Create Load"
          )}
        </button>
      </div>
    </div>
  )
}
