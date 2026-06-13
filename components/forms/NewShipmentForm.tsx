// components/forms/NewShipmentForm.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type Customer = { id: string; name: string }
type Container = {
  id: string
  container_number: string
  bol_number: string | null
  size: string | null
  type: string | null
  status: string
  vessels: { name: string; terminal: string } | null
}
type Driver = { id: string; name: string; phone: string; status: string }

const LOAD_TYPES = ["Import", "Export", "Road", "Bill Only"] as const
const ROUTE_TYPES = [
  "Pick and Run + Live",
  "Pick and Run + Drop & Hook",
  "Prepull + Live",
  "Prepull + Drop & Hook",
  "One Way Move",
  "Shunt",
] as const

export function NewShipmentForm({
  customers,
  containers,
  drivers,
}: {
  customers: Customer[]
  containers: Container[]
  drivers: Driver[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"manual" | "automatic">("manual")

  const [form, setForm] = useState({
    customer_id: "",
    container_id: "",
    driver_id: "",
    load_type: "Import",
    route_type: "",
    pickup_location: "",
    delivery_location: "",
    scheduled_pickup: "",
    chassis_number: "",
    rate: "",
    notes: "",
  })

  const selectedContainer = containers.find((c) => c.id === form.container_id)
  const availableDrivers = drivers.filter((d) => d.status === "Available")

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.customer_id) {
      setError("Please select a customer")
      return
    }
    if (!form.pickup_location) {
      setError("Please enter a pickup location")
      return
    }
    if (!form.delivery_location) {
      setError("Please enter a delivery location")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: form.customer_id,
          container_id: form.container_id || null,
          driver_id: form.driver_id || null,
          load_type: form.load_type,
          route_type: form.route_type || null,
          pickup_location: form.pickup_location,
          delivery_location: form.delivery_location,
          scheduled_pickup: form.scheduled_pickup || null,
          chassis_number: form.chassis_number || null,
          rate: form.rate ? parseFloat(form.rate) : null,
          notes: form.notes || null,
          status: form.driver_id ? "Assigned" : "Created",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create shipment")
      }

      router.push("/dashboard/shipments")
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create shipment"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
  const selectClass =
    "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50 appearance-none cursor-pointer"
  const labelClass = "block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5"

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex bg-[#111827] rounded-xl border border-white/5 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("manual")}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "manual"
              ? "bg-[#E8700A] text-white shadow-lg shadow-[#E8700A]/25"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Manual Entry
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("automatic")}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === "automatic"
              ? "bg-[#E8700A] text-white shadow-lg shadow-[#E8700A]/25"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          Automatic
        </button>
      </div>

      {/* Automatic Tab — Coming Soon */}
      {activeTab === "automatic" && (
        <div className="bg-[#111827] rounded-xl border border-white/5 p-8">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#E8700A]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#E8700A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9.75m0 0-2.625 2.625M9.75 12l-2.625-2.625M8.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Automatic Load Creation</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
                Upload a BOL, delivery order, or booking confirmation and we'll automatically extract
                the shipment details and pre-fill the form for you.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E8700A]/10 text-[#E8700A] border border-[#E8700A]/20">
                Coming Soon — On the Roadmap
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Supported formats: PDF, images (JPG/PNG), and scanned documents via OCR
            </p>
          </div>
        </div>
      )}

      {/* Manual Entry Form */}
      {activeTab === "manual" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Load Type & Route Type */}
          <div className="bg-[#111827] rounded-xl border border-white/5 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-white">Load Configuration</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Load Type */}
              <div>
                <label className={labelClass}>
                  Load Type <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LOAD_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateField("load_type", type)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        form.load_type === type
                          ? "bg-[#E8700A]/15 border-[#E8700A]/40 text-[#FF8C21]"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Route Type */}
              <div>
                <label className={labelClass}>
                  Route Type
                </label>
                <select
                  value={form.route_type}
                  onChange={(e) => updateField("route_type", e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-[#111827]">Select route type...</option>
                  {ROUTE_TYPES.map((type) => (
                    <option key={type} value={type} className="bg-[#111827]">{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Customer & Container */}
          <div className="bg-[#111827] rounded-xl border border-white/5 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-white">Order Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer */}
              <div>
                <label className={labelClass}>
                  Customer <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.customer_id}
                  onChange={(e) => updateField("customer_id", e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-[#111827]">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#111827]">{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Container */}
              <div>
                <label className={labelClass}>Container</label>
                <select
                  value={form.container_id}
                  onChange={(e) => updateField("container_id", e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-[#111827]">Select container (optional)...</option>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#111827]">
                      {c.container_number} — {c.size}&apos; {c.type} — {c.status}{c.vessels ? ` (${c.vessels.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected Container Info */}
            {selectedContainer && (
              <div className="px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 uppercase">Container</p>
                    <p className="text-sm text-gray-300 font-mono">{selectedContainer.container_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 uppercase">BOL</p>
                    <p className="text-sm text-gray-300">{selectedContainer.bol_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 uppercase">Size/Type</p>
                    <p className="text-sm text-gray-300">{selectedContainer.size}&apos; {selectedContainer.type}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 uppercase">Vessel</p>
                    <p className="text-sm text-gray-300">
                      {selectedContainer.vessels ? `${selectedContainer.vessels.name} (${selectedContainer.vessels.terminal})` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Locations */}
          <div className="bg-[#111827] rounded-xl border border-white/5 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-white">Pickup & Delivery</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Pickup Location <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.pickup_location}
                  onChange={(e) => updateField("pickup_location", e.target.value)}
                  placeholder="e.g., Barbours Cut Terminal"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  Delivery Location <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.delivery_location}
                  onChange={(e) => updateField("delivery_location", e.target.value)}
                  placeholder="e.g., 4200 Navigation Blvd, Houston, TX"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Scheduled Pickup</label>
              <input
                type="datetime-local"
                value={form.scheduled_pickup}
                onChange={(e) => updateField("scheduled_pickup", e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          </div>

          {/* Driver & Equipment */}
          <div className="bg-[#111827] rounded-xl border border-white/5 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-white">Driver & Equipment</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Assign Driver</label>
                <select
                  value={form.driver_id}
                  onChange={(e) => updateField("driver_id", e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-[#111827]">Assign later...</option>
                  {availableDrivers.length > 0 ? (
                    availableDrivers.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#111827]">
                        {d.name} — {d.phone}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled className="bg-[#111827]">No drivers available</option>
                  )}
                </select>
                {availableDrivers.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-400">All drivers are currently on jobs or off duty</p>
                )}
                {drivers.filter((d) => d.status !== "Available").length > 0 && availableDrivers.length > 0 && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    {availableDrivers.length} of {drivers.length} drivers available
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Chassis Number</label>
                <input
                  type="text"
                  value={form.chassis_number}
                  onChange={(e) => updateField("chassis_number", e.target.value)}
                  placeholder="e.g., THCH-001"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Billing & Notes */}
          <div className="bg-[#111827] rounded-xl border border-white/5 p-6 space-y-5">
            <h3 className="text-sm font-semibold text-white">Billing & Notes</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Rate ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.rate}
                  onChange={(e) => updateField("rate", e.target.value)}
                  placeholder="e.g., 450.00"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
                placeholder="Any special instructions, delivery notes, etc."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <a
              href="/dashboard/shipments"
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </a>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors shadow-lg shadow-[#E8700A]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : (
                  "Create Shipment"
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
