"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Plus, X, Pencil, MapPin, Building2, Route, DollarSign, Loader2, ChevronDown, Trash2, Save, Check, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import ZoneMap from "@/components/maps/ZoneMap"

// ─── Action Buttons (rendered in parent tab bar) ─────────────────────
export function LaneRateActions({
  onAddOrigin,
  onAddZone,
  onDeleteOrigin,
  originName,
}: {
  onAddOrigin: () => void
  onAddZone: () => void
  onDeleteOrigin: () => void
  originName: string | null
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onAddZone}
        className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-[#E8700A]"
        title="Add Zone"
      >
        <Route size={15} />
      </button>
      <button
        onClick={onAddOrigin}
        className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-[#E8700A]"
        title="Add Origin"
      >
        <Plus size={15} />
      </button>
      {originName && (
        <button
          onClick={onDeleteOrigin}
          className="p-1.5 hover:bg-red-500/20 rounded transition-colors text-gray-500 hover:text-red-400"
          title={`Delete ${originName}`}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

// ─── Database Types ───────────────────────────────────────────────────
type LaneOrigin = {
  id: string
  name: string
  code: string
  address: string
  city: string
  state: string
  zip: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type LaneZone = {
  id: string
  origin_id: string
  zone_number: number
  name: string
  min_miles: number | null
  max_miles: number | null
  reference_city: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type DriverGroup = {
  id: string
  name: string
  pay_type: "hourly" | "per_move" | "per_mile" | "percentage"
  is_active: boolean
  created_at: string
  updated_at: string
}

type LaneRate = {
  id: string
  zone_id: string
  driver_group_id: string
  rate: number
  charge_code: string
  service_type: string
  unit_of_measure: string
  effective_date: string
  is_active: boolean
  created_at: string
  updated_at: string
  driver_group?: DriverGroup
  zone?: LaneZone
}

interface LoadingState {
  origins: boolean
  zones: boolean
  rates: boolean
  driverGroups: boolean
}

// ─── Add Origin Modal ──────────────────────────────────────────────────
function AddOriginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    state: "TX",
    zip: "",
    latitude: "",
    longitude: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleGeocode = async () => {
    const parts = [formData.address, formData.city, formData.state, formData.zip].filter(Boolean)
    if (parts.length === 0) {
      setError("Enter an address, city, or zip code first")
      return
    }

    setIsGeocoding(true)
    setError(null)

    try {
      const res = await fetch("/api/geocoding/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: parts.join(", "), mode: "single" }),
      })
      const data = (await res.json()) as { found?: boolean; lat?: number; lng?: number; error?: string }

      if (res.status === 401 || res.status === 403) {
        setError(data.error || "Not allowed to geocode — check your session and role")
        return
      }
      if (!res.ok) {
        setError("Geocoding request failed — enter coordinates manually")
        return
      }

      if (data.found && typeof data.lat === "number" && typeof data.lng === "number") {
        const lat = data.lat
        const lng = data.lng
        setFormData((prev) => ({
          ...prev,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        }))
      } else {
        setError("No results found — try a more specific address")
      }
    } catch {
      setError("Geocoding failed — enter coordinates manually")
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (!formData.name || !formData.code) {
      setError("Name and code are required")
      setIsSubmitting(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: insertError } = await supabase.from("lane_origins").insert([
        {
          name: formData.name,
          code: formData.code,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state,
          zip: formData.zip || null,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
          is_active: true,
        },
      ])

      if (insertError) throw insertError

      setFormData({ name: "", code: "", address: "", city: "", state: "TX", zip: "", latitude: "", longitude: "" })
      onClose()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create origin")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111827]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MapPin size={20} className="text-[#E8700A]" />
            Add New Origin
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Origin Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              placeholder="e.g. Port of Houston"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Code *
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              placeholder="e.g. HOU"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              placeholder="Street address"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                City
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="Houston"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                State
              </label>
              <select
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              >
                <option value="TX" className="bg-[#111827] text-white">TX</option>
                <option value="CA" className="bg-[#111827] text-white">CA</option>
                <option value="FL" className="bg-[#111827] text-white">FL</option>
                <option value="NY" className="bg-[#111827] text-white">NY</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Zip Code
              </label>
              <input
                type="text"
                name="zip"
                value={formData.zip}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="77571"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Coordinates
              </label>
              <button
                type="button"
                onClick={handleGeocode}
                disabled={isGeocoding}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[#E8700A] hover:text-[#FF8C21] bg-[#E8700A]/10 hover:bg-[#E8700A]/20 rounded transition-colors disabled:opacity-50"
              >
                {isGeocoding ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                Lookup from address
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="Latitude (29.7260)"
              />
              <input
                type="text"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="Longitude (-95.0079)"
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</div>}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Origin
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Zone Modal ────────────────────────────────────────────────────
function AddZoneModal({
  open,
  onClose,
  originId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  originId: string | null
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    zone_number: "",
    name: "",
    min_miles: "",
    max_miles: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !originId) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (!formData.zone_number || !formData.name) {
      setError("Zone number and name are required")
      setIsSubmitting(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: insertError } = await supabase.from("lane_zones").insert([
        {
          origin_id: originId,
          zone_number: parseInt(formData.zone_number, 10),
          name: formData.name,
          min_miles: formData.min_miles ? parseInt(formData.min_miles, 10) : null,
          max_miles: formData.max_miles ? parseInt(formData.max_miles, 10) : null,
          is_active: true,
        },
      ])

      if (insertError) throw insertError

      setFormData({ zone_number: "", name: "", min_miles: "", max_miles: "" })
      onClose()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create zone")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111827]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Route size={20} className="text-[#E8700A]" />
            Add New Zone
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Zone Number *
              </label>
              <input
                type="number"
                name="zone_number"
                value={formData.zone_number}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Zone Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="e.g. Zone 1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Min Miles
              </label>
              <input
                type="number"
                name="min_miles"
                value={formData.min_miles}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Max Miles
              </label>
              <input
                type="number"
                name="max_miles"
                value={formData.max_miles}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="10"
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</div>}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Zone
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Rate Modal ───────────────────────────────────────────────────
function EditRateModal({
  open,
  onClose,
  zone,
  driverGroup,
  existingRate,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  zone: LaneZone | null
  driverGroup: DriverGroup | null
  existingRate: LaneRate | null
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    rate: existingRate?.rate?.toString() || "",
    charge_code: existingRate?.charge_code || "DRAYAGE",
    service_type: existingRate?.service_type || "lane",
    unit_of_measure: existingRate?.unit_of_measure || "per_move",
    effective_date: existingRate?.effective_date || new Date().toISOString().split("T")[0],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !zone || !driverGroup) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (!formData.rate) {
      setError("Rate amount is required")
      setIsSubmitting(false)
      return
    }

    try {
      const supabase = createClient()

      if (existingRate) {
        const { error: updateError } = await supabase
          .from("lane_rates")
          .update({
            rate: parseFloat(formData.rate),
            charge_code: formData.charge_code,
            service_type: formData.service_type,
            unit_of_measure: formData.unit_of_measure,
            effective_date: formData.effective_date,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRate.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from("lane_rates").insert([
          {
            zone_id: zone.id,
            driver_group_id: driverGroup.id,
            rate: parseFloat(formData.rate),
            charge_code: formData.charge_code,
            service_type: formData.service_type,
            unit_of_measure: formData.unit_of_measure,
            effective_date: formData.effective_date,
            is_active: true,
          },
        ])

        if (insertError) throw insertError
      }

      onClose()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rate")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111827]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign size={20} className="text-[#E8700A]" />
            {existingRate ? "Edit" : "Add"} Rate
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-lg space-y-1">
            <p className="text-xs text-gray-500">Zone</p>
            <p className="text-sm font-medium text-white">
              {zone.zone_number} - {zone.name}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-lg space-y-1">
            <p className="text-xs text-gray-500">Driver Group</p>
            <p className="text-sm font-medium text-white">{driverGroup.name}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Rate Amount *
            </label>
            <input
              type="number"
              name="rate"
              value={formData.rate}
              onChange={handleChange}
              step="0.01"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              placeholder="90.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Charge Code
              </label>
              <input
                type="text"
                name="charge_code"
                value={formData.charge_code}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="DRAYAGE"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Unit
              </label>
              <select
                name="unit_of_measure"
                value={formData.unit_of_measure}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              >
                <option value="per_move" className="bg-[#111827] text-white">Per Move</option>
                <option value="per_mile" className="bg-[#111827] text-white">Per Mile</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Effective Date
            </label>
            <input
              type="date"
              name="effective_date"
              value={formData.effective_date}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
            />
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</div>}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {existingRate ? "Update" : "Add"} Rate
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Origin Confirmation Modal ─────────────────────────────────
function DeleteOriginModal({
  open,
  onClose,
  origin,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  origin: LaneOrigin | null
  onSuccess: () => void
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !origin) return null

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)

    try {
      const supabase = createClient()

      // First delete lane_rates for all zones belonging to this origin
      const { data: originZones } = await supabase
        .from("lane_zones")
        .select("id")
        .eq("origin_id", origin.id)

      if (originZones && originZones.length > 0) {
        const zoneIds = originZones.map((z: { id: string }) => z.id)
        const { error: ratesError } = await supabase
          .from("lane_rates")
          .delete()
          .in("zone_id", zoneIds)

        if (ratesError) throw ratesError
      }

      // Then delete all zones for this origin
      const { error: zonesError } = await supabase
        .from("lane_zones")
        .delete()
        .eq("origin_id", origin.id)

      if (zonesError) throw zonesError

      // Finally delete the origin itself
      const { error: originError } = await supabase
        .from("lane_origins")
        .delete()
        .eq("id", origin.id)

      if (originError) throw originError

      onClose()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete origin")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111827]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Trash2 size={20} className="text-red-400" />
            Delete Origin
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-300">
            Are you sure you want to delete <span className="font-semibold text-white">{origin.name}</span>?
          </p>
          <p className="text-xs text-gray-500">
            This will permanently remove this origin along with all its zones and associated lane rates. This action cannot be undone.
          </p>

          {error && <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</div>}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete Origin
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ──────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="bg-[#0B1120] rounded-lg border border-white/5 overflow-hidden">
      <div className="animate-pulse">
        <div className="h-12 bg-[#111827] border-b border-white/10" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-b border-white/10 h-12 bg-[#0B1120]" />
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────
interface LaneRateMatrixViewProps {
  onActionsReady?: (actions: {
    onAddOrigin: () => void
    onAddZone: () => void
    onDeleteOrigin: () => void
    originName: string | null
  } | null) => void
}

export default function LaneRateMatrixView({ onActionsReady }: LaneRateMatrixViewProps) {
  // State
  const [origins, setOrigins] = useState<LaneOrigin[]>([])
  const [zones, setZones] = useState<LaneZone[]>([])
  const [rates, setRates] = useState<LaneRate[]>([])
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([])

  const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null)
  const [loading, setLoading] = useState<LoadingState>({
    origins: true,
    zones: false,
    rates: false,
    driverGroups: true,
  })

  const [addOriginOpen, setAddOriginOpen] = useState(false)
  const [deleteOriginOpen, setDeleteOriginOpen] = useState(false)
  const [addZoneOpen, setAddZoneOpen] = useState(false)
  const [editRateOpen, setEditRateOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState<LaneZone | null>(null)
  const [selectedDriverGroup, setSelectedDriverGroup] = useState<DriverGroup | null>(null)
  const [selectedRate, setSelectedRate] = useState<LaneRate | null>(null)

  // Inline editable mile ranges: { [zoneId]: { min: string, max: string } }
  const [editingMiles, setEditingMiles] = useState<Record<string, { min: string; max: string }>>({})
  const [savingZoneId, setSavingZoneId] = useState<string | null>(null)

  const supabase = createClient()

  // Filter out hourly groups — they are not distance-dependent
  const rateGroups = useMemo(
    () => driverGroups.filter((g) => g.pay_type !== "hourly"),
    [driverGroups]
  )

  const selectedOrigin = origins.find((o) => o.id === selectedOriginId)

  // Push action callbacks to parent tab bar
  useEffect(() => {
    if (onActionsReady) {
      onActionsReady({
        onAddOrigin: () => setAddOriginOpen(true),
        onAddZone: () => setAddZoneOpen(true),
        onDeleteOrigin: () => setDeleteOriginOpen(true),
        originName: selectedOrigin?.name || null,
      })
    }
    return () => {
      if (onActionsReady) onActionsReady(null)
    }
  }, [onActionsReady, selectedOrigin?.name])

  // Initialize editable miles when zones change
  useEffect(() => {
    const mileEdits: Record<string, { min: string; max: string }> = {}
    zones.forEach((z) => {
      mileEdits[z.id] = {
        min: z.min_miles != null ? z.min_miles.toString() : "",
        max: z.max_miles != null ? z.max_miles.toString() : "",
      }
    })
    setEditingMiles(mileEdits)
  }, [zones])

  // Save zone mile range
  const handleSaveMiles = useCallback(async (zoneId: string) => {
    const edit = editingMiles[zoneId]
    if (!edit) return

    setSavingZoneId(zoneId)
    try {
      const { error } = await supabase
        .from("lane_zones")
        .update({
          min_miles: edit.min ? parseInt(edit.min, 10) : null,
          max_miles: edit.max ? parseInt(edit.max, 10) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", zoneId)

      if (error) throw error

      // Update local zones state
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? { ...z, min_miles: edit.min ? parseInt(edit.min, 10) : null, max_miles: edit.max ? parseInt(edit.max, 10) : null }
            : z
        )
      )
    } catch (err) {
      console.error("Failed to save miles:", err)
    } finally {
      setSavingZoneId(null)
    }
  }, [editingMiles, supabase])

  // Check if miles have been modified for a zone
  const isMilesModified = useCallback((zone: LaneZone) => {
    const edit = editingMiles[zone.id]
    if (!edit) return false
    const origMin = zone.min_miles != null ? zone.min_miles.toString() : ""
    const origMax = zone.max_miles != null ? zone.max_miles.toString() : ""
    return edit.min !== origMin || edit.max !== origMax
  }, [editingMiles])

  // Fetch origins
  useEffect(() => {
    const fetchOrigins = async () => {
      try {
        const { data, error } = await supabase
          .from("lane_origins")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true })

        if (error) throw error
        setOrigins(data || [])

        if (data && data.length > 0) {
          setSelectedOriginId(data[0].id)
        }
      } catch (err) {
        console.error("Failed to fetch origins:", err)
      } finally {
        setLoading((prev) => ({ ...prev, origins: false }))
      }
    }

    fetchOrigins()
  }, [supabase])

  // Fetch driver groups
  useEffect(() => {
    const fetchDriverGroups = async () => {
      try {
        const { data, error } = await supabase
          .from("driver_groups")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true })

        if (error) throw error
        setDriverGroups(data || [])
      } catch (err) {
        console.error("Failed to fetch driver groups:", err)
      } finally {
        setLoading((prev) => ({ ...prev, driverGroups: false }))
      }
    }

    fetchDriverGroups()
  }, [supabase])

  // Fetch zones for selected origin
  useEffect(() => {
    if (!selectedOriginId) {
      setZones([])
      return
    }

    const fetchZones = async () => {
      setLoading((prev) => ({ ...prev, zones: true }))
      try {
        const { data, error } = await supabase
          .from("lane_zones")
          .select("*")
          .eq("origin_id", selectedOriginId)
          .eq("is_active", true)
          .order("zone_number", { ascending: true })

        if (error) throw error
        setZones(data || [])
      } catch (err) {
        console.error("Failed to fetch zones:", err)
      } finally {
        setLoading((prev) => ({ ...prev, zones: false }))
      }
    }

    fetchZones()
  }, [selectedOriginId, supabase])

  // Fetch rates for selected origin's zones
  useEffect(() => {
    if (!selectedOriginId || zones.length === 0) {
      setRates([])
      return
    }

    const fetchRates = async () => {
      setLoading((prev) => ({ ...prev, rates: true }))
      try {
        const zoneIds = zones.map((z) => z.id)
        const { data, error } = await supabase
          .from("lane_rates")
          .select(
            `
            id,
            zone_id,
            driver_group_id,
            rate,
            charge_code,
            service_type,
            unit_of_measure,
            effective_date,
            is_active,
            created_at,
            updated_at,
            driver_group:driver_group_id (id, name, pay_type, is_active),
            zone:zone_id (id, zone_number, name)
          `
          )
          .in("zone_id", zoneIds)
          .eq("is_active", true)
          .order("effective_date", { ascending: false })

        if (error) throw error
        // Supabase returns joined relations as arrays — flatten to single objects
        const mapped = (data || []).map((r: Record<string, unknown>) => ({
          ...r,
          driver_group: Array.isArray(r.driver_group) ? r.driver_group[0] : r.driver_group,
          zone: Array.isArray(r.zone) ? r.zone[0] : r.zone,
        })) as LaneRate[]
        setRates(mapped)
      } catch (err) {
        console.error("Failed to fetch rates:", err)
      } finally {
        setLoading((prev) => ({ ...prev, rates: false }))
      }
    }

    fetchRates()
  }, [selectedOriginId, zones, supabase])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (selectedOriginId) {
      const { data } = await supabase
        .from("lane_zones")
        .select("*")
        .eq("origin_id", selectedOriginId)
        .eq("is_active", true)
        .order("zone_number", { ascending: true })

      setZones(data || [])
    }
  }, [selectedOriginId, supabase])

  // Open rate editor
  const handleEditRate = (zone: LaneZone, driverGroup: DriverGroup, rate?: LaneRate) => {
    setSelectedZone(zone)
    setSelectedDriverGroup(driverGroup)
    setSelectedRate(rate || null)
    setEditRateOpen(true)
  }

  // Get rate for zone/group combination
  const getRate = (zoneId: string, groupId: string): LaneRate | undefined => {
    return rates.find((r) => r.zone_id === zoneId && r.driver_group_id === groupId)
  }

  // Format rate display
  const formatRate = (rate: LaneRate | undefined, zone: LaneZone): string => {
    if (!rate) return "—"

    const amount = rate.rate.toFixed(2)
    const isOTR = zone.zone_number === 9
    const unit = isOTR ? "/mi" : ""

    return `$${amount}${unit}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* No origins state */}
      {!loading.origins && origins.length === 0 && (
        <div className="py-12 flex-1 text-center">
          <Building2 size={28} className="mx-auto mb-2 text-gray-600" />
          <p className="text-sm text-gray-400 mb-2">No origins yet</p>
          <button
            onClick={() => setAddOriginOpen(true)}
            className="px-4 py-2 bg-[#E8700A] hover:bg-[#FF8C21] text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Create Origin
          </button>
        </div>
      )}

      {/* Main content: Map + Table side by side */}
      {origins.length > 0 && selectedOrigin && (
        <div className="flex-1 overflow-auto p-4">
          {loading.zones || loading.rates || loading.driverGroups ? (
            <TableSkeleton />
          ) : (
            <div className="flex gap-4 items-stretch">
              {/* Zone Map (left) */}
              <div className="w-[400px] flex-shrink-0 flex flex-col">
                {/* Origin label + dropdown — always visible */}
                <div className="bg-[#111827] rounded-t-lg border border-b-0 border-white/5 px-4 py-2 flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Origin</span>
                  <div className="relative flex-1">
                    <select
                      value={selectedOriginId || ""}
                      onChange={(e) => setSelectedOriginId(e.target.value || null)}
                      className="w-full appearance-none pl-3 pr-7 py-1 bg-white/5 border border-white/10 rounded text-sm font-medium text-white focus:outline-none focus:border-[#E8700A] transition-colors cursor-pointer"
                    >
                      {origins.map((origin) => (
                        <option key={origin.id} value={origin.id} className="bg-[#111827] text-white">
                          {origin.name} {origin.code ? `(${origin.code})` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                {/* Map fills remaining height, or placeholder if no coordinates */}
                <div className="flex-1 border border-white/5 border-t-0 rounded-b-lg overflow-hidden">
                  {selectedOrigin.latitude && selectedOrigin.longitude ? (
                    <ZoneMap
                      latitude={selectedOrigin.latitude}
                      longitude={selectedOrigin.longitude}
                      originName={selectedOrigin.name}
                      zones={zones}
                    />
                  ) : (
                    <div className="h-full min-h-[300px] bg-[#0B1120] flex items-center justify-center">
                      <div className="text-center">
                        <MapPin size={24} className="mx-auto mb-2 text-gray-600" />
                        <p className="text-xs text-gray-500">No coordinates set</p>
                        <p className="text-[10px] text-gray-600 mt-1">Add latitude &amp; longitude to show map</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rate Table (right) */}
              <div className="flex-1 min-w-0">
                {zones.length === 0 ? (
                  <div className="bg-[#0B1120] rounded-lg border border-white/5 p-12 text-center h-full flex flex-col items-center justify-center">
                    <Route size={32} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-sm font-medium text-gray-400 mb-3">No zones configured for this origin</p>
                    <button
                      onClick={() => setAddZoneOpen(true)}
                      className="px-4 py-2 bg-[#E8700A] hover:bg-[#FF8C21] text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Add First Zone
                    </button>
                  </div>
                ) : (
                  <div className="bg-[#0B1120] rounded-lg border border-white/5 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-[#111827]">
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Zone
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider" style={{ width: "60px" }}>
                            From
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider" style={{ width: "60px" }}>
                            To
                          </th>
                          <th className="w-8" />
                          {rateGroups.map((group) => {
                            const displayName = group.name
                              .replace(/\s*-\s*(Per Move|Per Mile|Hourly|Percentage)$/i, "")
                              .toUpperCase()
                            return (
                              <th
                                key={group.id}
                                className="px-2 py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider"
                              >
                                {displayName}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {zones.map((zone) => {
                          const mileEdit = editingMiles[zone.id]
                          const modified = isMilesModified(zone)
                          const saving = savingZoneId === zone.id
                          return (
                            <tr key={zone.id} className="hover:bg-white/[0.03] transition-colors">
                              <td className="px-4 py-2 font-medium text-white whitespace-nowrap text-sm">
                                {zone.zone_number === 9 ? (
                                  <span className="flex items-center gap-1.5">
                                    <span>{zone.name}</span>
                                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded text-[10px] font-medium">
                                      OTR
                                    </span>
                                  </span>
                                ) : (
                                  zone.name
                                )}
                              </td>
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="number"
                                  value={mileEdit?.min ?? ""}
                                  onChange={(e) =>
                                    setEditingMiles((prev) => ({
                                      ...prev,
                                      [zone.id]: { ...prev[zone.id], min: e.target.value },
                                    }))
                                  }
                                  className="w-14 px-1.5 py-1 bg-white/5 border border-white/10 rounded text-xs text-center text-white focus:outline-none focus:border-[#E8700A] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-1 py-1 text-center">
                                <input
                                  type="number"
                                  value={mileEdit?.max ?? ""}
                                  onChange={(e) =>
                                    setEditingMiles((prev) => ({
                                      ...prev,
                                      [zone.id]: { ...prev[zone.id], max: e.target.value },
                                    }))
                                  }
                                  className="w-14 px-1.5 py-1 bg-white/5 border border-white/10 rounded text-xs text-center text-white focus:outline-none focus:border-[#E8700A] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-0 py-1 text-center">
                                {modified && (
                                  <button
                                    onClick={() => handleSaveMiles(zone.id)}
                                    disabled={saving}
                                    className="p-1 rounded hover:bg-[#E8700A]/20 text-[#E8700A] transition-colors disabled:opacity-50"
                                    title="Save mile range"
                                  >
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                  </button>
                                )}
                              </td>
                              {rateGroups.map((group) => {
                                const rate = getRate(zone.id, group.id)
                                return (
                                  <td
                                    key={`${zone.id}-${group.id}`}
                                    className="px-1 py-1.5 text-center"
                                    onClick={() => handleEditRate(zone, group, rate)}
                                  >
                                    <button
                                      className={`inline-block min-w-[64px] px-2 py-1 rounded text-sm font-medium transition-all ${
                                        rate
                                          ? "bg-[#E8700A]/10 text-[#FF8C21] hover:bg-[#E8700A]/20 cursor-pointer"
                                          : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-400 cursor-pointer"
                                      }`}
                                    >
                                      {formatRate(rate, zone)}
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AddOriginModal
        open={addOriginOpen}
        onClose={() => setAddOriginOpen(false)}
        onSuccess={async () => {
          const { data } = await supabase
            .from("lane_origins")
            .select("*")
            .eq("is_active", true)
            .order("name", { ascending: true })
          const newOrigins = data || []
          setOrigins(newOrigins)
          // If the current selection is gone (or nothing selected), pick the first
          if (!selectedOriginId || !newOrigins.find((o) => o.id === selectedOriginId)) {
            setSelectedOriginId(newOrigins.length > 0 ? newOrigins[0].id : null)
          }
        }}
      />

      <DeleteOriginModal
        open={deleteOriginOpen}
        onClose={() => setDeleteOriginOpen(false)}
        origin={selectedOrigin || null}
        onSuccess={async () => {
          const { data } = await supabase
            .from("lane_origins")
            .select("*")
            .eq("is_active", true)
            .order("name", { ascending: true })
          const remaining = data || []
          setOrigins(remaining)
          // Select the first remaining origin, or clear selection
          setSelectedOriginId(remaining.length > 0 ? remaining[0].id : null)
          setZones([])
          setRates([])
        }}
      />

      <AddZoneModal
        open={addZoneOpen}
        onClose={() => setAddZoneOpen(false)}
        originId={selectedOriginId}
        onSuccess={handleRefresh}
      />

      <EditRateModal
        open={editRateOpen}
        onClose={() => {
          setEditRateOpen(false)
          setSelectedZone(null)
          setSelectedDriverGroup(null)
          setSelectedRate(null)
        }}
        zone={selectedZone}
        driverGroup={selectedDriverGroup}
        existingRate={selectedRate}
        onSuccess={async () => {
          if (selectedOriginId && zones.length > 0) {
            const zoneIds = zones.map((z) => z.id)
            const { data } = await supabase
              .from("lane_rates")
              .select(
                `
                id,
                zone_id,
                driver_group_id,
                rate,
                charge_code,
                service_type,
                unit_of_measure,
                effective_date,
                is_active,
                created_at,
                updated_at,
                driver_group:driver_group_id (id, name, pay_type, is_active),
                zone:zone_id (id, zone_number, name)
              `
              )
              .in("zone_id", zoneIds)
              .eq("is_active", true)
              .order("effective_date", { ascending: false })

            const mapped = (data || []).map((r: Record<string, unknown>) => ({
              ...r,
              driver_group: Array.isArray(r.driver_group) ? r.driver_group[0] : r.driver_group,
              zone: Array.isArray(r.zone) ? r.zone[0] : r.zone,
            })) as LaneRate[]
            setRates(mapped)
          }
          setEditRateOpen(false)
          setSelectedZone(null)
          setSelectedDriverGroup(null)
          setSelectedRate(null)
        }}
      />
    </div>
  )
}
