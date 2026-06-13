"use client"

import { useState, useEffect, useRef } from "react"
import { LoadWithRelations } from "@/types/dispatcher"
import { LocationSearch } from "@/components/dispatcher/LocationSearch"
import { AddOrganizationModal } from "@/components/organizations/AddOrganizationModal"
import { invalidateOrgCache } from "@/components/dispatcher/LocationSearch"
import { isValidContainerNumber } from "@/lib/validation"

// Convert ISO timestamp (from Supabase) to datetime-local input format (YYYY-MM-DDTHH:mm)
function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ""
    const pad = (n: number) => n.toString().padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ""
  }
}

type LoadInfoTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

type FreightRow = {
  id?: string
  commodity: string
  description: string
  pieces: number
  weight_lbs: number
  weight_kgs: number
  pallets: number
}

// Shared class for inputs
const DATE_INPUT_CLASS =
  "date-input-styled w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"

// Select elements need explicit bg so dropdown options aren't transparent/white
const SELECT_CLASS =
  "date-input-styled w-full px-2 py-1 bg-[#1F2937] border border-white/10 rounded text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"

export function LoadInfoTab({ load, onUpdate }: LoadInfoTabProps) {
  const [formData, setFormData] = useState(load)
  const [freightRows, setFreightRows] = useState<FreightRow[]>([])
  const [freightLoaded, setFreightLoaded] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [portTracking, setPortTracking] = useState<"idle" | "tracking" | "found" | "not_found" | "error">("idle")
  const freightSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track which fields have been changed since last save
  const pendingChangesRef = useRef<Record<string, unknown>>({})
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  // Only reset formData when switching to a different load
  useEffect(() => {
    // Merge container-level fields into formData for unified form handling
    const merged = {
      ...load,
      container_number: (load as Record<string, unknown>).container_number as string | null ?? load.containers?.container_number ?? null,
      last_free_day: (load as Record<string, unknown>).last_free_day as string | null ?? load.containers?.last_free_day ?? null,
    }
    setFormData(merged as LoadWithRelations)
    pendingChangesRef.current = {}
  }, [load.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load freight descriptions from DB
  useEffect(() => {
    let cancelled = false
    async function fetchFreight() {
      try {
        const res = await fetch(`/api/dispatcher/loads/${load.id}/freight`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const rows = (data.freight || []).map((r: FreightRow) => ({
            id: r.id,
            commodity: r.commodity || "",
            description: r.description || "",
            pieces: r.pieces || 0,
            weight_lbs: r.weight_lbs || 0,
            weight_kgs: r.weight_kgs || 0,
            pallets: r.pallets || 0,
          }))
          setFreightRows(rows.length > 0 ? rows : [{
            commodity: "", description: "", pieces: 0,
            weight_lbs: 0, weight_kgs: 0, pallets: 0,
          }])
          setFreightLoaded(true)
        }
      } catch {
        // If freight_descriptions table doesn't exist yet, show empty row
        if (!cancelled) {
          setFreightRows([{
            commodity: "", description: "", pieces: 0,
            weight_lbs: 0, weight_kgs: 0, pallets: 0,
          }])
          setFreightLoaded(true)
        }
      }
    }
    fetchFreight()
    return () => { cancelled = true }
  }, [load.id])

  // Save freight descriptions (debounced)
  const saveFreight = (rows: FreightRow[]) => {
    if (freightSaveTimeoutRef.current) {
      clearTimeout(freightSaveTimeoutRef.current)
    }
    freightSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dispatcher/loads/${load.id}/freight`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ freight: rows }),
        })
        if (res.ok) {
          console.log("[LoadInfoTab] Freight saved successfully")
        } else {
          console.error("[LoadInfoTab] Freight save failed:", res.status)
        }
      } catch (err) {
        console.error("[LoadInfoTab] Freight save error:", err)
      }
    }, 800) // debounce 800ms
  }

  const DATE_FIELDS = new Set([
    "pickup_apt_from", "pickup_apt_to",
    "delivery_apt_from", "delivery_apt_to",
    "return_apt_from", "return_apt_to",
  ])

  const handleFieldChange = (field: keyof LoadWithRelations, value: unknown) => {
    // Convert empty date strings to null so Supabase doesn't receive ""
    const cleaned = DATE_FIELDS.has(field) && value === "" ? null : value
    setFormData((prev) => ({ ...prev, [field]: cleaned }))
    // Accumulate only the changed field
    pendingChangesRef.current[field] = cleaned
  }

  // Save accumulated changed fields on blur
  const handleBlur = () => {
    const changes = pendingChangesRef.current
    if (Object.keys(changes).length > 0) {
      console.log("[LoadInfoTab] Saving changes:", changes)

      // If container_number is changing, start port tracking indicator
      if (changes.container_number && (changes.container_number as string).length >= 4) {
        triggerPortTracking(changes.container_number as string)
      }

      onUpdateRef.current(changes as Partial<LoadWithRelations>)
      pendingChangesRef.current = {}
    }
  }

  // Trigger port tracking and show indicator
  const [containerError, setContainerError] = useState<string | null>(null)
  const triggerPortTracking = async (containerNumber: string) => {
    if (!containerNumber || containerNumber.length < 4) return
    if (!isValidContainerNumber(containerNumber)) {
      setContainerError("Invalid container number")
      setTimeout(() => setContainerError(null), 5000)
      return
    }
    setContainerError(null)
    setPortTracking("tracking")
    try {
      const res = await fetch("/api/dispatcher/containers/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          container_number: containerNumber,
          container_id: load.containers?.id || null,
          load_id: load.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPortTracking("error")
        console.error("[LoadInfoTab] Port tracking API error:", res.status, data.error, data.ph_error)
      } else if (data.invalid_format) {
        setContainerError("Invalid container number")
        setTimeout(() => setContainerError(null), 5000)
      } else if (data.duplicate) {
        setPortTracking("error")
        alert(data.warning || "This container is already assigned to another load")
      } else if (data.tracked) {
        setPortTracking("found")
        console.log("[LoadInfoTab] Port tracking found data:", data)
      } else {
        setPortTracking("not_found")
        console.log("[LoadInfoTab] Port tracking: not found at port -", data.message)
      }
    } catch (err) {
      setPortTracking("error")
      console.error("[LoadInfoTab] Port tracking error:", err)
    }
    // Reset indicator after 5 seconds
    setTimeout(() => setPortTracking("idle"), 5000)
  }

  const handleFreightChange = (index: number, field: keyof FreightRow, value: unknown) => {
    const updated = [...freightRows]
    updated[index] = { ...updated[index], [field]: value }
    setFreightRows(updated)
  }

  const handleFreightBlur = () => {
    if (freightLoaded) {
      saveFreight(freightRows)
    }
  }

  const addFreightRow = () => {
    setFreightRows((prev) => [
      ...prev,
      {
        commodity: "",
        description: "",
        pieces: 0,
        weight_lbs: 0,
        weight_kgs: 0,
        pallets: 0,
      },
    ])
  }

  return (
    <div className="space-y-6">
      {/* Calendar icon styling for date inputs */}
      <style>{`
        .date-input-styled::-webkit-calendar-picker-indicator {
          filter: invert(0.7);
          cursor: pointer;
          width: 18px;
          height: 18px;
        }
      `}</style>
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Locations, Flags, Freight */}
        <div className="col-span-1 space-y-6">
          {/* Locations Card */}
          <div className="bg-[#1F2937] rounded-lg p-4 space-y-5">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Locations</h4>

            {/* Customer */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer</label>
              <LocationSearch
                value={formData.customers?.name || ""}
                orgTypes={["Customer"]}
                onChange={() => {/* handled by onSelect */}}
                onSelect={(org) => {
                  if (org) {
                    handleFieldChange("customer_id", org.id)
                    setFormData((prev) => ({
                      ...prev,
                      customer_id: org.id,
                      customers: { ...prev.customers!, id: org.id, name: org.name },
                    }))
                  } else {
                    handleFieldChange("customer_id", null)
                    setFormData((prev) => ({ ...prev, customer_id: null, customers: null }))
                  }
                  handleBlur()
                }}
                placeholder="Search customers..."
              />
              <button type="button" onClick={() => setShowAddCustomer(true)} className="text-xs text-[#FF8C21] hover:text-[#E8700A] mt-2">+ Add New Customer</button>
            </div>

            {/* Pick Up Location */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pick Up Location</label>
              <LocationSearch
                value={formData.pickup_location || ""}
                onChange={(name) => handleFieldChange("pickup_location", name || null)}
                onBlur={handleBlur}
                placeholder="Search pickup location..."
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apt From</label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(formData.pickup_apt_from)}
                    onChange={(e) => handleFieldChange("pickup_apt_from", e.target.value)}
                    onBlur={handleBlur}
                    className={DATE_INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apt To</label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(formData.pickup_apt_to)}
                    onChange={(e) => handleFieldChange("pickup_apt_to", e.target.value)}
                    onBlur={handleBlur}
                    className={DATE_INPUT_CLASS}
                  />
                </div>
              </div>
              <button className="text-xs text-[#FF8C21] hover:text-[#E8700A] mt-2">+ Add Pick Up Location</button>
            </div>

            {/* Delivery Location */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Delivery Location</label>
              <LocationSearch
                value={formData.delivery_location || ""}
                onChange={(name) => handleFieldChange("delivery_location", name || null)}
                onBlur={handleBlur}
                placeholder="Search delivery location..."
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apt From</label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(formData.delivery_apt_from)}
                    onChange={(e) => handleFieldChange("delivery_apt_from", e.target.value)}
                    onBlur={handleBlur}
                    className={DATE_INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apt To</label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(formData.delivery_apt_to)}
                    onChange={(e) => handleFieldChange("delivery_apt_to", e.target.value)}
                    onBlur={handleBlur}
                    className={DATE_INPUT_CLASS}
                  />
                </div>
              </div>
              <button className="text-xs text-[#FF8C21] hover:text-[#E8700A] mt-2">+ Add Delivery Location</button>
            </div>

            {/* Return Location */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Return Location</label>
              <LocationSearch
                value={formData.return_location || ""}
                onChange={(name) => handleFieldChange("return_location", name || null)}
                onBlur={handleBlur}
                placeholder="Search return location..."
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apt From</label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(formData.return_apt_from)}
                    onChange={(e) => handleFieldChange("return_apt_from", e.target.value)}
                    onBlur={handleBlur}
                    className={DATE_INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Apt To</label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(formData.return_apt_to)}
                    onChange={(e) => handleFieldChange("return_apt_to", e.target.value)}
                    onBlur={handleBlur}
                    className={DATE_INPUT_CLASS}
                  />
                </div>
              </div>
              <button className="text-xs text-[#FF8C21] hover:text-[#E8700A] mt-2">+ Add Return Location</button>
            </div>

            {/* Chassis Locations */}
            <div className="border-t border-white/5 pt-4">
              <label className="block text-xs text-gray-500 mb-2 font-medium">Chassis Locations</label>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hook Chassis Location</label>
                  <LocationSearch
                    value={(formData as Record<string, unknown>).hook_chassis_location as string || ""}
                    onChange={(name) => handleFieldChange("hook_chassis_location" as keyof LoadWithRelations, name || null)}
                    onBlur={handleBlur}
                    placeholder="Search location..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Terminate Chassis Location</label>
                  <LocationSearch
                    value={(formData as Record<string, unknown>).terminate_chassis_location as string || ""}
                    onChange={(name) => handleFieldChange("terminate_chassis_location" as keyof LoadWithRelations, name || null)}
                    onBlur={handleBlur}
                    placeholder="Search location..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Flags Card */}
          <div className="bg-[#1F2937] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Flags</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Hazmat", field: "is_hazmat" as const },
                { label: "Hot", field: "is_hot" as const },
                { label: "Street Turn", field: "is_street_turn" as const },
                { label: "Tanker", field: "is_tanker" as const },
                { label: "Overweight", field: "is_overweight" as const },
                { label: "Genset", field: "is_genset" as const },
                { label: "OOG", field: "is_oog" as const },
                { label: "Scale", field: "is_scale" as const },
                { label: "Overheight", field: "is_overheight" as const },
                { label: "Bonded", field: "is_bonded" as const },
                { label: "Liquor", field: "is_liquor" as const },
                { label: "EV", field: "is_ev" as const },
                { label: "Double", field: "is_double" as const },
              ].map((item) => (
                <label key={item.field} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData[item.field] || false}
                    onChange={(e) => {
                      handleFieldChange(item.field, e.target.checked)
                      handleBlur()
                    }}
                    className="w-4 h-4 rounded bg-white/5 border border-white/10 cursor-pointer accent-[#E8700A]"
                  />
                  <span className="text-xs text-gray-400">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Freight Description Card */}
          <div className="bg-[#1F2937] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Freight Description</h4>
            <div className="space-y-2">
              {freightRows.map((row, idx) => (
                <div key={idx} className="space-y-2 pb-2 border-b border-white/5 last:border-0">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Commodity</label>
                    <input
                      type="text"
                      value={row.commodity}
                      onChange={(e) => handleFreightChange(idx, "commodity", e.target.value)}
                      onBlur={handleFreightBlur}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => handleFreightChange(idx, "description", e.target.value)}
                      onBlur={handleFreightBlur}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pieces</label>
                      <input
                        type="number"
                        value={row.pieces}
                        onChange={(e) => handleFreightChange(idx, "pieces", parseFloat(e.target.value) || 0)}
                        onBlur={handleFreightBlur}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 text-right focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pallets</label>
                      <input
                        type="number"
                        value={row.pallets}
                        onChange={(e) => handleFreightChange(idx, "pallets", parseFloat(e.target.value) || 0)}
                        onBlur={handleFreightBlur}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 text-right focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Weight LBS</label>
                      <input
                        type="number"
                        value={row.weight_lbs}
                        onChange={(e) => handleFreightChange(idx, "weight_lbs", parseFloat(e.target.value) || 0)}
                        onBlur={handleFreightBlur}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 text-right focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Weight KGS</label>
                      <input
                        type="number"
                        value={row.weight_kgs}
                        onChange={(e) => handleFreightChange(idx, "weight_kgs", parseFloat(e.target.value) || 0)}
                        onBlur={handleFreightBlur}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 text-right focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={addFreightRow}
              className="text-xs text-[#FF8C21] hover:text-[#E8700A] mt-2 font-medium"
            >
              + Add Row
            </button>
          </div>
        </div>

        {/* Right Column - Dates and Equipment */}
        <div className="col-span-2 space-y-6">
          {/* Dates Section */}
          <div className="bg-[#1F2937] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Key Dates</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Vessel ETA", field: "vessel_eta" },
                { label: "Last Free Day", field: "last_free_day" },
                { label: "Discharge Date", field: "discharge_date" },
                { label: "Outgate Date", field: "outgate_date" },
                { label: "Delivered To User", field: "delivered_to_user_date" },
                { label: "Empty Date", field: "empty_date" },
                { label: "Per Diem Free Day", field: "per_diem_free_day" },
                { label: "Ingate Date", field: "ingate_date" },
                { label: "Ready To Return Date", field: "ready_to_return_date" },
                { label: "Completed Date", field: "completed_date" },
                { label: "Chassis Pickup Date", field: "chassis_pickup_date" },
                { label: "Chassis Termination Date", field: "chassis_termination_date" },
              ].map((item, idx) => (
                <div key={idx}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {item.label} {item.field && <span className="text-[#FF8C21]">[M]</span>}
                  </label>
                  <input
                    type="date"
                    value={
                      item.field
                        ? String((formData as Record<string, unknown>)[item.field] ?? "").slice(0, 10)
                        : ""
                    }
                    onChange={(e) => {
                      if (item.field) {
                        handleFieldChange(item.field as keyof LoadWithRelations, e.target.value ? `${e.target.value}T12:00:00Z` : null)
                      }
                    }}
                    onBlur={handleBlur}
                    className={DATE_INPUT_CLASS}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Equipment Section */}
          <div className="bg-[#1F2937] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Equipment</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 flex items-center gap-2">
                    Container #
                  {portTracking === "tracking" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#E8700A] animate-pulse">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Tracking at port...
                    </span>
                  )}
                  {portTracking === "found" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Port data updated
                    </span>
                  )}
                  {portTracking === "not_found" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                      Not found at port
                    </span>
                  )}
                  {portTracking === "error" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                      Port connection failed
                    </span>
                  )}
                  </label>
                  {containerError && (
                    <span className="text-[10px] text-orange-400">{containerError}</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={(formData as Record<string, unknown>).container_number as string || ""}
                    onChange={(e) => { handleFieldChange("container_number", e.target.value.toUpperCase()); setContainerError(null) }}
                    onBlur={handleBlur}
                    placeholder="Enter container #"
                    className={DATE_INPUT_CLASS}
                  />
                  {Boolean((formData as Record<string, unknown>).container_number) && portTracking === "idle" && (
                    <button
                      type="button"
                      onClick={() => triggerPortTracking((formData as Record<string, unknown>).container_number as string)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] text-[#E8700A] hover:text-[#FF8C21] hover:bg-[#E8700A]/10 rounded transition-colors"
                      title="Re-track at Port Houston"
                    >
                      Track
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Container Size</label>
                <select
                  value={formData.container_size || ""}
                  onChange={(e) => handleFieldChange("container_size", e.target.value)}
                  onBlur={handleBlur}
                  className={SELECT_CLASS}
                >
                  <option value="">Select...</option>
                  <option value="20">20FT</option>
                  <option value="40">40FT</option>
                  <option value="45">45FT</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Container Type</label>
                <select
                  value={formData.container_type || ""}
                  onChange={(e) => handleFieldChange("container_type", e.target.value)}
                  onBlur={handleBlur}
                  className={SELECT_CLASS}
                >
                  <option value="">Select...</option>
                  <option value="HC">HC</option>
                  <option value="ST">ST</option>
                  <option value="RF">RF</option>
                  <option value="OT">OT</option>
                  <option value="FR">FR</option>
                  <option value="TK">TK</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">SSL</label>
                <input
                  type="text"
                  value={formData.ssl || ""}
                  onChange={(e) => handleFieldChange("ssl", e.target.value)}
                  onBlur={handleBlur}
                  className={DATE_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chassis #</label>
                <input
                  type="text"
                  value={formData.chassis_number || ""}
                  onChange={(e) => handleFieldChange("chassis_number", e.target.value)}
                  onBlur={handleBlur}
                  className={DATE_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chassis Size</label>
                <select
                  value={formData.chassis_size || ""}
                  onChange={(e) => handleFieldChange("chassis_size", e.target.value)}
                  onBlur={handleBlur}
                  className={SELECT_CLASS}
                >
                  <option value="">Select...</option>
                  <option value="20">20FT</option>
                  <option value="40">40FT</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chassis Type</label>
                <input
                  type="text"
                  value={formData.chassis_type || ""}
                  onChange={(e) => handleFieldChange("chassis_type", e.target.value)}
                  onBlur={handleBlur}
                  className={DATE_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Chassis Owner</label>
                <input
                  type="text"
                  value={formData.chassis_owner || ""}
                  onChange={(e) => handleFieldChange("chassis_owner", e.target.value)}
                  onBlur={handleBlur}
                  className={DATE_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Genset #</label>
                <input
                  type="text"
                  value={formData.genset_number || ""}
                  onChange={(e) => handleFieldChange("genset_number", e.target.value)}
                  onBlur={handleBlur}
                  className={DATE_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Temperature</label>
                <input
                  type="text"
                  value={formData.temperature || ""}
                  onChange={(e) => handleFieldChange("temperature", e.target.value)}
                  onBlur={handleBlur}
                  className={DATE_INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Route</label>
                <select
                  value={formData.route_template || ""}
                  onChange={(e) => handleFieldChange("route_template", e.target.value)}
                  onBlur={handleBlur}
                  className={SELECT_CLASS}
                >
                  <option value="">Select...</option>
                  <option value="Pick and Run + Live">Pick and Run + Live</option>
                  <option value="Pick and Run + Drop & Hook">Pick and Run + Drop & Hook</option>
                  <option value="Prepull + Live">Prepull + Live</option>
                  <option value="Prepull + Drop & Hook">Prepull + Drop & Hook</option>
                  <option value="One Way Move">One Way Move</option>
                  <option value="Shunt">Shunt</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">SCAC</label>
                <input
                  type="text"
                  value={formData.scac || ""}
                  onChange={(e) => handleFieldChange("scac", e.target.value)}
                  onBlur={handleBlur}
                  className={DATE_INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* Container Visibility */}
          <div className="bg-[#1F2937] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Container Visibility</h4>
            <div className="space-y-3">
              {[
                { label: "Freight Hold", field: "freight_hold" as const, noteField: "freight_hold_note" as const },
                { label: "Custom Hold", field: "customs_hold" as const, noteField: "customs_hold_note" as const },
                { label: "Terminal Hold", field: "terminal_hold" as const, noteField: "terminal_hold_note" as const },
                { label: "Fees/Storage Hold", field: "fees_hold" as const, noteField: "fees_hold_note" as const },
                { label: "Other Hold", field: "other_hold" as const, noteField: "other_hold_note" as const },
              ].map((item) => (
                <div key={item.field}>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs text-gray-400 font-medium">{item.label}</label>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          checked={(formData[item.field] || "none") === "hold"}
                          onChange={() => {
                            handleFieldChange(item.field, "hold")
                            handleBlur()
                          }}
                          className="w-3 h-3 cursor-pointer accent-[#E8700A]"
                        />
                        <span className="text-xs text-gray-400">Hold</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          checked={(formData[item.field] || "none") === "released"}
                          onChange={() => {
                            handleFieldChange(item.field, "released")
                            handleBlur()
                          }}
                          className="w-3 h-3 cursor-pointer accent-[#E8700A]"
                        />
                        <span className="text-xs text-gray-400">Released</span>
                      </label>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={formData[item.noteField] || ""}
                    onChange={(e) => handleFieldChange(item.noteField, e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Note"
                    className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Carrier</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.carrier_hold || false}
                    onChange={(e) => {
                      handleFieldChange("carrier_hold", e.target.checked)
                      handleBlur()
                    }}
                    className="w-4 h-4 rounded bg-white/5 border border-white/10 cursor-pointer accent-[#E8700A]"
                  />
                  <span className="text-xs text-gray-400">Carrier Hold</span>
                </label>
                <input
                  type="text"
                  value={formData.carrier_hold_note || ""}
                  onChange={(e) => handleFieldChange("carrier_hold_note", e.target.value)}
                  onBlur={handleBlur}
                  placeholder="Note"
                  className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 mt-1"
                />
              </div>
            </div>
          </div>

          {/* Reference Fields */}
          <div className="bg-[#1F2937] rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Reference</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Master BOL", field: "mbol" as const },
                { label: "House BOL", field: "house_bol" as const },
                { label: "Seal #", field: "seal_number" as const },
                { label: "Reference #", field: "reference_number" as const },
                { label: "Vessel Name", field: "vessel_name" as const },
                { label: "Voyage", field: "voyage" as const },
                { label: "Purchase Order #", field: "purchase_order" as const },
                { label: "Shipment #", field: "shipment_number" as const },
                { label: "Pick Up #", field: "pickup_number" as const },
                { label: "Appointment #", field: "appointment_number" as const },
                { label: "Return #", field: "return_number" as const },
                { label: "Reservation #", field: "reservation_number" as const },
              ].map((item) => (
                <div key={item.field}>
                  <label className="block text-xs text-gray-500 mb-1">{item.label}</label>
                  <input
                    type="text"
                    value={formData[item.field] || ""}
                    onChange={(e) => handleFieldChange(item.field, e.target.value)}
                    onBlur={handleBlur}
                    className={DATE_INPUT_CLASS}
                  />
                </div>
              ))}
            </div>
          </div>

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
          handleFieldChange("customer_id", customer.id)
          setFormData((prev) => ({
            ...prev,
            customer_id: customer.id,
            customers: { ...prev.customers!, id: customer.id, name: customer.name },
          }))
          handleBlur()
        }}
      />
    </div>
  )
}
