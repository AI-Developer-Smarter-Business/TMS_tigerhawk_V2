// components/dispatcher/NewLoadModal.tsx
"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LoadType, RouteType, LoadStatus } from "@/types/dispatcher"
import { SearchableSelect } from "@/components/ui/SearchableSelect"
import { AddOrganizationModal } from "@/components/organizations/AddOrganizationModal"
import { invalidateOrgCache } from "@/components/dispatcher/LocationSearch"

type OrgOption = { id: string; name: string }

type FormData = {
  load_type: LoadType | ""
  route_type: RouteType | ""
  customer_id: string
  driver_id: string
  container_number: string
  container_size: string
  container_type: string
  seal_number: string
  ssl: string
  mbol: string
  house_bol: string
  vessel_name: string
  voyage: string
  vessel_eta: string
  pickup_location: string
  delivery_location: string
  return_location: string
  pickup_apt_from: string
  pickup_apt_to: string
  delivery_apt_from: string
  delivery_apt_to: string
  return_apt_from: string
  return_apt_to: string
  per_diem_free_day: string
  chassis_number: string
  genset_number: string
  temperature: string
  scac: string
  total_weight: string
  commodity: string
  purchase_order: string
  shipment_number: string
  pickup_number: string
  appointment_number: string
  return_number: string
  reservation_number: string
  is_hazmat: boolean
  is_hot: boolean
  is_overweight: boolean
  is_oog: boolean
  is_street_turn: boolean
  is_tanker: boolean
  is_bonded: boolean
  is_liquor: boolean
  is_ev: boolean
  is_double: boolean
  is_genset: boolean
  is_scale: boolean
  is_overheight: boolean
  rate: string
  accessorial_charges: string
  detention_charges: string
  driver_pay: string
  driver_pay_notes: string
  notes: string
}

const INITIAL_FORM: FormData = {
  load_type: "", route_type: "", customer_id: "", driver_id: "",
  container_number: "", container_size: "", container_type: "", seal_number: "",
  ssl: "", mbol: "", house_bol: "", vessel_name: "", voyage: "", vessel_eta: "",
  pickup_location: "", delivery_location: "", return_location: "",
  pickup_apt_from: "", pickup_apt_to: "", delivery_apt_from: "", delivery_apt_to: "",
  return_apt_from: "", return_apt_to: "", per_diem_free_day: "",
  chassis_number: "", genset_number: "", temperature: "", scac: "",
  total_weight: "", commodity: "",
  purchase_order: "", shipment_number: "", pickup_number: "",
  appointment_number: "", return_number: "", reservation_number: "",
  is_hazmat: false, is_hot: false, is_overweight: false, is_oog: false,
  is_street_turn: false, is_tanker: false, is_bonded: false, is_liquor: false,
  is_ev: false, is_double: false, is_genset: false, is_scale: false, is_overheight: false,
  rate: "", accessorial_charges: "", detention_charges: "",
  driver_pay: "", driver_pay_notes: "", notes: "",
}

const LOAD_TYPES: LoadType[] = ["Import", "Export", "Road", "Bill Only"]
const ROUTE_TYPES: RouteType[] = [
  "Pick and Run + Live", "Pick and Run + Drop & Hook",
  "Prepull + Live", "Prepull + Drop & Hook", "One Way Move", "Shunt",
]
const CONTAINER_SIZES = ["20", "40", "45", "53"]
const CONTAINER_TYPES = ["HC", "ST", "RF", "OT", "FR", "TK"]

function SH({ title }: { title: string }) {
  return <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-1.5 mb-3 mt-5 first:mt-0">{title}</h3>
}

function F({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : span === 3 ? "sm:col-span-3" : ""}>
      <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
const selectCls = "w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 appearance-none"

type Props = {
  open: boolean
  onClose: () => void
}

export function NewLoadModal({ open, onClose }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Org data fetched client-side
  const [customers, setCustomers] = useState<OrgOption[]>([])
  const [drivers, setDrivers] = useState<OrgOption[]>([])
  const [terminals, setTerminals] = useState<OrgOption[]>([])
  const [warehouses, setWarehouses] = useState<OrgOption[]>([])
  const [yards, setYards] = useState<OrgOption[]>([])
  const [orgLoaded, setOrgLoaded] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)

  useEffect(() => {
    if (!open || orgLoaded) return
    const supabase = createClient()
    Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("terminals").select("id, name").order("name"),
      supabase.from("warehouses").select("id, name").order("name"),
      supabase.from("yards").select("id, name").order("name"),
      supabase
        .from("drivers")
        .select("id, name, status")
        .neq("enabled", false)
        .not("status", "in", '("Inactive","Terminated")')
        .order("name"),
    ]).then(([c, t, w, y, d]) => {
      setCustomers((c.data || []) as OrgOption[])
      setTerminals((t.data || []) as OrgOption[])
      setWarehouses((w.data || []) as OrgOption[])
      setYards((y.data || []) as OrgOption[])
      setDrivers(
        ((d.data || []) as { id: string; name: string; status: string }[]).map((driver) => ({
          id: driver.id,
          name:
            driver.status !== "Available"
              ? `${driver.name} (${driver.status})`
              : driver.name,
        })),
      )
      setOrgLoaded(true)
    })
  }, [open, orgLoaded])

  const locationOptions = useMemo(() => [
    ...terminals.map(t => ({ id: t.id, name: `[Terminal] ${t.name}` })),
    ...warehouses.map(w => ({ id: w.id, name: `[Warehouse] ${w.name}` })),
    ...yards.map(y => ({ id: y.id, name: `[Yard] ${y.name}` })),
  ], [terminals, warehouses, yards])

  const u = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM)
      setError(null)
      setSaving(false)
      setOrgLoaded(false)
    }
  }, [open])

  const handleSubmit = useCallback(async () => {
    if (!form.load_type) { setError("Load type is required"); return }
    if (!form.customer_id) { setError("Customer is required"); return }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const timestamp = Date.now().toString(36).toUpperCase()
      const random = Math.random().toString(36).substring(2, 6).toUpperCase()
      const reference_number = `TH-${timestamp}-${random}`

      let container_id: string | null = null
      if (form.container_number.trim()) {
        const { data: container, error: containerErr } = await supabase
          .from("containers")
          .insert({
            container_number: form.container_number.trim(),
            size: form.container_size || null,
            type: form.container_type || null,
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

      const payload: Record<string, unknown> = {
        reference_number,
        status: "Created" as LoadStatus,
        load_type: form.load_type || null,
        route_type: form.route_type || null,
        customer_id: form.customer_id || null,
        driver_id: form.driver_id || null,
        container_id,
        pickup_location: form.pickup_location || null,
        delivery_location: form.delivery_location || null,
        return_location: form.return_location || null,
        pickup_apt_from: form.pickup_apt_from || null,
        pickup_apt_to: form.pickup_apt_to || null,
        delivery_apt_from: form.delivery_apt_from || null,
        delivery_apt_to: form.delivery_apt_to || null,
        return_apt_from: form.return_apt_from || null,
        return_apt_to: form.return_apt_to || null,
        vessel_eta: form.vessel_eta || null,
        per_diem_free_day: form.per_diem_free_day || null,
        ssl: form.ssl || null,
        mbol: form.mbol || null,
        house_bol: form.house_bol || null,
        vessel_name: form.vessel_name || null,
        voyage: form.voyage || null,
        seal_number: form.seal_number || null,
        chassis_number: form.chassis_number || null,
        genset_number: form.genset_number || null,
        temperature: form.temperature || null,
        scac: form.scac || null,
        total_weight: form.total_weight ? parseFloat(form.total_weight) : null,
        commodity: form.commodity || null,
        container_size: form.container_size || null,
        container_type: form.container_type || null,
        purchase_order: form.purchase_order || null,
        shipment_number: form.shipment_number || null,
        pickup_number: form.pickup_number || null,
        appointment_number: form.appointment_number || null,
        return_number: form.return_number || null,
        reservation_number: form.reservation_number || null,
        is_hazmat: form.is_hazmat, is_hot: form.is_hot, is_overweight: form.is_overweight,
        is_oog: form.is_oog, is_street_turn: form.is_street_turn, is_tanker: form.is_tanker,
        is_bonded: form.is_bonded, is_liquor: form.is_liquor, is_ev: form.is_ev,
        is_double: form.is_double, is_genset: form.is_genset, is_scale: form.is_scale,
        rate: form.rate ? parseFloat(form.rate) : null,
        accessorial_charges: form.accessorial_charges ? parseFloat(form.accessorial_charges) : null,
        detention_charges: form.detention_charges ? parseFloat(form.detention_charges) : null,
        driver_pay: form.driver_pay ? parseFloat(form.driver_pay) : null,
        driver_pay_notes: form.driver_pay_notes || null,
        notes: form.notes || null,
      }

      const { error: loadErr } = await supabase.from("loads").insert(payload)
      if (loadErr) { setError(loadErr.message); setSaving(false); return }

      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create load")
      setSaving(false)
    }
  }, [form, router, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative mt-8 mb-8 w-full max-w-4xl max-h-[calc(100vh-64px)] bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Add New Load</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create a new shipment with full details</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-1.5 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#E8700A]/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : "Create Load"}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 shrink-0">
            {error}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Load Details */}
          <SH title="Load Details" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="Load Type *">
              <select value={form.load_type} onChange={(e) => u("load_type", e.target.value as LoadType)} className={selectCls}>
                <option value="" className="bg-[#111827]">Select...</option>
                {LOAD_TYPES.map(t => <option key={t} value={t} className="bg-[#111827]">{t}</option>)}
              </select>
            </F>
            <F label="Route Type">
              <select value={form.route_type} onChange={(e) => u("route_type", e.target.value as RouteType)} className={selectCls}>
                <option value="" className="bg-[#111827]">Select...</option>
                {ROUTE_TYPES.map(t => <option key={t} value={t} className="bg-[#111827]">{t}</option>)}
              </select>
            </F>
            <F label="Customer *">
              <SearchableSelect options={customers} value={form.customer_id} onChange={(v) => u("customer_id", v)} placeholder="Search customers..." />
              <button type="button" onClick={() => setShowAddCustomer(true)} className="text-xs text-[#FF8C21] hover:text-[#E8700A] mt-1">+ Add New Customer</button>
            </F>
            <F label="Driver">
              <SearchableSelect options={drivers} value={form.driver_id} onChange={(v) => u("driver_id", v)} placeholder="Search drivers..." />
            </F>
            <F label="SSL">
              <input type="text" value={form.ssl} onChange={(e) => u("ssl", e.target.value)} placeholder="e.g. MAERSK" className={inputCls} />
            </F>
            <F label="SCAC">
              <input type="text" value={form.scac} onChange={(e) => u("scac", e.target.value)} placeholder="e.g. MAEU" className={inputCls} />
            </F>
          </div>

          {/* Container */}
          <SH title="Container" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="Container #">
              <input type="text" value={form.container_number} onChange={(e) => u("container_number", e.target.value)} placeholder="MSKU1234567" className={inputCls} />
            </F>
            <F label="Size">
              <select value={form.container_size} onChange={(e) => u("container_size", e.target.value)} className={selectCls}>
                <option value="" className="bg-[#111827]">Select...</option>
                {CONTAINER_SIZES.map(s => <option key={s} value={s} className="bg-[#111827]">{s}&apos;</option>)}
              </select>
            </F>
            <F label="Type">
              <select value={form.container_type} onChange={(e) => u("container_type", e.target.value)} className={selectCls}>
                <option value="" className="bg-[#111827]">Select...</option>
                {CONTAINER_TYPES.map(t => <option key={t} value={t} className="bg-[#111827]">{t}</option>)}
              </select>
            </F>
            <F label="Seal #">
              <input type="text" value={form.seal_number} onChange={(e) => u("seal_number", e.target.value)} className={inputCls} />
            </F>
            <F label="Weight (lbs)">
              <input type="number" value={form.total_weight} onChange={(e) => u("total_weight", e.target.value)} placeholder="0" className={inputCls} />
            </F>
            <F label="Commodity">
              <input type="text" value={form.commodity} onChange={(e) => u("commodity", e.target.value)} className={inputCls} />
            </F>
          </div>

          {/* Shipping */}
          <SH title="Shipping & Vessel" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="Master BOL"><input type="text" value={form.mbol} onChange={(e) => u("mbol", e.target.value)} className={inputCls} /></F>
            <F label="House BOL"><input type="text" value={form.house_bol} onChange={(e) => u("house_bol", e.target.value)} className={inputCls} /></F>
            <F label="Vessel"><input type="text" value={form.vessel_name} onChange={(e) => u("vessel_name", e.target.value)} className={inputCls} /></F>
            <F label="Voyage"><input type="text" value={form.voyage} onChange={(e) => u("voyage", e.target.value)} className={inputCls} /></F>
            <F label="Vessel ETA"><input type="datetime-local" value={form.vessel_eta} onChange={(e) => u("vessel_eta", e.target.value)} className={inputCls} /></F>
            <F label="Per Diem Free Day"><input type="date" value={form.per_diem_free_day} onChange={(e) => u("per_diem_free_day", e.target.value)} className={inputCls} /></F>
          </div>

          {/* Locations */}
          <SH title="Locations" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <F label="Pickup">
              <SearchableSelect options={locationOptions} value={form.pickup_location} onChange={(v) => u("pickup_location", v)} placeholder="Search locations..." allowFreeText />
            </F>
            <F label="Delivery">
              <SearchableSelect options={locationOptions} value={form.delivery_location} onChange={(v) => u("delivery_location", v)} placeholder="Search locations..." allowFreeText />
            </F>
            <F label="Return">
              <SearchableSelect options={locationOptions} value={form.return_location} onChange={(v) => u("return_location", v)} placeholder="Search locations..." allowFreeText />
            </F>
          </div>

          {/* Appointments */}
          <SH title="Appointments" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="Pickup From"><input type="datetime-local" value={form.pickup_apt_from} onChange={(e) => u("pickup_apt_from", e.target.value)} className={inputCls} /></F>
            <F label="Pickup To"><input type="datetime-local" value={form.pickup_apt_to} onChange={(e) => u("pickup_apt_to", e.target.value)} className={inputCls} /></F>
            <div />
            <F label="Delivery From"><input type="datetime-local" value={form.delivery_apt_from} onChange={(e) => u("delivery_apt_from", e.target.value)} className={inputCls} /></F>
            <F label="Delivery To"><input type="datetime-local" value={form.delivery_apt_to} onChange={(e) => u("delivery_apt_to", e.target.value)} className={inputCls} /></F>
            <div />
            <F label="Return From"><input type="datetime-local" value={form.return_apt_from} onChange={(e) => u("return_apt_from", e.target.value)} className={inputCls} /></F>
            <F label="Return To"><input type="datetime-local" value={form.return_apt_to} onChange={(e) => u("return_apt_to", e.target.value)} className={inputCls} /></F>
          </div>

          {/* Equipment */}
          <SH title="Equipment" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="Chassis #"><input type="text" value={form.chassis_number} onChange={(e) => u("chassis_number", e.target.value)} className={inputCls} /></F>
            <F label="Genset #"><input type="text" value={form.genset_number} onChange={(e) => u("genset_number", e.target.value)} className={inputCls} /></F>
            <F label="Temperature"><input type="text" value={form.temperature} onChange={(e) => u("temperature", e.target.value)} placeholder="e.g. -18°F" className={inputCls} /></F>
          </div>

          {/* Reference Numbers */}
          <SH title="References" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="PO #"><input type="text" value={form.purchase_order} onChange={(e) => u("purchase_order", e.target.value)} className={inputCls} /></F>
            <F label="Shipment #"><input type="text" value={form.shipment_number} onChange={(e) => u("shipment_number", e.target.value)} className={inputCls} /></F>
            <F label="Pickup #"><input type="text" value={form.pickup_number} onChange={(e) => u("pickup_number", e.target.value)} className={inputCls} /></F>
            <F label="Appt #"><input type="text" value={form.appointment_number} onChange={(e) => u("appointment_number", e.target.value)} className={inputCls} /></F>
            <F label="Return #"><input type="text" value={form.return_number} onChange={(e) => u("return_number", e.target.value)} className={inputCls} /></F>
            <F label="Reservation #"><input type="text" value={form.reservation_number} onChange={(e) => u("reservation_number", e.target.value)} className={inputCls} /></F>
          </div>

          {/* Flags */}
          <SH title="Flags" />
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {([
              ["is_hazmat", "Hazmat"], ["is_hot", "Hot"], ["is_overweight", "Overweight"], ["is_oog", "OOG"],
              ["is_street_turn", "Street Turn"], ["is_tanker", "Tanker"], ["is_bonded", "Bonded"], ["is_liquor", "Liquor"],
              ["is_ev", "EV"], ["is_double", "Double"], ["is_genset", "Genset"], ["is_scale", "Scale"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form[key] as boolean} onChange={(e) => u(key, e.target.checked as never)} className="w-3 h-3 rounded border-white/20 bg-white/5 accent-[#E8700A]" />
                <span className="text-[11px] text-gray-400">{label}</span>
              </label>
            ))}
          </div>

          {/* Billing */}
          <SH title="Billing" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <F label="Rate ($)"><input type="number" value={form.rate} onChange={(e) => u("rate", e.target.value)} placeholder="0.00" className={inputCls} /></F>
            <F label="Accessorial ($)"><input type="number" value={form.accessorial_charges} onChange={(e) => u("accessorial_charges", e.target.value)} placeholder="0.00" className={inputCls} /></F>
            <F label="Detention ($)"><input type="number" value={form.detention_charges} onChange={(e) => u("detention_charges", e.target.value)} placeholder="0.00" className={inputCls} /></F>
            <F label="Driver Pay ($)"><input type="number" value={form.driver_pay} onChange={(e) => u("driver_pay", e.target.value)} placeholder="0.00" className={inputCls} /></F>
          </div>

          {/* Notes */}
          <SH title="Notes" />
          <textarea
            value={form.notes}
            onChange={(e) => u("notes", e.target.value)}
            rows={3}
            placeholder="Additional notes..."
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-white/5 shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/10 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-1.5 bg-[#E8700A] rounded-lg text-xs font-medium text-white hover:bg-[#E8700A]/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create Load"}
          </button>
        </div>
      </div>

      {/* Add Customer Modal (uses Organizations module) */}
      <AddOrganizationModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        defaultTypes={["customer"]}
        onCreated={() => {
          invalidateOrgCache()
        }}
        onCreatedWithId={(customer) => {
          setCustomers(prev => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name)))
          u("customer_id", customer.id)
        }}
      />
    </div>
  )
}
