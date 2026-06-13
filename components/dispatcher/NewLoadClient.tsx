// components/dispatcher/NewLoadClient.tsx
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { LoadType, RouteType, LoadStatus } from "@/types/dispatcher"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

type OrgOption = { id: string; name: string }

type Props = {
  customers: OrgOption[]
  terminals: OrgOption[]
  warehouses: OrgOption[]
  yards: OrgOption[]
  drivers: OrgOption[]
}

type FormData = {
  // Core
  load_type: LoadType | ""
  route_type: RouteType | ""
  customer_id: string
  driver_id: string

  // Container
  container_number: string
  container_size: string
  container_type: string
  seal_number: string

  // Shipping
  ssl: string
  mbol: string
  house_bol: string
  vessel_name: string
  voyage: string
  vessel_eta: string

  // Locations (free-text with org lookups)
  pickup_location: string
  delivery_location: string
  return_location: string

  // Appointment windows
  pickup_apt_from: string
  pickup_apt_to: string
  delivery_apt_from: string
  delivery_apt_to: string
  return_apt_from: string
  return_apt_to: string

  // Dates
  per_diem_free_day: string

  // Equipment
  chassis_number: string
  chassis_size: string
  chassis_type: string
  chassis_owner: string
  genset_number: string
  temperature: string
  scac: string
  total_weight: string
  commodity: string

  // References
  purchase_order: string
  shipment_number: string
  pickup_number: string
  appointment_number: string
  return_number: string
  reservation_number: string

  // Flags
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

  // Billing
  rate: string
  accessorial_charges: string
  detention_charges: string
  driver_pay: string
  driver_pay_notes: string

  // Notes
  notes: string
}

const INITIAL_FORM: FormData = {
  load_type: "",
  route_type: "",
  customer_id: "",
  driver_id: "",
  container_number: "",
  container_size: "",
  container_type: "",
  seal_number: "",
  ssl: "",
  mbol: "",
  house_bol: "",
  vessel_name: "",
  voyage: "",
  vessel_eta: "",
  pickup_location: "",
  delivery_location: "",
  return_location: "",
  pickup_apt_from: "",
  pickup_apt_to: "",
  delivery_apt_from: "",
  delivery_apt_to: "",
  return_apt_from: "",
  return_apt_to: "",
  per_diem_free_day: "",
  chassis_number: "",
  chassis_size: "",
  chassis_type: "",
  chassis_owner: "",
  genset_number: "",
  temperature: "",
  scac: "",
  total_weight: "",
  commodity: "",
  purchase_order: "",
  shipment_number: "",
  pickup_number: "",
  appointment_number: "",
  return_number: "",
  reservation_number: "",
  is_hazmat: false,
  is_hot: false,
  is_overweight: false,
  is_oog: false,
  is_street_turn: false,
  is_tanker: false,
  is_bonded: false,
  is_liquor: false,
  is_ev: false,
  is_double: false,
  is_genset: false,
  is_scale: false,
  is_overheight: false,
  rate: "",
  accessorial_charges: "",
  detention_charges: "",
  driver_pay: "",
  driver_pay_notes: "",
  notes: "",
}

const LOAD_TYPES: LoadType[] = ["Import", "Export", "Road", "Bill Only"]
const ROUTE_TYPES: RouteType[] = [
  "Pick and Run + Live",
  "Pick and Run + Drop & Hook",
  "Prepull + Live",
  "Prepull + Drop & Hook",
  "One Way Move",
  "Shunt",
]
const CONTAINER_SIZES = ["20", "40", "45", "53"]
const CONTAINER_TYPES = ["HC", "ST", "RF", "OT", "FR", "TK"]

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider border-b border-white/5 pb-2 mb-4">
      {title}
    </h3>
  )
}

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : span === 3 ? "sm:col-span-3" : ""}>
      <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
    />
  )
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50 appearance-none"
    >
      <option value="" className="bg-[#111827]">{placeholder || "Select..."}</option>
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-[#111827]">{o.label}</option>
      ))}
    </select>
  )
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-[#E8700A]"
      />
      <span className="text-xs text-gray-400">{label}</span>
    </label>
  )
}

export function NewLoadClient({ customers, terminals, warehouses, yards, drivers }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build combined location options from terminals, warehouses, yards
  const locationOptions = [
    ...terminals.map(t => ({ id: t.id, name: `[Terminal] ${t.name}` })),
    ...warehouses.map(w => ({ id: w.id, name: `[Warehouse] ${w.name}` })),
    ...yards.map(y => ({ id: y.id, name: `[Yard] ${y.name}` })),
  ]

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
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

      // Generate a reference number
      const timestamp = Date.now().toString(36).toUpperCase()
      const random = Math.random().toString(36).substring(2, 6).toUpperCase()
      const reference_number = `TH-${timestamp}-${random}`

      // Create the load
      const loadPayload: Record<string, unknown> = {
        reference_number,
        status: "Created" as LoadStatus,
        load_type: form.load_type || null,
        route_type: form.route_type || null,
        customer_id: form.customer_id || null,
        driver_id: form.driver_id || null,
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
        chassis_size: form.chassis_size || null,
        chassis_type: form.chassis_type || null,
        chassis_owner: form.chassis_owner || null,
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
        is_hazmat: form.is_hazmat,
        is_hot: form.is_hot,
        is_overweight: form.is_overweight,
        is_oog: form.is_oog,
        is_street_turn: form.is_street_turn,
        is_tanker: form.is_tanker,
        is_bonded: form.is_bonded,
        is_liquor: form.is_liquor,
        is_ev: form.is_ev,
        is_double: form.is_double,
        is_genset: form.is_genset,
        is_scale: form.is_scale,
        rate: form.rate ? parseFloat(form.rate) : null,
        accessorial_charges: form.accessorial_charges ? parseFloat(form.accessorial_charges) : null,
        detention_charges: form.detention_charges ? parseFloat(form.detention_charges) : null,
        driver_pay: form.driver_pay ? parseFloat(form.driver_pay) : null,
        driver_pay_notes: form.driver_pay_notes || null,
        notes: form.notes || null,
      }

      // If container number provided, create container first
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
          // If container already exists, try to find it
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

      if (container_id) {
        loadPayload.container_id = container_id
      }

      const { error: loadErr } = await supabase
        .from("loads")
        .insert(loadPayload)

      if (loadErr) {
        setError(loadErr.message)
        setSaving(false)
        return
      }

      router.push("/dashboard/dispatcher")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create load")
      setSaving(false)
    }
  }, [form, router])

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/dispatcher")}
            className="p-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-white">Add New Load</h1>
            <p className="text-sm text-gray-500">Create a new shipment with full details</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/dispatcher")}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#E8700A]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Form Sections */}
      <div className="space-y-6">
        {/* Core Details */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Load Details" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Load Type *">
              <SelectInput
                value={form.load_type}
                onChange={(v) => updateField("load_type", v as LoadType)}
                options={LOAD_TYPES.map(t => ({ value: t, label: t }))}
                placeholder="Select load type..."
              />
            </Field>
            <Field label="Route Type">
              <SelectInput
                value={form.route_type}
                onChange={(v) => updateField("route_type", v as RouteType)}
                options={ROUTE_TYPES.map(t => ({ value: t, label: t }))}
                placeholder="Select route type..."
              />
            </Field>
            <Field label="Customer *">
              <SearchableSelect
                options={customers}
                value={form.customer_id}
                onChange={(v) => updateField("customer_id", v)}
                placeholder="Search customers..."
              />
            </Field>
            <Field label="Driver">
              <SearchableSelect
                options={drivers}
                value={form.driver_id}
                onChange={(v) => updateField("driver_id", v)}
                placeholder="Search drivers..."
              />
            </Field>
            <Field label="SSL / Shipping Line">
              <TextInput value={form.ssl} onChange={(v) => updateField("ssl", v)} placeholder="e.g. MAERSK" />
            </Field>
            <Field label="SCAC">
              <TextInput value={form.scac} onChange={(v) => updateField("scac", v)} placeholder="e.g. MAEU" />
            </Field>
          </div>
        </div>

        {/* Container */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Container" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Container #">
              <TextInput value={form.container_number} onChange={(v) => updateField("container_number", v)} placeholder="e.g. MSKU1234567" />
            </Field>
            <Field label="Size">
              <SelectInput
                value={form.container_size}
                onChange={(v) => updateField("container_size", v)}
                options={CONTAINER_SIZES.map(s => ({ value: s, label: `${s}'` }))}
                placeholder="Select..."
              />
            </Field>
            <Field label="Type">
              <SelectInput
                value={form.container_type}
                onChange={(v) => updateField("container_type", v)}
                options={CONTAINER_TYPES.map(t => ({ value: t, label: t }))}
                placeholder="Select..."
              />
            </Field>
            <Field label="Seal #">
              <TextInput value={form.seal_number} onChange={(v) => updateField("seal_number", v)} />
            </Field>
            <Field label="Total Weight (lbs)">
              <TextInput value={form.total_weight} onChange={(v) => updateField("total_weight", v)} type="number" placeholder="0" />
            </Field>
            <Field label="Commodity">
              <TextInput value={form.commodity} onChange={(v) => updateField("commodity", v)} />
            </Field>
          </div>
        </div>

        {/* Shipping & Vessel */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Shipping & Vessel" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Master BOL">
              <TextInput value={form.mbol} onChange={(v) => updateField("mbol", v)} />
            </Field>
            <Field label="House BOL">
              <TextInput value={form.house_bol} onChange={(v) => updateField("house_bol", v)} />
            </Field>
            <Field label="Vessel">
              <TextInput value={form.vessel_name} onChange={(v) => updateField("vessel_name", v)} />
            </Field>
            <Field label="Voyage">
              <TextInput value={form.voyage} onChange={(v) => updateField("voyage", v)} />
            </Field>
            <Field label="Vessel ETA">
              <TextInput value={form.vessel_eta} onChange={(v) => updateField("vessel_eta", v)} type="datetime-local" />
            </Field>
            <Field label="Per Diem Free Day">
              <TextInput value={form.per_diem_free_day} onChange={(v) => updateField("per_diem_free_day", v)} type="date" />
            </Field>
          </div>
        </div>

        {/* Locations */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Locations" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Pickup Location">
              <SearchableSelect
                options={locationOptions}
                value={form.pickup_location}
                onChange={(v) => updateField("pickup_location", v)}
                placeholder="Search terminals, warehouses, yards..."
                allowFreeText
              />
            </Field>
            <Field label="Delivery Location">
              <SearchableSelect
                options={locationOptions}
                value={form.delivery_location}
                onChange={(v) => updateField("delivery_location", v)}
                placeholder="Search terminals, warehouses, yards..."
                allowFreeText
              />
            </Field>
            <Field label="Return Location">
              <SearchableSelect
                options={locationOptions}
                value={form.return_location}
                onChange={(v) => updateField("return_location", v)}
                placeholder="Search terminals, warehouses, yards..."
                allowFreeText
              />
            </Field>
          </div>
        </div>

        {/* Appointments */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Appointment Windows" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Pickup From">
              <TextInput value={form.pickup_apt_from} onChange={(v) => updateField("pickup_apt_from", v)} type="datetime-local" />
            </Field>
            <Field label="Pickup To">
              <TextInput value={form.pickup_apt_to} onChange={(v) => updateField("pickup_apt_to", v)} type="datetime-local" />
            </Field>
            <div /> {/* spacer */}
            <Field label="Delivery From">
              <TextInput value={form.delivery_apt_from} onChange={(v) => updateField("delivery_apt_from", v)} type="datetime-local" />
            </Field>
            <Field label="Delivery To">
              <TextInput value={form.delivery_apt_to} onChange={(v) => updateField("delivery_apt_to", v)} type="datetime-local" />
            </Field>
            <div />
            <Field label="Return From">
              <TextInput value={form.return_apt_from} onChange={(v) => updateField("return_apt_from", v)} type="datetime-local" />
            </Field>
            <Field label="Return To">
              <TextInput value={form.return_apt_to} onChange={(v) => updateField("return_apt_to", v)} type="datetime-local" />
            </Field>
          </div>
        </div>

        {/* Equipment */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Equipment" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Chassis #">
              <TextInput value={form.chassis_number} onChange={(v) => updateField("chassis_number", v)} />
            </Field>
            <Field label="Chassis Size">
              <TextInput value={form.chassis_size} onChange={(v) => updateField("chassis_size", v)} />
            </Field>
            <Field label="Chassis Type">
              <TextInput value={form.chassis_type} onChange={(v) => updateField("chassis_type", v)} />
            </Field>
            <Field label="Chassis Owner">
              <TextInput value={form.chassis_owner} onChange={(v) => updateField("chassis_owner", v)} />
            </Field>
            <Field label="Genset #">
              <TextInput value={form.genset_number} onChange={(v) => updateField("genset_number", v)} />
            </Field>
            <Field label="Temperature">
              <TextInput value={form.temperature} onChange={(v) => updateField("temperature", v)} placeholder="e.g. -18°F" />
            </Field>
          </div>
        </div>

        {/* Reference Numbers */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Reference Numbers" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Purchase Order">
              <TextInput value={form.purchase_order} onChange={(v) => updateField("purchase_order", v)} />
            </Field>
            <Field label="Shipment #">
              <TextInput value={form.shipment_number} onChange={(v) => updateField("shipment_number", v)} />
            </Field>
            <Field label="Pickup #">
              <TextInput value={form.pickup_number} onChange={(v) => updateField("pickup_number", v)} />
            </Field>
            <Field label="Appointment #">
              <TextInput value={form.appointment_number} onChange={(v) => updateField("appointment_number", v)} />
            </Field>
            <Field label="Return #">
              <TextInput value={form.return_number} onChange={(v) => updateField("return_number", v)} />
            </Field>
            <Field label="Reservation #">
              <TextInput value={form.reservation_number} onChange={(v) => updateField("reservation_number", v)} />
            </Field>
          </div>
        </div>

        {/* Flags */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Flags & Special Handling" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CheckboxField label="Hazmat" checked={form.is_hazmat} onChange={(v) => updateField("is_hazmat", v)} />
            <CheckboxField label="Hot / Priority" checked={form.is_hot} onChange={(v) => updateField("is_hot", v)} />
            <CheckboxField label="Overweight" checked={form.is_overweight} onChange={(v) => updateField("is_overweight", v)} />
            <CheckboxField label="OOG" checked={form.is_oog} onChange={(v) => updateField("is_oog", v)} />
            <CheckboxField label="Street Turn" checked={form.is_street_turn} onChange={(v) => updateField("is_street_turn", v)} />
            <CheckboxField label="Tanker" checked={form.is_tanker} onChange={(v) => updateField("is_tanker", v)} />
            <CheckboxField label="Bonded" checked={form.is_bonded} onChange={(v) => updateField("is_bonded", v)} />
            <CheckboxField label="Liquor" checked={form.is_liquor} onChange={(v) => updateField("is_liquor", v)} />
            <CheckboxField label="EV" checked={form.is_ev} onChange={(v) => updateField("is_ev", v)} />
            <CheckboxField label="Double" checked={form.is_double} onChange={(v) => updateField("is_double", v)} />
            <CheckboxField label="Genset" checked={form.is_genset} onChange={(v) => updateField("is_genset", v)} />
            <CheckboxField label="Scale Required" checked={form.is_scale} onChange={(v) => updateField("is_scale", v)} />
          </div>
        </div>

        {/* Billing */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Billing & Pay" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Rate ($)">
              <TextInput value={form.rate} onChange={(v) => updateField("rate", v)} type="number" placeholder="0.00" />
            </Field>
            <Field label="Accessorial ($)">
              <TextInput value={form.accessorial_charges} onChange={(v) => updateField("accessorial_charges", v)} type="number" placeholder="0.00" />
            </Field>
            <Field label="Detention ($)">
              <TextInput value={form.detention_charges} onChange={(v) => updateField("detention_charges", v)} type="number" placeholder="0.00" />
            </Field>
            <Field label="Driver Pay ($)">
              <TextInput value={form.driver_pay} onChange={(v) => updateField("driver_pay", v)} type="number" placeholder="0.00" />
            </Field>
            <Field label="Driver Pay Notes" span={2}>
              <TextInput value={form.driver_pay_notes} onChange={(v) => updateField("driver_pay_notes", v)} />
            </Field>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6">
          <SectionHeader title="Notes" />
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={4}
            placeholder="Additional notes about this load..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50 resize-none"
          />
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button
            onClick={() => router.push("/dashboard/dispatcher")}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#E8700A]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Create Load"}
          </button>
        </div>
      </div>
    </div>
  )
}
