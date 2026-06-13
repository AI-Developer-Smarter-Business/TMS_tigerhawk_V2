"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import {
  Search, Plus, Pencil, X, Loader2,
  MapPin, Route, Trash2, ArrowLeft, Copy, Zap, Check, Layers,
  ArrowUpDown, GripVertical, ArrowUp, ArrowDown, Map as MapIcon,
} from "lucide-react"
import dynamic from "next/dynamic"

const ZoneMap = dynamic(() => import("@/components/maps/ZoneMap"), { ssr: false })

// ─── Types ──────────────────────────────────────────────────────
type RateProfile = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  effective_date: string | null
  expires_date: string | null
  lane_count: number
  driver_groups: Array<{ id: string; name: string }>
  created_at: string
  updated_at: string
}

type RateProfileLane = {
  id: string
  rate_profile_id: string
  lane_type: "zonal" | "defined"
  name: string | null
  anchor_point_id: string | null
  anchor_role: "origin" | "destination" | null
  zone_id: string | null
  pickup_location: string | null
  delivery_location: string | null
  return_location: string | null
  direction: string
  priority: number
  is_active: boolean
  origin_name: string | null
  origin_code: string | null
  zone_name: string | null
  zone_number: number | null
  zone_miles: string | null
  zone_min_miles: number | null
  zone_max_miles: number | null
  charge_count: number
  condition_count: number
}

type RateProfileCharge = {
  id: string
  lane_id: string
  charge_code: string
  charge_name: string
  calculation_mode: string
  status_from: string | null
  status_to: string | null
  event: string | null
  event_location: string | null
  leg_from: string | null
  leg_from_location: string | null
  leg_to: string | null
  leg_to_location: string | null
  unit_of_measure: string
  rate: number
  min_amount: number | null
  max_amount: number | null
  free_units: number
  auto_add: boolean
  effective_date_based_on: string | null
  description: string | null
  sort_order: number
  is_active: boolean
  conditions: RateProfileCondition[]
}

type RateProfileCondition = {
  id: string
  lane_id: string | null
  charge_id: string | null
  condition_type: string
  operator: string
  condition_value: unknown
  logic_group: number
  logic_operator: string
}

type ChargeCode = {
  code: string
  name: string
  category: string | null
}

type LaneOrigin = {
  id: string
  name: string
  code: string
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
}

type LaneZone = {
  id: string
  zone_number: number
  name: string
  min_miles: number
  max_miles: number
  origin_id: string
  reference_city?: string | null
}

type LaneWithCharges = RateProfileLane & {
  charges: RateProfileCharge[]
  chargesLoading: boolean
}

// ─── Style Constants ─────────────────────────────────────────
const S = {
  panel: "bg-[#1e2330] border-[#2a3040]",
  panelHeader: "bg-[#242938] border-[#2a3040]",
  input: "bg-[#2a3040] border-[#363f52] text-white placeholder-gray-500 focus:border-[#E8700A] focus:outline-none",
  row: "hover:bg-[#262c3a] transition-colors",
  rowAlt: "bg-[#222735]",
  divider: "border-[#2a3040]",
  muted: "text-gray-500",
  label: "text-[11px] font-semibold text-gray-400 uppercase tracking-wide",
}

// ─── Constants ──────────────────────────────────────────────────
const CALC_MODE_LABELS: Record<string, string> = {
  by_move: "By Move",
  by_event: "By Event",
  by_leg: "By Leg",
  between_statuses: "Between Statuses",
}

const UOM_LABELS: Record<string, string> = {
  per_move: "Per Move",
  fixed: "Fixed",
  per_day: "Per Day",
  per_hour: "Per Hour",
  per_pounds: "Per Pounds",
  per_miles: "Per Mile",
  per_road_toll_miles: "Per Road Toll Mi",
  percentage: "Percentage",
  per_15min: "Per 15min",
}

const EVENT_LABELS: Record<string, string> = {
  PICK_UP_CONTAINER: "Pick Up Container",
  DELIVER_CONTAINER: "Deliver Container",
  RETURN_CONTAINER: "Return Container",
  DROP_CONTAINER: "Drop Container",
  STOP_OFF: "Stop Off",
  TERMINATE_CHASSIS: "Terminate Chassis",
  COMPLETED: "Completed",
  HOOK_CONTAINER: "Hook Container",
  HOOK_CHASSIS: "Hook Chassis",
  LIFT_OFF: "Lift Off",
  LIFT_ON: "Lift On",
  DELIVER_LOAD_DROP_AND_HOOK: "Deliver Load - D&H",
  DROP_CHASSIS: "Drop Chassis",
}

// Condition type keys match API VALID_CONDITION_TYPES (lowercase)
const CONDITION_TYPE_LABELS: Record<string, string> = {
  load_type: "Load Type",
  customer: "Customer",
  terminal: "Terminal",
  warehouse: "Warehouse",
  chassis_pickup: "Chassis Pick Up",
  hook_chassis: "Hook Chassis",
  container_return: "Container Return",
  chassis_term: "Chassis Term",
  hazmat: "Hazmat",
  reefer: "Reefer",
  liquor: "Liquor",
  city_state: "City-State",
  state: "State",
  delivery_day: "Delivery Day",
  delivery_time_24hrs: "Delivery Time (24hrs)",
  city_groups: "City Groups",
  scale: "Scale",
  street_turn: "Street Turn",
  ev: "EV",
  bonded: "Bonded",
  oog: "OOG",
  double: "Double",
  tanker: "Tanker",
  overweight: "Overweight",
  hot: "Hot",
  container_type: "Container Type",
  container_size: "Container Size",
  ssl: "SSL",
  chassis_type: "Chassis Type",
  chassis_size: "Chassis Size",
  chassis_owner: "Chassis Owner",
  drop_location: "Drop Location",
  stopoff: "Stop Off",
  genset: "Genset",
  dropped: "Dropped",
  commodity_profile: "Commodity Profile",
  commodities_weight: "Commodities Weight",
}

// Operator keys match API VALID_OPERATORS
const CONDITION_OPERATOR_LABELS: Record<string, string> = {
  in: "Any in",
  not_in: "Not in",
  equals: "Equals",
  not_equals: "Not Equals",
  gt: "Greater Than",
  gte: "Greater or Equal",
  lt: "Less Than",
  lte: "Less or Equal",
}

// Boolean condition types — show Yes/No
const BOOLEAN_CONDITION_TYPES = new Set([
  "hazmat", "reefer", "liquor", "bonded", "scale", "street_turn",
  "oog", "ev", "double", "tanker", "overweight", "hot", "genset", "dropped",
])

// Condition types with known fixed value options
const CONDITION_VALUE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  load_type: [
    { value: "IMPORT", label: "Import" },
    { value: "EXPORT", label: "Export" },
  ],
  delivery_day: [
    { value: "MONDAY", label: "Monday" },
    { value: "TUESDAY", label: "Tuesday" },
    { value: "WEDNESDAY", label: "Wednesday" },
    { value: "THURSDAY", label: "Thursday" },
    { value: "FRIDAY", label: "Friday" },
    { value: "SATURDAY", label: "Saturday" },
    { value: "SUNDAY", label: "Sunday" },
  ],
  container_type: [
    { value: "DRY", label: "Dry" },
    { value: "REEFER", label: "Reefer" },
    { value: "FLAT_RACK", label: "Flat Rack" },
    { value: "OPEN_TOP", label: "Open Top" },
    { value: "TANK", label: "Tank" },
  ],
  container_size: [
    { value: "20", label: "20'" },
    { value: "40", label: "40'" },
    { value: "45", label: "45'" },
    { value: "53", label: "53'" },
  ],
  chassis_type: [
    { value: "REGULAR", label: "Regular" },
    { value: "TRI_AXLE", label: "Tri-Axle" },
    { value: "SLIDER", label: "Slider" },
  ],
  chassis_size: [
    { value: "20", label: "20'" },
    { value: "40", label: "40'" },
    { value: "45", label: "45'" },
    { value: "53", label: "53'" },
  ],
  state: [
    { value: "TX", label: "TX" }, { value: "LA", label: "LA" }, { value: "OK", label: "OK" },
    { value: "AR", label: "AR" }, { value: "NM", label: "NM" }, { value: "CA", label: "CA" },
    { value: "AZ", label: "AZ" }, { value: "NV", label: "NV" }, { value: "CO", label: "CO" },
    { value: "FL", label: "FL" }, { value: "GA", label: "GA" }, { value: "AL", label: "AL" },
    { value: "MS", label: "MS" }, { value: "TN", label: "TN" }, { value: "SC", label: "SC" },
    { value: "NC", label: "NC" }, { value: "VA", label: "VA" }, { value: "NY", label: "NY" },
    { value: "NJ", label: "NJ" }, { value: "PA", label: "PA" }, { value: "IL", label: "IL" },
    { value: "OH", label: "OH" }, { value: "MI", label: "MI" }, { value: "IN", label: "IN" },
    { value: "WA", label: "WA" }, { value: "OR", label: "OR" }, { value: "MD", label: "MD" },
    { value: "MA", label: "MA" }, { value: "CT", label: "CT" }, { value: "MO", label: "MO" },
    { value: "MN", label: "MN" }, { value: "WI", label: "WI" }, { value: "KS", label: "KS" },
  ],
}

// Helper: get value options for a condition type
function getConditionValueOptions(condType: string): { value: string; label: string }[] | null {
  if (BOOLEAN_CONDITION_TYPES.has(condType)) {
    return [{ value: "true", label: "Yes" }, { value: "false", label: "No" }]
  }
  return CONDITION_VALUE_OPTIONS[condType] || null
}

const STATUSES = [
  "ENROUTE_TO_CHASSIS", "ARRIVED_TO_CHASSIS", "ENROUTE_TO_PICK_CONTAINER",
  "ARRIVED_AT_PICK_CONTAINER", "ENROUTE_TO_DELIVER_LOAD", "ARRIVED_AT_DELIVER_LOAD",
  "ENROUTE_TO_DROP_CONTAINER", "DROPPED", "ENROUTE_TO_STOP_OFF", "ARRIVED_AT_STOP_OFF",
  "ENROUTE_TO_HOOK_CONTAINER", "ARRIVED_TO_HOOK_CONTAINER", "ENROUTE_TO_RETURN_LOAD",
  "ARRIVED_AT_RETURN_LOAD", "ENROUTE_TO_RETURN_CHASSIS", "ARRIVED_TO_RETURN_CHASSIS", "COMPLETED",
]

// ─── Profile Modal (dark gray) ──────────────────────────────────
type DriverGroupOption = { id: string; name: string; pay_type: string }

function ProfileModal({
  open, onClose, onSaved, editProfile,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; editProfile?: RateProfile | null
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [effectiveDate, setEffectiveDate] = useState("")
  const [expiresDate, setExpiresDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [allGroups, setAllGroups] = useState<DriverGroupOption[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [groupsLoading, setGroupsLoading] = useState(false)

  // Fetch all driver groups when modal opens
  useEffect(() => {
    if (!open) return
    const fetchGroups = async () => {
      setGroupsLoading(true)
      try {
        const res = await fetch("/api/drivers/pay-rates/groups")
        if (res.ok) {
          const data = await res.json()
          setAllGroups((data.groups || []).map((g: any) => ({
            id: g.id, name: g.name, pay_type: g.pay_type,
          })))
        }
      } catch (err) { console.error("Error fetching groups:", err) }
      finally { setGroupsLoading(false) }
    }
    fetchGroups()
  }, [open])

  useEffect(() => {
    if (editProfile) {
      setName(editProfile.name)
      setDescription(editProfile.description || "")
      setEffectiveDate(editProfile.effective_date || "")
      setExpiresDate(editProfile.expires_date || "")
      setSelectedGroupIds(new Set(editProfile.driver_groups.map((g) => g.id)))
    } else {
      setName(""); setDescription(""); setEffectiveDate(""); setExpiresDate("")
      setSelectedGroupIds(new Set())
    }
    setError("")
  }, [editProfile, open])

  if (!open) return null

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId)
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) { setError("Profile name is required"); return }
    setSaving(true); setError("")
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        effective_date: effectiveDate || null,
        expires_date: expiresDate || null,
        ...(editProfile ? { id: editProfile.id } : {}),
      }
      const res = await fetch("/api/drivers/pay-rates/profiles", {
        method: editProfile ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save profile")
      }
      const profileData = await res.json()
      const profileId = editProfile?.id || profileData.profile?.id

      // Update driver group assignments via junction table
      if (profileId) {
        await fetch("/api/drivers/pay-rates/profiles/groups", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile_id: profileId, group_ids: Array.from(selectedGroupIds) }),
        })
      }

      onSaved(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl border ${S.panel}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b rounded-t-2xl ${S.panelHeader}`}>
          <h2 className="text-lg font-bold text-white">{editProfile ? "Edit Rate Profile" : "New Rate Profile"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>}
          <div>
            <label className={`block mb-1 ${S.label}`}>Profile Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
              placeholder="e.g. Owner Operator - Per Move - Houston" />
          </div>
          <div>
            <label className={`block mb-1 ${S.label}`}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className={`w-full px-3 py-2 rounded-lg text-sm resize-none ${S.input}`}
              placeholder="Optional description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block mb-1 ${S.label}`}>Effective Date</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`} />
            </div>
            <div>
              <label className={`block mb-1 ${S.label}`}>Expires Date</label>
              <input type="date" value={expiresDate} onChange={(e) => setExpiresDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`} />
            </div>
          </div>
          <div>
            <label className={`block mb-1 ${S.label}`}>Driver Groups</label>
            {groupsLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                <span className="text-xs text-gray-500">Loading groups...</span>
              </div>
            ) : allGroups.length === 0 ? (
              <div className="text-xs text-gray-600 py-2">No driver groups configured yet.</div>
            ) : (
              <div className={`rounded-lg border max-h-40 overflow-y-auto ${S.input}`}>
                {allGroups.map((g) => (
                  <label key={g.id}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                      selectedGroupIds.has(g.id) ? "bg-[#E8700A]/10" : "hover:bg-[#2a3040]"
                    }`}>
                    <input type="checkbox" checked={selectedGroupIds.has(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="rounded border-[#363f52] bg-[#2a3040] text-[#E8700A] focus:ring-[#E8700A] focus:ring-offset-0 w-3.5 h-3.5" />
                    <span className="text-sm text-white">{g.name}</span>
                    <span className="text-[10px] text-gray-500 ml-auto">{g.pay_type === "per_move" ? "Per Move" : "Hourly"}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t rounded-b-2xl ${S.panelHeader}`}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {editProfile ? "Update" : "Create Profile"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inline Add Lane Bar ────────────────────────────────────────
function InlineAddLane({
  profileId, profile, origins, zones, chargeCodes, orgs, existingLanes, onSaved, onOriginsRefresh,
  onEditProfile, onCopyProfile, onDeleteProfile, copyingProfile,
}: {
  profileId: string; profile: RateProfile; origins: LaneOrigin[]; zones: LaneZone[]
  chargeCodes: ChargeCode[]; orgs: OrgLocation[]; existingLanes: LaneWithCharges[]
  onSaved: () => void
  onOriginsRefresh: () => void
  onEditProfile: (p: RateProfile) => void
  onCopyProfile: (p: RateProfile) => void
  onDeleteProfile: (id: string) => void
  copyingProfile: boolean
}) {
  const [mode, setMode] = useState<"idle" | "single" | "generate">("idle")
  const [laneType, setLaneType] = useState<"zonal" | "defined">("zonal")
  const [anchorPointId, setAnchorPointId] = useState("")
  const [facilityName, setFacilityName] = useState("")  // Display name for zonal facility
  const [anchorRole, setAnchorRole] = useState<"origin" | "destination">("origin")
  const [zoneId, setZoneId] = useState("")
  const [pickupLocation, setPickupLocation] = useState("")
  const [deliveryLocation, setDeliveryLocation] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [genAnchorId, setGenAnchorId] = useState("")
  const [genFacilityName, setGenFacilityName] = useState("")
  const [genRole, setGenRole] = useState<"origin" | "destination">("origin")
  const [genSelectedZones, setGenSelectedZones] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  // Zone creation state (when no zones exist for selected facility)
  const [genZoneCount, setGenZoneCount] = useState("5")
  const [genZoneStartMiles, setGenZoneStartMiles] = useState("0")
  const [genZoneFirstIncrement, setGenZoneFirstIncrement] = useState("25")
  const [genZoneIncrementMiles, setGenZoneIncrementMiles] = useState("25")
  const [creatingZones, setCreatingZones] = useState(false)

  // Exclude zones already assigned to lanes in the current profile
  const usedZoneIds = new Set(existingLanes.filter((l) => l.zone_id).map((l) => l.zone_id!))
  const filteredZones = zones.filter((z) => z.origin_id === anchorPointId && !usedZoneIds.has(z.id))
  const genFilteredZones = zones.filter((z) => z.origin_id === genAnchorId && !usedZoneIds.has(z.id))

  // Build org options for SearchableSelect — deduplicated by name
  const orgOptions = (() => {
    const seen = new Set<string>()
    return orgs.filter((o) => {
      if (seen.has(o.name)) return false
      seen.add(o.name)
      return true
    }).map((o) => ({
      value: o.name,
      label: o.name,
      sublabel: `${o.type}${o.city ? ` · ${o.city}` : ""}${o.state ? `, ${o.state}` : ""}`,
    }))
  })()

  // Resolve an org name to a lane_origin ID (find existing or create new)
  // Server-side geocoding automatically fills lat/lng from city/state when creating new origins
  const resolveAnchorFromOrg = async (orgName: string): Promise<string | null> => {
    if (!orgName) return null
    // Try matching existing lane_origin by name (case-insensitive)
    const match = origins.find((o) => o.name.toLowerCase() === orgName.toLowerCase() || o.code.toLowerCase() === orgName.toLowerCase())
    if (match) return match.id
    // Auto-create a lane_origin from the org data (server will geocode city/state → lat/lng)
    const org = orgs.find((o) => o.name === orgName)
    if (!org) return null
    try {
      const code = orgName.replace(/[^A-Z0-9]/gi, "").substring(0, 5).toUpperCase() || "NEW"
      const res = await fetch("/api/drivers/pay-rates/origins", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: org.name, code, city: org.city, state: org.state }),
      })
      if (res.ok) {
        const data = await res.json()
        onOriginsRefresh() // Refresh origins list so new origin shows up
        return data.origin?.id || null
      }
    } catch (err) { console.error("Error creating lane origin from org:", err) }
    return null
  }

  // Handle facility selection for zonal — resolve org name to lane_origin ID
  const handleFacilitySelect = async (orgName: string) => {
    setFacilityName(orgName)
    setAnchorPointId("")
    setZoneId("")
    if (!orgName) return
    const originId = await resolveAnchorFromOrg(orgName)
    if (originId) {
      setAnchorPointId(originId)
    } else {
      setError("Could not resolve facility to a lane origin")
    }
  }

  const handleGenFacilitySelect = async (orgName: string) => {
    setGenFacilityName(orgName)
    setGenAnchorId("")
    setGenSelectedZones(new Set())
    setError("")
    if (!orgName) return
    const originId = await resolveAnchorFromOrg(orgName)
    if (originId) {
      setGenAnchorId(originId)
    } else {
      setError("Could not resolve facility to a lane origin")
    }
  }

  const reset = () => {
    setMode("idle"); setLaneType("zonal"); setAnchorPointId(""); setFacilityName("")
    setAnchorRole("origin"); setZoneId(""); setPickupLocation(""); setDeliveryLocation("")
    setError(""); setGenAnchorId(""); setGenFacilityName(""); setGenRole("origin")
    setGenSelectedZones(new Set()); setGenZoneCount("5"); setGenZoneStartMiles("0")
    setGenZoneFirstIncrement("25"); setGenZoneIncrementMiles("25")
  }

  const handleSaveSingle = async () => {
    setSaving(true); setError("")
    try {
      const body: Record<string, unknown> = {
        rate_profile_id: profileId, lane_type: laneType, direction: "both", priority: 0,
      }
      if (laneType === "zonal") {
        if (!anchorPointId || !zoneId) { setError("Select anchor point and zone"); setSaving(false); return }
        body.anchor_point_id = anchorPointId; body.anchor_role = anchorRole; body.zone_id = zoneId
      } else {
        if (!pickupLocation && !deliveryLocation) { setError("At least one location required"); setSaving(false); return }
        body.pickup_location = pickupLocation || null
        body.delivery_location = deliveryLocation || null
      }
      const res = await fetch("/api/drivers/pay-rates/profiles/lanes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed") }
      const resData = await res.json()
      // Auto-generate one default charge for the new lane
      if (resData.lane?.id) {
        const defaultCode = chargeCodes[0]?.code || "S100"
        const defaultName = chargeCodes.find((c) => c.code === defaultCode)?.name || "DRAYAGE"
        let fromLoc = ""
        let toLoc = ""
        if (laneType === "zonal") {
          const origin = origins.find((o) => o.id === anchorPointId)
          const originLabel = origin?.code || origin?.name || facilityName || ""
          const zone = zones.find((z) => z.id === zoneId)
          fromLoc = anchorRole === "origin" ? originLabel : (zone?.name || "")
          toLoc = anchorRole === "origin" ? (zone?.name || "") : originLabel
        } else {
          fromLoc = pickupLocation || ""
          toLoc = deliveryLocation || ""
        }
        await fetch("/api/drivers/pay-rates/profiles/charges", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lane_id: resData.lane.id, charge_code: defaultCode, charge_name: defaultName,
            calculation_mode: "by_leg", unit_of_measure: "per_move", rate: 0,
            leg_from: "PICK_UP_CONTAINER", leg_from_location: fromLoc,
            leg_to: "DELIVER_CONTAINER", leg_to_location: toLoc, auto_add: true,
          }),
        })
      }
      reset(); onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : "Failed") }
    finally { setSaving(false) }
  }

  const handleGenerate = async () => {
    if (!genAnchorId || genSelectedZones.size === 0) { setError("Select a facility and at least one zone"); return }
    setGenerating(true); setError("")
    try {
      const defaultCode = chargeCodes[0]?.code || "S100"
      const defaultName = chargeCodes.find((c) => c.code === defaultCode)?.name || "DRAYAGE"
      let failCount = 0

      const origin = origins.find((o) => o.id === genAnchorId)
      const originLabel = origin?.code || origin?.name || genFacilityName || ""

      for (const zId of Array.from(genSelectedZones)) {
        const zone = zones.find((z) => z.id === zId)
        const res = await fetch("/api/drivers/pay-rates/profiles/lanes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rate_profile_id: profileId, lane_type: "zonal", direction: "both", priority: 0,
            anchor_point_id: genAnchorId, anchor_role: genRole, zone_id: zId,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.lane?.id) {
            const fromLoc = genRole === "origin" ? originLabel : (zone?.name || "")
            const toLoc = genRole === "origin" ? (zone?.name || "") : originLabel
            await fetch("/api/drivers/pay-rates/profiles/charges", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lane_id: data.lane.id, charge_code: defaultCode, charge_name: defaultName,
                calculation_mode: "by_leg", unit_of_measure: "per_move", rate: 0,
                leg_from: "PICK_UP_CONTAINER", leg_from_location: fromLoc,
                leg_to: "DELIVER_CONTAINER", leg_to_location: toLoc, auto_add: true,
              }),
            })
          }
        } else { failCount++ }
      }

      if (failCount > 0) { setError(`${failCount} lane(s) failed to create`) }
      else { reset() }
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : "Failed") }
    finally { setGenerating(false) }
  }

  const toggleGenZone = (zId: string) => {
    setGenSelectedZones((prev) => {
      const next = new Set(prev)
      if (next.has(zId)) next.delete(zId); else next.add(zId)
      return next
    })
  }

  const selectAllGenZones = () => {
    setGenSelectedZones(new Set(genFilteredZones.map((z) => z.id)))
  }

  // Auto-create zones for a facility that has none
  // Helper to calculate zone mile ranges with split first/remaining increments
  const calcZoneRange = (index: number) => {
    const start = parseInt(genZoneStartMiles) || 0
    const firstInc = parseInt(genZoneFirstIncrement) || 25
    const otherInc = parseInt(genZoneIncrementMiles) || 25
    if (index === 0) return { min: start, max: start + firstInc }
    const min = start + firstInc + (index - 1) * otherInc
    return { min, max: min + otherInc }
  }

  const handleCreateZonesAndGenerateLanes = async () => {
    if (!genAnchorId) return
    const count = parseInt(genZoneCount) || 5
    setCreatingZones(true); setGenerating(true); setError("")
    try {
      const defaultCode = chargeCodes[0]?.code || "S100"
      const defaultName = chargeCodes.find((c) => c.code === defaultCode)?.name || "DRAYAGE"
      let failCount = 0

      const origin = origins.find((o) => o.id === genAnchorId)
      const originLabel = origin?.code || origin?.name || genFacilityName || ""

      // Step 1: Create zones for this anchor
      const createdZones: { id: string; name: string; zone_number: number }[] = []
      for (let i = 0; i < count; i++) {
        const { min: minMiles, max: maxMiles } = calcZoneRange(i)
        const res = await fetch("/api/drivers/pay-rates/zones", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            origin_id: genAnchorId,
            zone_number: i + 1,
            name: `Zone ${i + 1}`,
            min_miles: minMiles,
            max_miles: maxMiles,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.zone?.id) {
            createdZones.push({ id: data.zone.id, name: data.zone.name, zone_number: data.zone.zone_number })
          }
        }
      }

      // Step 2: Generate a lane + default charge for each created zone
      for (const zone of createdZones) {
        const laneRes = await fetch("/api/drivers/pay-rates/profiles/lanes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rate_profile_id: profileId, lane_type: "zonal", direction: "both", priority: 0,
            anchor_point_id: genAnchorId, anchor_role: genRole, zone_id: zone.id,
          }),
        })
        if (laneRes.ok) {
          const laneData = await laneRes.json()
          if (laneData.lane?.id) {
            const fromLoc = genRole === "origin" ? originLabel : (zone.name || "")
            const toLoc = genRole === "origin" ? (zone.name || "") : originLabel
            await fetch("/api/drivers/pay-rates/profiles/charges", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lane_id: laneData.lane.id, charge_code: defaultCode, charge_name: defaultName,
                calculation_mode: "by_leg", unit_of_measure: "per_move", rate: 0,
                leg_from: "PICK_UP_CONTAINER", leg_from_location: fromLoc,
                leg_to: "DELIVER_CONTAINER", leg_to_location: toLoc, auto_add: true,
              }),
            })
          }
        } else { failCount++ }
      }

      if (failCount > 0) { setError(`${failCount} lane(s) failed to create`) }
      else { reset() }
      onOriginsRefresh()
      onSaved()
    } catch (err) {
      console.error("Error creating zones and lanes:", err)
      setError("Failed to create zones and lanes")
    } finally { setCreatingZones(false); setGenerating(false) }
  }

  const sel = `px-2 py-1.5 rounded text-xs ${S.input}`
  const inp = `px-2 py-1.5 rounded text-xs ${S.input}`

  if (mode === "idle") {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${S.divider}`}>
        <button onClick={() => setMode("single")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#E8700A] hover:bg-[#FF8C21] text-white transition-colors">
          <Plus size={13} /> Add Lane
        </button>
        <button onClick={() => setMode("generate")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-colors">
          <Zap size={13} /> Generate Zonal Lanes
        </button>
        {/* Separator */}
        <div className="h-5 w-px bg-[#363f52] mx-1" />
        {/* Profile actions */}
        <button onClick={() => onEditProfile(profile)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2a3040] hover:bg-[#363f52] text-gray-300 border border-[#363f52] transition-colors">
          <Pencil size={11} /> Edit
        </button>
        <button onClick={() => onCopyProfile(profile)} disabled={copyingProfile}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#2a3040] hover:bg-[#363f52] text-gray-300 border border-[#363f52] transition-colors">
          {copyingProfile ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />} Copy
        </button>
        <button onClick={() => { if (confirm(`Delete profile "${profile.name}"?`)) onDeleteProfile(profile.id) }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors">
          <Trash2 size={11} /> Delete
        </button>
      </div>
    )
  }

  if (mode === "generate") {
    return (
      <div className={`px-4 py-3 border-b space-y-3 ${S.panelHeader} ${S.divider}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-purple-400" />
            <span className="text-xs font-semibold text-white">Generate Zonal Lanes</span>
          </div>
          <button onClick={reset} className="p-1 hover:bg-white/10 rounded"><X size={14} className="text-gray-400" /></button>
        </div>
        {error && <div className="px-2 py-1 bg-red-500/10 rounded text-[11px] text-red-400">{error}</div>}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className={`block mb-1 ${S.label}`}>Facility</label>
            <div className="flex items-center gap-1">
              <SearchableSelect
                value={genFacilityName}
                onChange={(v) => handleGenFacilitySelect(v)}
                options={orgOptions}
                placeholder="Select facilities..."
                className="min-w-[250px]"
              />
              <select value={genRole} onChange={(e) => setGenRole(e.target.value as "origin" | "destination")} className={sel}>
                <option value="origin">Origin</option>
                <option value="destination">Destination</option>
              </select>
            </div>
          </div>
        </div>
        {genAnchorId && genFilteredZones.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={S.label}>Select Zones ({genSelectedZones.size}/{genFilteredZones.length})</label>
              <button onClick={selectAllGenZones} className="text-[10px] text-[#E8700A] hover:text-[#FF8C21]">Select All</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {genFilteredZones.map((z) => {
                const selected = genSelectedZones.has(z.id)
                return (
                  <button key={z.id} onClick={() => toggleGenZone(z.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                      selected ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : "bg-[#2a3040] border-[#363f52] text-gray-400 hover:bg-[#323848]"
                    }`}>
                    {selected && <Check size={10} className="inline mr-1" />}
                    Z{z.zone_number}: {z.min_miles}-{z.max_miles}mi
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {genAnchorId && genFilteredZones.length === 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400">No unused zones for this facility. Configure new zones to generate:</div>
            <div className="flex items-end gap-2">
              <div>
                <label className={`block mb-1 ${S.label}`}>Zones</label>
                <input type="number" min="1" max="20" value={genZoneCount}
                  onChange={(e) => setGenZoneCount(e.target.value)}
                  className={`w-16 ${sel}`} />
              </div>
              <div>
                <label className={`block mb-1 ${S.label}`}>Start (mi)</label>
                <input type="number" min="0" value={genZoneStartMiles}
                  onChange={(e) => setGenZoneStartMiles(e.target.value)}
                  className={`w-16 ${sel}`} />
              </div>
              <div>
                <label className={`block mb-1 ${S.label}`}>1st Zone (mi)</label>
                <input type="number" min="1" value={genZoneFirstIncrement}
                  onChange={(e) => setGenZoneFirstIncrement(e.target.value)}
                  className={`w-16 ${sel}`} />
              </div>
              <div>
                <label className={`block mb-1 ${S.label}`}>Other Zones (mi)</label>
                <input type="number" min="1" value={genZoneIncrementMiles}
                  onChange={(e) => setGenZoneIncrementMiles(e.target.value)}
                  className={`w-20 ${sel}`} />
              </div>
              <button onClick={handleCreateZonesAndGenerateLanes} disabled={creatingZones || generating}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors">
                {(creatingZones || generating) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap size={12} />}
                Generate Zonal Lanes
              </button>
            </div>
            <div className="text-[10px] text-gray-500">
              Will create {parseInt(genZoneCount) || 5} zones and generate a lane for each: {Array.from({ length: Math.min(parseInt(genZoneCount) || 5, 10) }, (_, i) => {
                const r = calcZoneRange(i)
                return `Z${i + 1}: ${r.min}-${r.max}mi`
              }).join(" · ")}{(parseInt(genZoneCount) || 5) > 10 ? " ..." : ""}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleGenerate} disabled={generating || genSelectedZones.size === 0}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers size={12} />}
            Generate {genSelectedZones.size} Lane{genSelectedZones.size !== 1 ? "s" : ""}
          </button>
          <button onClick={reset} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
        </div>
      </div>
    )
  }

  // Single add lane
  return (
    <div className={`px-4 py-3 border-b space-y-2 ${S.panelHeader} ${S.divider}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white">Add Lane</span>
        <button onClick={reset} className="p-1 hover:bg-white/10 rounded"><X size={14} className="text-gray-400" /></button>
      </div>
      {error && <div className="px-2 py-1 bg-red-500/10 rounded text-[11px] text-red-400">{error}</div>}
      <div className="flex items-end gap-2">
        <div className="flex rounded-lg overflow-hidden border border-[#363f52]">
          <button onClick={() => setLaneType("zonal")}
            className={`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1 transition-colors ${
              laneType === "zonal" ? "bg-purple-500/20 text-purple-300" : "bg-[#2a3040] text-gray-400 hover:bg-[#323848]"
            }`}><Route size={11} /> Zonal</button>
          <button onClick={() => setLaneType("defined")}
            className={`px-3 py-1.5 text-[11px] font-medium flex items-center gap-1 transition-colors ${
              laneType === "defined" ? "bg-cyan-500/20 text-cyan-300" : "bg-[#2a3040] text-gray-400 hover:bg-[#323848]"
            }`}><MapPin size={11} /> Defined</button>
        </div>

        {laneType === "zonal" ? (
          <>
            <div className="flex items-center gap-1">
              <SearchableSelect value={facilityName}
                onChange={(v) => handleFacilitySelect(v)}
                options={orgOptions}
                placeholder="Facility..." className="min-w-[180px]" />
              <select value={anchorRole} onChange={(e) => setAnchorRole(e.target.value as "origin" | "destination")} className={sel}>
                <option value="origin">Origin</option>
                <option value="destination">Destination</option>
              </select>
            </div>
            <div className="flex-1">
              <SearchableSelect value={zoneId}
                onChange={(v) => setZoneId(v)}
                options={anchorPointId ? filteredZones.map((z) => ({ value: z.id, label: `Z${z.zone_number}: ${z.name} (${z.min_miles}-${z.max_miles}mi)` })) : []}
                placeholder={anchorPointId ? "Zone..." : "Select facility first"} />
            </div>
          </>
        ) : (
          <>
            <div className="flex-1">
              <SearchableSelect value={pickupLocation}
                onChange={(v) => setPickupLocation(v)}
                options={orgOptions}
                placeholder="Pickup location..." />
            </div>
            <span className="text-gray-600 text-xs px-1">&rarr;</span>
            <div className="flex-1">
              <SearchableSelect value={deliveryLocation}
                onChange={(v) => setDeliveryLocation(v)}
                options={orgOptions}
                placeholder="Delivery location..." />
            </div>
          </>
        )}

        <button onClick={handleSaveSingle} disabled={saving}
          className="px-4 py-1.5 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 text-white text-xs font-medium rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus size={12} />} Add
        </button>
      </div>
    </div>
  )
}

// ─── Inline Editable Cell ───────────────────────────────────────
function EditableCell({
  value, onChange, type = "text", className = "", step, selectOptions,
}: {
  value: string; onChange: (v: string) => void; type?: string; className?: string
  step?: string; selectOptions?: { value: string; label: string }[]
}) {
  const [editing, setEditing] = useState(false)
  const [tempVal, setTempVal] = useState(value)
  const ref = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => { setTempVal(value) }, [value])

  const commit = () => {
    if (tempVal !== value) onChange(tempVal)
    setEditing(false)
  }

  if (selectOptions) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`bg-transparent border-0 text-[11px] text-white focus:bg-[#2a3040] focus:outline-none rounded px-0.5 py-0.5 cursor-pointer ${className}`}>
        {selectOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  if (!editing) {
    return (
      <span onClick={() => { setEditing(true); setTimeout(() => ref.current?.focus(), 0) }}
        className={`cursor-pointer hover:bg-[#2a3040] rounded px-0.5 py-0.5 ${className}`}
        title="Click to edit">
        {value || "\u2014"}
      </span>
    )
  }

  return (
    <input ref={ref as React.RefObject<HTMLInputElement>} type={type} step={step} value={tempVal}
      onChange={(e) => setTempVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setTempVal(value); setEditing(false) } }}
      className={`bg-[#2a3040] border border-[#E8700A]/40 text-[11px] text-white rounded px-0.5 py-0.5 outline-none w-full ${className}`} />
  )
}

// ─── Multi-Select Events (tags with X, plus dropdown to add) ─────
function MultiSelectEvents({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Parse comma-separated string into array
  const selected = value ? value.split(",").filter(Boolean) : []

  const addEvent = (ev: string) => {
    if (!ev || selected.includes(ev)) return
    const next = [...selected, ev].join(",")
    onChange(next)
    setShowDropdown(false)
  }

  const removeEvent = (ev: string) => {
    const next = selected.filter((s) => s !== ev).join(",")
    onChange(next)
  }

  // Detect if dropdown should open upward
  useEffect(() => {
    if (showDropdown && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropdownHeight = 200
      setDropUp(spaceBelow < dropdownHeight && rect.top > dropdownHeight)
    }
  }, [showDropdown])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false)
    }
    if (showDropdown) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showDropdown])

  const availableOptions = options.filter((o) => o.value && !selected.includes(o.value))

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-0.5 min-h-[20px]">
        {selected.map((ev) => {
          const label = options.find((o) => o.value === ev)?.label || ev
          return (
            <span key={ev} className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-[#2a3040] border border-[#363f52] text-[9px] text-gray-300 whitespace-nowrap">
              {label}
              <button onClick={() => removeEvent(ev)} className="hover:text-red-400 ml-0.5 leading-none">
                <X size={20} />
              </button>
            </span>
          )
        })}
        {availableOptions.length > 0 && (
          <button onClick={() => setShowDropdown(!showDropdown)}
            className="p-0.5 hover:bg-[#2a3040] rounded text-gray-600 hover:text-gray-400">
            <Plus size={20} />
          </button>
        )}
      </div>
      {showDropdown && availableOptions.length > 0 && (
        <div className={`absolute z-50 left-0 bg-[#1e2330] border border-[#363f52] rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-[160px] ${
          dropUp ? "bottom-full mb-1" : "top-full mt-1"
        }`}>
          {availableOptions.map((o) => (
            <button key={o.value} onClick={() => addEvent(o.value)}
              className="w-full text-left px-2 py-1.5 text-[10px] text-gray-300 hover:bg-[#2a3040] hover:text-white transition-colors">
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Compact Searchable Select ───────────────────────────────────
function SearchableSelect({
  value, onChange, options, placeholder = "Select...", className: wrapperClass = "",
}: {
  value: string
  onChange: (val: string) => void
  options: { value: string; label: string; sublabel?: string }[]
  placeholder?: string
  className?: string
}) {
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = search.trim()
    ? options.filter((o) => {
        const q = search.toLowerCase()
        return o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q))
      })
    : options

  // Calculate fixed position for the portal dropdown
  const updateDropdownPosition = useCallback(() => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const dropdownHeight = 200
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight
    setDropStyle({
      position: "fixed" as const,
      left: rect.left,
      width: Math.max(rect.width, 220),
      zIndex: 9999,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
  }, [])

  // Position dropdown when opened, and reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return
    updateDropdownPosition()
    const onScrollOrResize = () => { updateDropdownPosition() }
    window.addEventListener("scroll", onScrollOrResize, true)
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [isOpen, updateDropdownPosition])

  // Close on outside click (check both trigger and portal)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setIsOpen(false); setSearch(""); setHighlightIdx(-1)
    }
    if (isOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [isOpen])

  // Scroll highlighted into view
  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-ssopt]")
      items[highlightIdx]?.scrollIntoView({ block: "nearest" })
    }
  }, [highlightIdx])

  const select = (val: string) => {
    onChange(val)
    setIsOpen(false)
    setSearch("")
    setHighlightIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setIsOpen(true); e.preventDefault() }
      return
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setHighlightIdx((p) => Math.min(p + 1, filtered.length - 1)); break
      case "ArrowUp": e.preventDefault(); setHighlightIdx((p) => Math.max(p - 1, 0)); break
      case "Enter": e.preventDefault(); if (highlightIdx >= 0 && filtered[highlightIdx]) select(filtered[highlightIdx].value); break
      case "Escape": setIsOpen(false); setSearch(""); setHighlightIdx(-1); break
    }
  }

  const selectedLabel = options.find((o) => o.value === value)?.label || value

  const dropdownContent = isOpen ? (
    <div ref={listRef} style={dropStyle}
      className="max-h-48 overflow-y-auto bg-[#1e2330] border border-[#363f52] rounded-lg shadow-xl">
      {filtered.length === 0 ? (
        <div className="px-2 py-2 text-[10px] text-gray-500 text-center">
          {search ? "No matches" : "No options"}
        </div>
      ) : (
        filtered.slice(0, 50).map((o, idx) => (
          <button key={`${idx}-${o.value}`} data-ssopt type="button"
            onClick={() => select(o.value)}
            className={`w-full text-left px-2 py-1.5 text-[11px] transition-colors ${
              idx === highlightIdx ? "bg-[#E8700A]/20 text-white"
                : o.value === value ? "text-[#E8700A]"
                : "text-gray-300 hover:bg-[#2a3040]"
            }`}>
            <div className="truncate">{o.label}</div>
            {o.sublabel && <div className="text-[9px] text-gray-500 truncate">{o.sublabel}</div>}
          </button>
        ))
      )}
    </div>
  ) : null

  return (
    <div ref={wrapRef} className={`relative ${wrapperClass}`}>
      {isOpen ? (
        <input autoFocus value={search}
          onChange={(e) => { setSearch(e.target.value); setHighlightIdx(-1) }}
          onKeyDown={handleKeyDown}
          placeholder={`Search ${placeholder.toLowerCase()}...`}
          className={`w-full px-2 py-1.5 rounded text-xs ${S.input} border-[#E8700A]/40`} />
      ) : (
        <button type="button" onClick={() => { setIsOpen(true); setHighlightIdx(-1) }}
          className={`w-full px-2 py-1.5 rounded text-xs text-left truncate ${S.input} ${value ? "text-white" : "text-gray-500"}`}>
          {value ? selectedLabel : placeholder}
        </button>
      )}
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  )
}

// ─── Organization Location type ───────────────────────────────────
type OrgLocation = {
  id: string
  name: string
  type: "Customer" | "Terminal" | "Warehouse" | "Yard"
  city: string | null
  state: string | null
}

// ─── Profile Detail View (flat spreadsheet table) ────────────────
function ProfileDetailView({
  profile, chargeCodes, origins, zones, orgs, onBack, onProfileUpdated, onEditProfile, onDeleteProfile, onOriginsRefresh, onCopyProfile, copyingProfile,
}: {
  profile: RateProfile; chargeCodes: ChargeCode[]
  origins: LaneOrigin[]; zones: LaneZone[]; orgs: OrgLocation[]
  onBack: () => void; onProfileUpdated: () => void
  onEditProfile: (p: RateProfile) => void; onDeleteProfile: (id: string) => void
  onOriginsRefresh: () => void; onCopyProfile: (p: RateProfile) => void; copyingProfile: boolean
}) {
  const [lanes, setLanes] = useState<LaneWithCharges[]>([])
  const lanesRef = useRef<LaneWithCharges[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCharges, setCopiedCharges] = useState<RateProfileCharge[] | null>(null)
  const [pasting, setPasting] = useState<string | null>(null)
  // Per-lane quick-add state
  const [addingForLane, setAddingForLane] = useState<string | null>(null)
  const [newCode, setNewCode] = useState("")
  const [newMode, setNewMode] = useState("by_leg")
  const [newUom, setNewUom] = useState("per_move")
  const [newRate, setNewRate] = useState("")
  const [newFromEvent, setNewFromEvent] = useState("PICK_UP_CONTAINER")
  const [newToEvent, setNewToEvent] = useState("DELIVER_CONTAINER")
  const [savingNew, setSavingNew] = useState(false)
  // Lane sort state: null = original order, "asc" = A-Z, "desc" = Z-A
  const [laneSort, setLaneSort] = useState<"asc" | "desc" | null>(null)
  // Drag reorder state
  const [dragLaneId, setDragLaneId] = useState<string | null>(null)
  const [dragOverLaneId, setDragOverLaneId] = useState<string | null>(null)
  // Bulk location change state
  const [showChangeAll, setShowChangeAll] = useState(false)
  const [changingAll, setChangingAll] = useState(false)
  const [changeAllValue, setChangeAllValue] = useState("")
  const [geocodeStatus, setGeocodeStatus] = useState("")

  // Keep lanesRef in sync with lanes state
  useEffect(() => { lanesRef.current = lanes }, [lanes])

  // Dropdown option arrays
  const codeOptions = chargeCodes.map((cc) => ({ value: cc.code, label: `${cc.code} \u2014 ${cc.name}` }))
  const modeOptions = Object.entries(CALC_MODE_LABELS).map(([k, v]) => ({ value: k, label: v }))
  const uomOptions = Object.entries(UOM_LABELS).map(([k, v]) => ({ value: k, label: v }))
  const eventOptions = [{ value: "", label: "\u2014" }, ...Object.entries(EVENT_LABELS).map(([k, v]) => ({ value: k, label: v }))]
  const condTypeOptions = [{ value: "", label: "\u2014" }, ...Object.entries(CONDITION_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))]
  const condOpOptions = Object.entries(CONDITION_OPERATOR_LABELS).map(([k, v]) => ({ value: k, label: v }))
  const autoAddOptions = [{ value: "true", label: "Yes" }, { value: "false", label: "No" }]

  const fetchLanes = useCallback(async () => {
    setLoading(true)
    autoCreateAttempted.current.clear() // Reset so newly fetched lanes can auto-create
    try {
      const res = await fetch(`/api/drivers/pay-rates/profiles/lanes?profile_id=${profile.id}`)
      if (res.ok) {
        const data = await res.json()
        const lanesData: LaneWithCharges[] = (data.lanes || []).map((l: RateProfileLane) => ({
          ...l, charges: [], chargesLoading: false,
        }))
        // Only apply default sort if no lanes have custom priority (all zero)
        const hasCustomPriority = lanesData.some((l) => l.priority > 0)
        if (!hasCustomPriority) {
          lanesData.sort((a, b) => {
            if (a.lane_type === "zonal" && b.lane_type === "zonal") {
              return (a.zone_number ?? 999) - (b.zone_number ?? 999)
            }
            if (a.lane_type === "zonal" && b.lane_type !== "zonal") return -1
            if (a.lane_type !== "zonal" && b.lane_type === "zonal") return 1
            const nameA = (a.name || a.pickup_location || "").toLowerCase()
            const nameB = (b.name || b.pickup_location || "").toLowerCase()
            return nameA.localeCompare(nameB)
          })
        }
        // If hasCustomPriority, server already ordered by priority DESC
        setLanes(lanesData)
        lanesRef.current = lanesData // sync ref immediately so fetchChargesForLane can read it
        for (const lane of lanesData) {
          fetchChargesForLane(lane.id)
        }
      }
    } catch (err) { console.error("Error fetching lanes:", err) }
    finally { setLoading(false) }
  }, [profile.id])

  // Track lanes that already had auto-create attempted to prevent infinite retries
  const autoCreateAttempted = useRef<Set<string>>(new Set())

  const autoCreateDefaultCharge = async (laneId: string, laneData: LaneWithCharges) => {
    // Derive origin/destination from anchor_role using the lane data passed in
    const defaultCode = chargeCodes[0]?.code || "S100"
    const defaultName = chargeCodes.find((c) => c.code === defaultCode)?.name || "DRAYAGE"
    let fromLoc = ""
    let toLoc = ""
    if (laneData.lane_type === "zonal" && laneData.anchor_role) {
      fromLoc = laneData.anchor_role === "origin" ? (laneData.origin_code || laneData.origin_name || "") : (laneData.zone_name || "")
      toLoc = laneData.anchor_role === "origin" ? (laneData.zone_name || "") : (laneData.origin_code || laneData.origin_name || "")
    } else if (laneData.lane_type === "defined") {
      fromLoc = laneData.pickup_location || ""
      toLoc = laneData.delivery_location || ""
    }
    try {
      const postBody = {
        lane_id: laneId, charge_code: defaultCode, charge_name: defaultName,
        calculation_mode: "by_leg", unit_of_measure: "per_move", rate: 0,
        leg_from: "PICK_UP_CONTAINER", leg_from_location: fromLoc,
        leg_to: "DELIVER_CONTAINER", leg_to_location: toLoc, auto_add: true,
      }
      console.log("[AutoCharge] Creating default charge for lane:", laneId, postBody)
      const res = await fetch("/api/drivers/pay-rates/profiles/charges", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }))
        console.error("[AutoCharge] POST failed:", res.status, errData)
        setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, chargesLoading: false } : l))
        return
      }
      // Re-fetch charges after auto-creating
      const chargeRes = await fetch(`/api/drivers/pay-rates/profiles/charges?lane_id=${laneId}`, { cache: "no-store" })
      if (chargeRes.ok) {
        const chargeData = await chargeRes.json()
        setLanes((prev) => prev.map((l) =>
          l.id === laneId ? { ...l, charges: chargeData.charges || [], chargesLoading: false } : l
        ))
      } else {
        console.error("[AutoCharge] Re-fetch charges failed:", chargeRes.status)
        setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, chargesLoading: false } : l))
      }
    } catch (err) {
      console.error("[AutoCharge] Exception:", err)
      setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, chargesLoading: false } : l))
    }
  }

  const fetchChargesForLane = async (laneId: string) => {
    setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, chargesLoading: true } : l))
    try {
      const res = await fetch(`/api/drivers/pay-rates/profiles/charges?lane_id=${laneId}`, { cache: "no-store" })
      if (!res.ok) {
        console.error("[FetchCharges] GET failed:", res.status)
        setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, chargesLoading: false } : l))
        return
      }
      const data = await res.json()
      const charges = data.charges || []
      if (charges.length === 0 && !autoCreateAttempted.current.has(laneId)) {
        // No charges exist and we haven't tried auto-create yet — create a default one
        autoCreateAttempted.current.add(laneId)
        const laneData = lanesRef.current.find((l) => l.id === laneId)
        if (laneData) {
          await autoCreateDefaultCharge(laneId, laneData)
        } else {
          console.error("[FetchCharges] Lane not found in ref for auto-create:", laneId)
          setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, chargesLoading: false } : l))
        }
      } else {
        setLanes((prev) => prev.map((l) =>
          l.id === laneId ? { ...l, charges, chargesLoading: false } : l
        ))
      }
    } catch (err) {
      console.error("[FetchCharges] Exception:", err)
      setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, chargesLoading: false } : l))
    }
  }

  // Lane label + sort order used by the table and fill-down (must run before fill handlers)
  const laneLabel = (lane: LaneWithCharges) => {
    if (lane.name) return lane.name
    if (lane.lane_type === "zonal") {
      return `${lane.origin_name || "?"} (${lane.anchor_role}) \u2192 Zone ${lane.zone_number ?? "?"}`
    }
    return `${lane.pickup_location || "Any"} \u2192 ${lane.delivery_location || "Any"}`
  }

  const sortedLanes = (() => {
    if (!laneSort) return lanes
    const sorted = [...lanes]
    sorted.sort((a, b) => {
      const nameA = (a.name || laneLabel(a)).toLowerCase()
      const nameB = (b.name || laneLabel(b)).toLowerCase()
      return laneSort === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
    })
    return sorted
  })()

  const buildChargePatchBody = (chargeId: string, field: string, value: string): Record<string, unknown> => {
    const numFields = ["rate", "min_amount", "max_amount", "free_units"]
    const boolFields = ["auto_add"]
    const body: Record<string, unknown> = { id: chargeId }

    if (numFields.includes(field)) {
      body[field] = value ? parseFloat(value) : null
    } else if (boolFields.includes(field)) {
      body[field] = value === "true"
    } else {
      body[field] = value || null
    }

    if (field === "charge_code") {
      const found = chargeCodes.find((c) => c.code === value)
      if (found) body.charge_name = found.name
    }
    return body
  }

  const patchChargeQuiet = async (chargeId: string, field: string, value: string): Promise<boolean> => {
    const res = await fetch("/api/drivers/pay-rates/profiles/charges", {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildChargePatchBody(chargeId, field, value)),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.warn("[patchChargeQuiet] PATCH /profiles/charges failed:", res.status, errText)
    }
    return res.ok
  }

  useEffect(() => { fetchLanes() }, [fetchLanes])

  const handleDeleteLane = async (laneId: string) => {
    await fetch(`/api/drivers/pay-rates/profiles/lanes?id=${laneId}`, { method: "DELETE" })
    fetchLanes(); onProfileUpdated()
  }

  const [fillDownMessage, setFillDownMessage] = useState<string | null>(null)

  // Fill Down a specific field from a specific charge to all charges below it
  const handleFillDownFrom = async (sourceChargeId: string, field: string) => {
    setFillDownMessage("Filling down...")
    const clearMsg = () => setTimeout(() => setFillDownMessage(null), 4000)
    try {
      let sourceValue: string | null = null
      let foundSource = false
      const targetCharges: { id: string; laneId: string }[] = []

      for (const lane of sortedLanes) {
        for (const charge of lane.charges) {
          if (charge.id === sourceChargeId) {
            sourceValue = String((charge as Record<string, unknown>)[field] ?? "")
            foundSource = true
            continue
          }
          if (foundSource) {
            targetCharges.push({ id: charge.id, laneId: lane.id })
          }
        }
      }

      if (sourceValue === null || targetCharges.length === 0) {
        setFillDownMessage("Nothing to fill below this row")
        clearMsg()
        return
      }

      for (const target of targetCharges) {
        const ok = await patchChargeQuiet(target.id, field, sourceValue)
        if (!ok) {
          setFillDownMessage("Fill down failed (server rejected an update)")
          clearMsg()
          return
        }
      }

      const affectedLaneIds = new Set(targetCharges.map((c) => c.laneId))
      for (const laneId of affectedLaneIds) {
        await fetchChargesForLane(laneId)
      }

      setFillDownMessage(`Filled ${targetCharges.length} row${targetCharges.length !== 1 ? "s" : ""} down`)
      clearMsg()
    } catch (err) {
      console.error("Fill down error:", err)
      setFillDownMessage("Fill down failed")
      clearMsg()
    }
  }

  // Fill down for condition fields (condition_type, operator, condition_value)
  // Uses direct PATCH/POST to avoid handleConditionUpdate's side effect of clearing
  // condition_value when condition_type changes (that behavior is correct for manual edits,
  // but wrong for fill-down where we want to copy the field value only).
  const handleFillDownCondition = async (sourceChargeId: string, condField: "condition_type" | "operator" | "condition_value") => {
    setFillDownMessage("Filling down...")
    const clearMsg = () => setTimeout(() => setFillDownMessage(null), 4000)
    // Find the source charge's first condition value
    let sourceCharge: RateProfileCharge | null = null
    let foundSource = false
    const targetCharges: { charge: RateProfileCharge; laneId: string }[] = []

    for (const lane of sortedLanes) {
      for (const charge of lane.charges) {
        if (charge.id === sourceChargeId) {
          sourceCharge = charge
          foundSource = true
          continue
        }
        if (foundSource) {
          targetCharges.push({ charge, laneId: lane.id })
        }
      }
    }

    if (!sourceCharge || targetCharges.length === 0) {
      setFillDownMessage("Nothing to fill below this row")
      clearMsg()
      return
    }

    const sourceCond = sourceCharge.conditions?.[0]
    // Determine the raw source value for the specific field
    let sourceValue: string | string[] = ""
    if (sourceCond) {
      if (condField === "condition_type") {
        sourceValue = sourceCond.condition_type || ""
      } else if (condField === "operator") {
        sourceValue = sourceCond.operator || ""
      } else {
        // condition_value — preserve as-is (could be array or string)
        sourceValue = Array.isArray(sourceCond.condition_value)
          ? sourceCond.condition_value as string[]
          : String(sourceCond.condition_value || "")
      }
    }

    try {
      for (const target of targetCharges) {
        const existing = target.charge.conditions?.[0]
        try {
          if (existing) {
            // Direct PATCH — only update the single field, preserving other condition fields
            const body: Record<string, unknown> = { id: existing.id }
            if (condField === "condition_value") {
              // For condition_value, pass as-is (array for in/not_in, string otherwise)
              const op = existing.operator
              if (typeof sourceValue === "string") {
                body.condition_value = (op === "in" || op === "not_in")
                  ? sourceValue.split(",").map((s) => s.trim()).filter(Boolean)
                  : sourceValue
              } else {
                body.condition_value = sourceValue
              }
            } else {
              body[condField] = sourceValue
            }
            const res = await fetch("/api/drivers/pay-rates/profiles/conditions", {
              method: "PATCH",
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
            if (!res.ok) {
              const errText = await res.text().catch(() => "")
              console.warn("[handleFillDownCondition] PATCH /profiles/conditions failed:", res.status, errText)
              setFillDownMessage("Fill down failed (server rejected a condition update)")
              clearMsg()
              return
            }
          } else if (condField === "condition_type" && sourceValue) {
            // No existing condition — create one with just the type (same as handleConditionUpdate)
            const res = await fetch("/api/drivers/pay-rates/profiles/conditions", {
              method: "POST",
              cache: "no-store",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                charge_id: target.charge.id,
                condition_type: sourceValue,
                operator: sourceCond?.operator || "in",
                condition_value: [],
                logic_group: 1,
                logic_operator: "AND",
              }),
            })
            if (!res.ok) {
              const errText = await res.text().catch(() => "")
              console.warn("[handleFillDownCondition] POST /profiles/conditions failed:", res.status, errText)
              setFillDownMessage("Fill down failed (server rejected a condition create)")
              clearMsg()
              return
            }
          }
        } catch (err) {
          console.error("Fill down condition error:", err)
          setFillDownMessage("Fill down failed")
          clearMsg()
          return
        }
      }

      const affectedLaneIds = new Set(targetCharges.map((c) => c.laneId))
      for (const laneId of affectedLaneIds) {
        await fetchChargesForLane(laneId)
      }

      setFillDownMessage(`Filled ${targetCharges.length} condition row${targetCharges.length !== 1 ? "s" : ""} down`)
      clearMsg()
    } catch (err) {
      console.error("Fill down condition error:", err)
      setFillDownMessage("Fill down failed")
      clearMsg()
    }
  }

  // Fill down for origin event (leg_from/event) — needs special handling for dual-field
  const handleFillDownOriginEvent = async (sourceChargeId: string) => {
    setFillDownMessage("Filling down...")
    const clearMsg = () => setTimeout(() => setFillDownMessage(null), 4000)
    try {
      let sourceCharge: RateProfileCharge | null = null
      let foundSource = false
      const targetCharges: { id: string; laneId: string }[] = []

      for (const lane of sortedLanes) {
        for (const charge of lane.charges) {
          if (charge.id === sourceChargeId) {
            sourceCharge = charge
            foundSource = true
            continue
          }
          if (foundSource) {
            targetCharges.push({ id: charge.id, laneId: lane.id })
          }
        }
      }

      if (!sourceCharge || targetCharges.length === 0) {
        setFillDownMessage("Nothing to fill below this row")
        clearMsg()
        return
      }

      // Origin event is stored in leg_from (by_leg mode) or event (other modes)
      const sourceValue = sourceCharge.leg_from || sourceCharge.event || ""

      for (const target of targetCharges) {
        let targetCharge: RateProfileCharge | null = null
        for (const lane of sortedLanes) {
          for (const ch of lane.charges) {
            if (ch.id === target.id) { targetCharge = ch; break }
          }
          if (targetCharge) break
        }
        const targetField = targetCharge?.calculation_mode === "by_leg" ? "leg_from" : "event"
        const ok = await patchChargeQuiet(target.id, targetField, sourceValue)
        if (!ok) {
          setFillDownMessage("Fill down failed (server rejected an update)")
          clearMsg()
          return
        }
      }

      const affectedLaneIds = new Set(targetCharges.map((c) => c.laneId))
      for (const laneId of affectedLaneIds) {
        await fetchChargesForLane(laneId)
      }

      setFillDownMessage(`Filled ${targetCharges.length} row${targetCharges.length !== 1 ? "s" : ""} down`)
      clearMsg()
    } catch (err) {
      console.error("Fill down origin event error:", err)
      setFillDownMessage("Fill down failed")
      clearMsg()
    }
  }

  const handleCopyCharges = (charges: RateProfileCharge[]) => { setCopiedCharges(charges) }

  const handlePasteCharges = async (targetLaneId: string) => {
    if (!copiedCharges || copiedCharges.length === 0) return
    setPasting(targetLaneId)
    try {
      for (const c of copiedCharges) {
        await fetch("/api/drivers/pay-rates/profiles/charges", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lane_id: targetLaneId, charge_code: c.charge_code, charge_name: c.charge_name,
            calculation_mode: c.calculation_mode, unit_of_measure: c.unit_of_measure,
            rate: c.rate, min_amount: c.min_amount, max_amount: c.max_amount,
            free_units: c.free_units, auto_add: c.auto_add, description: c.description,
            status_from: c.status_from, status_to: c.status_to,
            event: c.event, event_location: c.event_location,
            leg_from: c.leg_from, leg_from_location: c.leg_from_location,
            leg_to: c.leg_to, leg_to_location: c.leg_to_location,
          }),
        })
      }
      fetchChargesForLane(targetLaneId)
    } catch (err) { console.error("Paste error:", err) }
    finally { setPasting(null) }
  }

  const handleUpdateLaneName = async (laneId: string, newName: string) => {
    try {
      await fetch("/api/drivers/pay-rates/profiles/lanes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: laneId, name: newName || null }),
      })
      setLanes((prev) => prev.map((l) => l.id === laneId ? { ...l, name: newName || null } : l))
    } catch (err) { console.error("Lane name update error:", err) }
  }

  // Update a defined lane's pickup or delivery location (accepts comma-separated string for OR support)
  const handleUpdateDefinedLaneLocation = async (
    lane: LaneWithCharges, field: "pickup_location" | "delivery_location", newValue: string
  ) => {
    const currentVal = field === "pickup_location" ? lane.pickup_location : lane.delivery_location
    if (newValue === currentVal) return

    // 1. PATCH the lane's pickup/delivery location
    try {
      const patchRes = await fetch("/api/drivers/pay-rates/profiles/lanes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lane.id, [field]: newValue || null }),
      })
      if (!patchRes.ok) { console.error("Failed to update defined lane location"); return }
    } catch (err) { console.error("Defined lane location update error:", err); return }

    // 2. Update all charges on this lane — set leg_from_location or leg_to_location
    const chargeField = field === "pickup_location" ? "leg_from_location" : "leg_to_location"
    for (const charge of lane.charges) {
      try {
        await fetch("/api/drivers/pay-rates/profiles/charges", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: charge.id, [chargeField]: newValue }),
        })
      } catch (err) { console.error("Charge location update error:", err) }
    }

    // 3. Update local state
    setLanes((prev) => prev.map((l) => {
      if (l.id !== lane.id) return l
      return { ...l, [field]: newValue || null, name: null }
    }))
    fetchChargesForLane(lane.id)
  }

  const handleUpdateLaneMiles = async (laneId: string, zoneId: string | null, field: "min_miles" | "max_miles", value: string) => {
    if (!zoneId) return
    const numVal = parseFloat(value) || 0
    try {
      await fetch("/api/drivers/pay-rates/zones", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: zoneId, [field]: numVal }),
      })
      setLanes((prev) => prev.map((l) => {
        if (l.id !== laneId) return l
        return {
          ...l,
          zone_min_miles: field === "min_miles" ? numVal : l.zone_min_miles,
          zone_max_miles: field === "max_miles" ? numVal : l.zone_max_miles,
          zone_miles: field === "min_miles"
            ? `${numVal}-${l.zone_max_miles ?? 0} mi`
            : `${l.zone_min_miles ?? 0}-${numVal} mi`,
        }
      }))
    } catch (err) { console.error("Lane miles update error:", err) }
  }

  const handleChargeUpdate = async (chargeId: string, field: string, value: string) => {
    try {
      const ok = await patchChargeQuiet(chargeId, field, value)
      if (!ok) return
      const lane = lanes.find((l) => l.charges.some((c) => c.id === chargeId))
      if (lane) fetchChargesForLane(lane.id)
    } catch (err) { console.error("Charge update error:", err) }
  }

  // ─── Change location for a zonal lane + cascade to all charges ──
  const handleUpdateLaneLocation = async (lane: LaneWithCharges, newOrgName: string) => {
    if (!newOrgName) return
    // Skip if same location selected
    if (newOrgName === lane.origin_name || newOrgName === lane.origin_code) return
    // 1. Resolve org name → lane_origin ID (find existing or create)
    let newAnchorId: string | null = null
    const existingOrigin = origins.find(
      (o) => o.name.toLowerCase() === newOrgName.toLowerCase() || o.code.toLowerCase() === newOrgName.toLowerCase()
    )
    if (existingOrigin) {
      newAnchorId = existingOrigin.id
    } else {
      const org = orgs.find((o) => o.name === newOrgName)
      if (!org) return
      try {
        const code = newOrgName.replace(/[^A-Z0-9]/gi, "").substring(0, 5).toUpperCase() || "NEW"
        // Server will geocode city/state → lat/lng automatically
        const res = await fetch("/api/drivers/pay-rates/origins", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: org.name, code, city: org.city, state: org.state }),
        })
        if (res.ok) {
          const data = await res.json()
          newAnchorId = data.origin?.id || null
          onOriginsRefresh() // Refresh origins list so new origin shows up everywhere
        }
      } catch (err) { console.error("Error creating lane origin from org:", err) }
    }
    if (!newAnchorId) return

    // 2. PATCH the lane's anchor_point_id
    try {
      const patchRes = await fetch("/api/drivers/pay-rates/profiles/lanes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lane.id, anchor_point_id: newAnchorId }),
      })
      if (!patchRes.ok) { console.error("Failed to update lane anchor"); return }
    } catch (err) { console.error("Lane anchor update error:", err); return }

    // 3. Determine the new location label
    const resolvedOrigin = existingOrigin || origins.find((o) => o.id === newAnchorId)
    const newLocLabel = resolvedOrigin?.code || resolvedOrigin?.name || newOrgName

    // 4. Update all charges on this lane — set origin or destination location based on anchor_role
    for (const charge of lane.charges) {
      const updateBody: Record<string, unknown> = { id: charge.id }
      if (lane.anchor_role === "origin") {
        // Facility is origin → update leg_from_location
        updateBody.leg_from_location = newLocLabel
      } else {
        // Facility is destination → update leg_to_location
        updateBody.leg_to_location = newLocLabel
      }
      try {
        await fetch("/api/drivers/pay-rates/profiles/charges", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateBody),
        })
      } catch (err) { console.error("Charge location update error:", err) }
    }

    // 5. Update local state — lane origin info + re-fetch charges for fresh data
    setLanes((prev) => prev.map((l) => {
      if (l.id !== lane.id) return l
      return {
        ...l,
        anchor_point_id: newAnchorId,
        origin_name: resolvedOrigin?.name || newOrgName,
        origin_code: resolvedOrigin?.code || newOrgName.replace(/[^A-Z0-9]/gi, "").substring(0, 5).toUpperCase(),
        name: null, // Clear custom name so it reflects the new location in the label
      }
    }))
    fetchChargesForLane(lane.id)
  }

  // Deduplicated org options for location selector
  const orgOptions = (() => {
    const seen = new Set<string>()
    return orgs.filter((o) => {
      if (seen.has(o.name)) return false
      seen.add(o.name); return true
    }).map((o) => ({
      value: o.name, label: o.name,
      sublabel: `${o.type}${o.city ? ` · ${o.city}` : ""}${o.state ? `, ${o.state}` : ""}`,
    }))
  })()

  // Bulk-change location for ALL lanes at once (zonal + defined)
  const handleChangeAllLocations = async (orgName: string) => {
    if (!orgName) return
    setChangingAll(true)
    // Update zonal lanes
    const zonalLanes = lanes.filter((l) => l.lane_type === "zonal")
    for (const lane of zonalLanes) {
      await handleUpdateLaneLocation(lane, orgName)
    }
    // Update defined lanes
    const definedLanes = lanes.filter((l) => l.lane_type === "defined")
    for (const lane of definedLanes) {
      await handleUpdateDefinedLaneLocation(lane, "pickup_location", orgName)
    }
    setChangingAll(false)
    setShowChangeAll(false)
    setChangeAllValue("")
  }

  const handleChargeDelete = async (chargeId: string, laneId: string) => {
    try {
      await fetch(`/api/drivers/pay-rates/profiles/charges?id=${chargeId}`, { method: "DELETE" })
      fetchChargesForLane(laneId)
    } catch (err) { console.error("Delete error:", err) }
  }

  // ─── Condition CRUD ────────────────────────────────────────────
  const handleConditionUpdate = async (
    charge: RateProfileCharge,
    laneId: string,
    field: "condition_type" | "operator" | "condition_value",
    value: string,
  ) => {
    const existing = charge.conditions?.[0]
    try {
      if (existing) {
        // Update existing condition
        const body: Record<string, unknown> = { id: existing.id }
        if (field === "condition_value") {
          // Store as array for "in" / "not_in" operators, otherwise as string
          const op = existing.operator
          body.condition_value = (op === "in" || op === "not_in")
            ? value.split(",").map((s) => s.trim()).filter(Boolean)
            : value
        } else if (field === "condition_type") {
          // When changing condition type, clear the value so old data doesn't carry over
          body.condition_type = value
          body.condition_value = []
        } else {
          body[field] = value
        }
        await fetch("/api/drivers/pay-rates/profiles/conditions", {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })
      } else if (field === "condition_type" && value) {
        // Create new condition — user picked a type from the dropdown
        await fetch("/api/drivers/pay-rates/profiles/conditions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            charge_id: charge.id,
            condition_type: value,
            operator: "in",
            condition_value: [],
            logic_group: 1,
            logic_operator: "AND",
          }),
        })
      }
      // Re-fetch charges to get updated conditions
      fetchChargesForLane(laneId)
    } catch (err) { console.error("Condition update error:", err) }
  }

  const handleConditionDelete = async (conditionId: string, laneId: string) => {
    try {
      await fetch(`/api/drivers/pay-rates/profiles/conditions?id=${conditionId}`, { method: "DELETE" })
      fetchChargesForLane(laneId)
    } catch (err) { console.error("Condition delete error:", err) }
  }

  // ─── Lane sorting ─────────────────────────────────────────────
  const toggleLaneSort = () => {
    setLaneSort((prev) => {
      if (prev === null) return "asc"
      if (prev === "asc") return "desc"
      return null
    })
  }

  const handleDragStart = (laneId: string) => { setDragLaneId(laneId) }
  const handleDragOver = (e: React.DragEvent, laneId: string) => { e.preventDefault(); setDragOverLaneId(laneId) }
  const handleDragEnd = () => {
    if (dragLaneId && dragOverLaneId && dragLaneId !== dragOverLaneId) {
      setLanes((prev) => {
        const newLanes = [...prev]
        const fromIdx = newLanes.findIndex((l) => l.id === dragLaneId)
        const toIdx = newLanes.findIndex((l) => l.id === dragOverLaneId)
        if (fromIdx === -1 || toIdx === -1) return prev
        const [moved] = newLanes.splice(fromIdx, 1)
        newLanes.splice(toIdx, 0, moved)
        // Persist new order to DB — higher priority = earlier in list
        saveLanePriorities(newLanes)
        return newLanes
      })
      setLaneSort(null) // Clear sort when manually reordering
    }
    setDragLaneId(null)
    setDragOverLaneId(null)
  }

  const saveLanePriorities = async (orderedLanes: LaneWithCharges[]) => {
    try {
      const updates = orderedLanes.map((lane, idx) => ({
        id: lane.id,
        priority: orderedLanes.length - idx, // Higher priority = earlier
      }))
      // Fire PATCH requests in parallel for all lanes
      await Promise.all(
        updates.map((u) =>
          fetch("/api/drivers/pay-rates/profiles/lanes", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(u),
          })
        )
      )
      // Update local state with new priorities
      setLanes((prev) =>
        prev.map((l) => {
          const update = updates.find((u) => u.id === l.id)
          return update ? { ...l, priority: update.priority } : l
        })
      )
    } catch (err) {
      console.error("Error saving lane priorities:", err)
    }
  }

  const handleQuickAdd = async (laneId: string) => {
    if (!newCode || !newRate) return
    setSavingNew(true)
    try {
      const found = chargeCodes.find((c) => c.code === newCode)
      const body: Record<string, unknown> = {
        lane_id: laneId,
        charge_code: newCode,
        charge_name: found?.name || newCode,
        calculation_mode: newMode,
        unit_of_measure: newUom,
        rate: parseFloat(newRate),
        leg_from: newFromEvent || null,
        leg_to: newToEvent || null,
        auto_add: true,
      }
      const res = await fetch("/api/drivers/pay-rates/profiles/charges", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (res.ok) {
        setNewCode(""); setNewRate(""); setNewMode("by_leg"); setNewUom("per_move")
        setNewFromEvent("PICK_UP_CONTAINER"); setNewToEvent("DELIVER_CONTAINER")
        fetchChargesForLane(laneId)
      }
    } catch (err) { console.error("Quick add error:", err) }
    finally { setSavingNew(false) }
  }

  // Get first condition from a charge for display/edit
  const firstCond = (c: RateProfileCharge) => {
    if (!c.conditions || c.conditions.length === 0) return { id: "", type: "", operator: "in", value: "" }
    const cond = c.conditions[0]
    const val = Array.isArray(cond.condition_value) ? (cond.condition_value as string[]).join(", ") : String(cond.condition_value || "")
    return { id: cond.id, type: cond.condition_type, operator: cond.operator, value: val }
  }

  // Column header style
  const th = "px-1.5 py-1.5 text-left text-[11px] text-gray-400 font-semibold whitespace-nowrap"
  const td = "px-1.5 py-1 align-middle"
  const selCls = `w-full px-0.5 py-0.5 rounded text-[11px] ${S.input}`

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded transition-colors">
          <ArrowLeft size={18} className="text-gray-400" />
        </button>
        <div className="flex-1">
          <h3 className="text-white font-semibold">{profile.name}</h3>
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            {profile.description && <span>{profile.description}</span>}
            {profile.effective_date && <span>Effective: {profile.effective_date}</span>}
            {profile.driver_groups.length > 0 && (
              <span>Groups: {profile.driver_groups.map((g) => g.name).join(", ")}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {fillDownMessage && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/20">
              <span className="text-xs text-blue-400 font-medium">{fillDownMessage}</span>
            </div>
          )}
          {copiedCharges && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
              <Copy size={11} className="text-green-400" />
              <span className="text-[10px] text-green-400">{copiedCharges.length} charge{copiedCharges.length !== 1 ? "s" : ""} copied</span>
              <button onClick={() => setCopiedCharges(null)} className="p-0.5 hover:bg-white/10 rounded ml-1">
                <X size={10} className="text-green-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline add lane bar */}
      <InlineAddLane profileId={profile.id} profile={profile} origins={origins} zones={zones}
        chargeCodes={chargeCodes} orgs={orgs} existingLanes={lanes}
        onSaved={() => { fetchLanes(); onProfileUpdated() }}
        onOriginsRefresh={onOriginsRefresh}
        onEditProfile={onEditProfile} onCopyProfile={onCopyProfile}
        onDeleteProfile={onDeleteProfile} copyingProfile={copyingProfile} />

      {/* Flat spreadsheet table */}
      <div className={`rounded-b-lg border-x border-b ${S.divider}`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-[#E8700A] animate-spin" />
          </div>
        ) : lanes.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-600 text-sm">
            No lanes yet. Use the controls above to add or generate lanes.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-[11px] border-collapse min-w-[1500px]">
              <thead>
                <tr className={`${S.panelHeader} border-b ${S.divider} sticky top-0 z-10`}>
                  <th className={`${th} w-[30px]`}></th>
                  <th className={`${th} min-w-[150px]`}>
                    <div className="flex items-center gap-1">
                      <span>Origin</span>
                      <button onClick={toggleLaneSort}
                        className="p-0.5 hover:bg-white/10 rounded transition-colors" title={`Sort lanes ${laneSort === "asc" ? "Z-A" : laneSort === "desc" ? "Original" : "A-Z"}`}>
                        {laneSort === "asc" ? <ArrowUp size={10} className="text-[#E8700A]" />
                          : laneSort === "desc" ? <ArrowDown size={10} className="text-[#E8700A]" />
                          : <ArrowUpDown size={10} className="text-gray-500" />}
                      </button>
                      {showChangeAll ? (
                        <div className="flex items-center gap-1">
                          {changingAll ? (
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Loader2 size={10} className="animate-spin" /> Updating...
                            </span>
                          ) : (
                            <>
                              <SearchableSelect
                                value={changeAllValue}
                                onChange={(v) => { setChangeAllValue(v); if (v) handleChangeAllLocations(v) }}
                                options={orgOptions}
                                placeholder="Select origin..."
                                className="min-w-[160px]"
                              />
                            </>
                          )}
                          <button onClick={() => { setShowChangeAll(false); setChangeAllValue("") }}
                            className="p-0.5 hover:bg-white/10 rounded">
                            <X size={10} className="text-gray-400" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setShowChangeAll(true)}
                          className="text-[10px] text-purple-400 hover:text-purple-300 whitespace-nowrap"
                          title="Change origin for all lanes">
                          Change All
                        </button>
                      )}
                    </div>
                  </th>
                  <th className={`${th} min-w-[150px]`}>Destination</th>
                  <th className={`${th} w-[50px]`}>From (mi)</th>
                  <th className={`${th} w-[50px]`}>To (mi)</th>
                  <th className={`${th} min-w-[110px]`}>Charge Code</th>
                  <th className={`${th} min-w-[100px]`}>Charge Name</th>
                  <th className={`${th} w-[65px] text-right`}>Rate</th>
                  <th className={`${th} min-w-[90px]`}>UOM</th>
                  <th className={`${th} min-w-[80px]`}>Pay Mode</th>
                  <th className={`${th} min-w-[130px]`}>Origin Event</th>
                  <th className={`${th} min-w-[70px]`}>Origin</th>
                  <th className={`${th} min-w-[130px]`}>Destination Event</th>
                  <th className={`${th} min-w-[70px]`}>Destination</th>
                  <th className={`${th} min-w-[90px]`}>Addl Rule</th>
                  <th className={`${th} w-[60px]`}>Addl Exec</th>
                  <th className={`${th} min-w-[70px]`}>Addl Cond</th>
                  <th className={`${th} w-[50px]`}>Auto Add</th>
                  <th className={`${th} w-[30px]`}></th>
                </tr>
              </thead>

              {sortedLanes.map((lane, laneIdx) => {
                const hasCharges = lane.charges.length > 0
                const isAdding = addingForLane === lane.id

                // Render a charge row (reusable for both charge rows and empty lane row)
                const renderChargeRow = (charge: RateProfileCharge | null, cIdx: number) => {
                  const isFirst = cIdx === 0
                  const cond = charge ? firstCond(charge) : { id: "", type: "", operator: "in", value: "" }

                  return (
                    <tr key={charge?.id || `empty-${lane.id}`} className={`group ${S.row} ${dragOverLaneId === lane.id ? "bg-[#2a3040]" : ""}`}>
                      {/* Lane type icon + actions cell */}
                      <td className={`${td}`}>
                        {isFirst && (
                          <div className="flex items-center gap-0.5">
                            <div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              draggable onDragStart={() => handleDragStart(lane.id)}
                              onDragEnd={handleDragEnd} title="Drag to reorder">
                              <GripVertical size={9} className="text-gray-600" />
                            </div>
                            <div className={`p-0.5 rounded shrink-0 ${lane.lane_type === "zonal" ? "bg-purple-500/15" : "bg-cyan-500/15"}`}
                              title={lane.lane_type === "zonal" ? "Zonal" : "Fixed"}>
                              {lane.lane_type === "zonal"
                                ? <Route size={9} className="text-purple-400" />
                                : <MapPin size={9} className="text-cyan-400" />}
                            </div>
                            {lane.charges.length > 0 && (
                              <button onClick={() => handleCopyCharges(lane.charges)}
                                className="p-0.5 rounded text-gray-600 hover:text-gray-300 hover:bg-[#2a3040]" title="Copy charges">
                                <Copy size={9} />
                              </button>
                            )}
                            {copiedCharges && (
                              <button onClick={() => handlePasteCharges(lane.id)}
                                className="p-0.5 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400" title="Paste charges">
                                {pasting === lane.id ? <Loader2 size={9} className="animate-spin" /> : <Copy size={9} />}
                              </button>
                            )}
                            <button onClick={() => {
                              setAddingForLane(lane.id); setNewCode(""); setNewRate("")
                              setNewMode("by_leg"); setNewUom("per_move")
                              setNewFromEvent("PICK_UP_CONTAINER"); setNewToEvent("DELIVER_CONTAINER")
                            }}
                              className="p-0.5 rounded text-gray-600 hover:text-gray-300 hover:bg-[#2a3040]" title="Add charge">
                              <Plus size={9} />
                            </button>
                            {isAdding && (
                              <>
                                <button onClick={() => handleQuickAdd(lane.id)} disabled={savingNew || !newCode || !newRate}
                                  className="p-0.5 hover:bg-green-500/20 rounded disabled:opacity-30" title="Save new charge">
                                  {savingNew ? <Loader2 size={9} className="animate-spin text-gray-400" /> : <Check size={9} className="text-green-400" />}
                                </button>
                                <button onClick={() => setAddingForLane(null)} className="p-0.5 hover:bg-white/10 rounded" title="Cancel add">
                                  <X size={9} className="text-gray-500" />
                                </button>
                              </>
                            )}
                            <button onClick={() => handleDeleteLane(lane.id)}
                              className="p-1 hover:bg-red-500/20 rounded" title="Delete lane">
                              <Trash2 size={20} className="text-gray-600 hover:text-red-400" />
                            </button>
                          </div>
                        )}
                      </td>
                      {/* Origin column */}
                      <td className={`${td}`}>
                        {isFirst && (
                          lane.lane_type === "zonal" ? (
                            <div className="flex items-center gap-0.5">
                              <SearchableSelect
                                value={lane.origin_name || lane.origin_code || ""}
                                onChange={(v) => handleUpdateLaneLocation(lane, v)}
                                options={orgOptions}
                                placeholder="Facility..."
                                className="flex-1"
                              />
                              <span className="text-[9px] text-gray-600 whitespace-nowrap">
                                ({lane.anchor_role || "orig"})
                              </span>
                            </div>
                          ) : (
                            <SearchableSelect
                              value={lane.pickup_location || ""}
                              onChange={(v) => handleUpdateDefinedLaneLocation(lane, "pickup_location", v)}
                              options={orgOptions}
                              placeholder="Pickup..."
                            />
                          )
                        )}
                      </td>
                      {/* Destination column */}
                      <td className={`${td} border-r ${S.divider}`}>
                        {isFirst && (
                          lane.lane_type === "zonal" ? (
                            <span className="text-[11px] text-gray-400 px-1">
                              Z{lane.zone_number ?? "?"} {lane.zone_name ? `(${lane.zone_name})` : ""}
                            </span>
                          ) : (
                            <SearchableSelect
                              value={lane.delivery_location || ""}
                              onChange={(v) => handleUpdateDefinedLaneLocation(lane, "delivery_location", v)}
                              options={orgOptions}
                              placeholder="Delivery..."
                            />
                          )
                        )}
                      </td>
                      {/* From miles */}
                      <td className={`${td} text-center`}>
                        {isFirst && lane.lane_type === "zonal" ? (
                          <EditableCell
                            value={lane.zone_min_miles != null ? String(lane.zone_min_miles) : "0"}
                            onChange={(v) => handleUpdateLaneMiles(lane.id, lane.zone_id, "min_miles", v)}
                            type="number" className="text-gray-400 w-10 text-center" />
                        ) : isFirst ? <span className="text-gray-600">&mdash;</span> : null}
                      </td>
                      {/* To miles */}
                      <td className={`${td} text-center`}>
                        {isFirst && lane.lane_type === "zonal" ? (
                          <EditableCell
                            value={lane.zone_max_miles != null ? String(lane.zone_max_miles) : "0"}
                            onChange={(v) => handleUpdateLaneMiles(lane.id, lane.zone_id, "max_miles", v)}
                            type="number" className="text-gray-400 w-10 text-center" />
                        ) : isFirst ? <span className="text-gray-600">&mdash;</span> : null}
                      </td>

                      {charge ? (
                        <>
                          <td className={td}>
                            <EditableCell value={charge.charge_code}
                              onChange={(v) => handleChargeUpdate(charge.id, "charge_code", v)}
                              selectOptions={codeOptions} className="font-mono text-gray-300" />
                          </td>
                          <td className={td}>
                            <EditableCell value={charge.charge_name}
                              onChange={(v) => handleChargeUpdate(charge.id, "charge_name", v)}
                              className="text-white" />
                          </td>
                          <td className={`${td} text-right`}>
                            <div className="flex items-center justify-end gap-0.5">
                              <EditableCell value={Number(charge.rate).toFixed(2)}
                                onChange={(v) => handleChargeUpdate(charge.id, "rate", v)}
                                type="number" step="0.01" className="text-[#FF8C21] font-medium text-right w-14" />
                              <button onClick={() => handleFillDownFrom(charge.id, "rate")}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a3040]"
                                title="Fill this rate down to all rows below">
                                <ArrowDown size={20} className="text-gray-500 hover:text-[#FF8C21]" />
                              </button>
                            </div>
                          </td>
                          <td className={td}>
                            <EditableCell value={charge.unit_of_measure}
                              onChange={(v) => handleChargeUpdate(charge.id, "unit_of_measure", v)}
                              selectOptions={uomOptions} />
                          </td>
                          <td className={td}>
                            <EditableCell value={charge.calculation_mode}
                              onChange={(v) => handleChargeUpdate(charge.id, "calculation_mode", v)}
                              selectOptions={modeOptions} />
                          </td>
                          <td className={td}>
                            <div className="flex items-center gap-0.5">
                              <MultiSelectEvents
                                value={charge.leg_from || charge.event || ""}
                                onChange={(v) => {
                                  if (charge.calculation_mode === "by_leg") handleChargeUpdate(charge.id, "leg_from", v)
                                  else handleChargeUpdate(charge.id, "event", v)
                                }}
                                options={Object.entries(EVENT_LABELS).map(([k, l]) => ({ value: k, label: l }))} />
                              <button onClick={() => handleFillDownOriginEvent(charge.id)}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a3040]"
                                title="Fill this origin event down to all rows below">
                                <ArrowDown size={20} className="text-gray-500 hover:text-[#FF8C21]" />
                              </button>
                            </div>
                          </td>
                          <td className={td}>
                            <span className="text-[11px] text-gray-400 px-0.5 py-0.5 truncate block">
                              {charge.leg_from_location || charge.event_location || "\u2014"}
                            </span>
                          </td>
                          <td className={td}>
                            <div className="flex items-center gap-0.5">
                              <MultiSelectEvents
                                value={charge.leg_to || ""}
                                onChange={(v) => handleChargeUpdate(charge.id, "leg_to", v)}
                                options={Object.entries(EVENT_LABELS).map(([k, l]) => ({ value: k, label: l }))} />
                              <button onClick={() => handleFillDownFrom(charge.id, "leg_to")}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a3040]"
                                title="Fill this destination event down to all rows below">
                                <ArrowDown size={20} className="text-gray-500 hover:text-[#FF8C21]" />
                              </button>
                            </div>
                          </td>
                          <td className={td}>
                            <span className="text-[11px] text-gray-400 px-0.5 py-0.5 truncate block">
                              {charge.leg_to_location || "\u2014"}
                            </span>
                          </td>
                          <td className={td}>
                            <div className="flex items-center gap-0.5">
                              <EditableCell value={cond.type}
                                onChange={(v) => handleConditionUpdate(charge, lane.id, "condition_type", v)}
                                selectOptions={condTypeOptions} className="text-gray-400" />
                              <button onClick={() => handleFillDownCondition(charge.id, "condition_type")}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a3040]"
                                title="Fill this rule type down to all rows below">
                                <ArrowDown size={20} className="text-gray-500 hover:text-[#FF8C21]" />
                              </button>
                            </div>
                          </td>
                          <td className={td}>
                            <div className="flex items-center gap-0.5">
                              {cond.type ? (
                                <EditableCell value={cond.operator}
                                  onChange={(v) => handleConditionUpdate(charge, lane.id, "operator", v)}
                                  selectOptions={condOpOptions} className="text-gray-400" />
                              ) : <span className="text-gray-600">&mdash;</span>}
                              <button onClick={() => handleFillDownCondition(charge.id, "operator")}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a3040]"
                                title="Fill this operator down to all rows below">
                                <ArrowDown size={20} className="text-gray-500 hover:text-[#FF8C21]" />
                              </button>
                            </div>
                          </td>
                          <td className={td}>
                            <div className="flex items-start gap-0.5">
                              <div className="flex-1 min-w-0">
                                {cond.type ? (() => {
                                  // Build options: static first, then org-based types
                                  const ORG_COND_TYPE_MAP: Record<string, string> = {
                                    customer: "Customer", terminal: "Terminal", warehouse: "Warehouse",
                                  }
                                  let valOpts = getConditionValueOptions(cond.type)
                                  const isOrgType = !!ORG_COND_TYPE_MAP[cond.type]
                                  let orgValOpts: { value: string; label: string; sublabel?: string }[] | null = null
                                  if (!valOpts && isOrgType) {
                                    // Pull from org locations filtered by type
                                    const orgType = ORG_COND_TYPE_MAP[cond.type]
                                    const seen = new Set<string>()
                                    orgValOpts = orgs
                                      .filter((o) => o.type === orgType)
                                      .filter((o) => { if (seen.has(o.name)) return false; seen.add(o.name); return true })
                                      .map((o) => ({ value: o.name, label: o.name, sublabel: o.city ? `${o.city}${o.state ? `, ${o.state}` : ""}` : undefined }))
                                  }
                                  const isMultiOp = cond.operator === "in" || cond.operator === "not_in"

                                  // Org-based types get a searchable interface
                                  if (orgValOpts && isMultiOp) {
                                    const selectedVals = cond.value ? cond.value.split(",").filter(Boolean) : []
                                    const available = orgValOpts.filter((o) => !selectedVals.includes(o.value))
                                    return (
                                      <div className="space-y-0.5">
                                        {selectedVals.length > 0 && (
                                          <div className="flex flex-wrap gap-0.5">
                                            {selectedVals.map((v) => (
                                              <span key={v} className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-[#2a3040] border border-[#363f52] text-[9px] text-gray-300 whitespace-nowrap">
                                                {v}
                                                <button onClick={() => {
                                                  const next = selectedVals.filter((s) => s !== v).join(",")
                                                  handleConditionUpdate(charge, lane.id, "condition_value", next)
                                                }} className="hover:text-red-400 ml-0.5 leading-none"><X size={20} /></button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        {available.length > 0 && (
                                          <SearchableSelect value="" onChange={(v) => {
                                            const next = [...selectedVals, v].join(",")
                                            handleConditionUpdate(charge, lane.id, "condition_value", next)
                                          }} options={available} placeholder="Add..." className="max-w-[120px]" />
                                        )}
                                      </div>
                                    )
                                  }
                                  if (orgValOpts) {
                                    // Single-select searchable for equals/not_equals
                                    return (
                                      <SearchableSelect value={cond.value}
                                        onChange={(v) => handleConditionUpdate(charge, lane.id, "condition_value", v)}
                                        options={orgValOpts} placeholder="Select..." className="max-w-[120px]" />
                                    )
                                  }

                                  if (valOpts && isMultiOp) {
                                    // Multi-select tags for "Any in" / "Not in" with known options
                                    return (
                                      <MultiSelectEvents value={cond.value}
                                        onChange={(v) => handleConditionUpdate(charge, lane.id, "condition_value", v)}
                                        options={valOpts} />
                                    )
                                  }
                                  if (valOpts) {
                                    // Single-select dropdown for equals/not_equals etc.
                                    return (
                                      <EditableCell value={cond.value}
                                        onChange={(v) => handleConditionUpdate(charge, lane.id, "condition_value", v)}
                                        selectOptions={[{ value: "", label: "Select..." }, ...valOpts]}
                                        className="text-gray-400" />
                                    )
                                  }
                                  // Free text for unknown types
                                  return (
                                    <EditableCell value={cond.value}
                                      onChange={(v) => handleConditionUpdate(charge, lane.id, "condition_value", v)}
                                      className="text-gray-400" />
                                  )
                                })() : <span className="text-gray-600">&mdash;</span>}
                              </div>
                              <button onClick={() => handleFillDownCondition(charge.id, "condition_value")}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a3040] flex-shrink-0 mt-0.5"
                                title="Fill this condition value down to all rows below">
                                <ArrowDown size={20} className="text-gray-500 hover:text-[#FF8C21]" />
                              </button>
                            </div>
                          </td>
                          <td className={`${td} text-center`}>
                            <EditableCell value={String(charge.auto_add)}
                              onChange={(v) => handleChargeUpdate(charge.id, "auto_add", v)}
                              selectOptions={autoAddOptions}
                              className="text-gray-400" />
                          </td>
                          <td className={td}>
                            <button onClick={() => handleChargeDelete(charge.id, lane.id)}
                              className="p-1 hover:bg-red-500/20 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Delete charge">
                              <Trash2 size={20} className="text-gray-600 hover:text-red-400" />
                            </button>
                          </td>
                        </>
                      ) : (
                        /* No charge data — show loading spinner across charge columns or empty cells */
                        <>
                          <td className={td} colSpan={14}>
                            {lane.chargesLoading && (
                              <Loader2 className="w-3 h-3 text-[#E8700A] animate-spin inline" />
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                }

                return (
                  <tbody key={lane.id} className={laneIdx > 0 ? "border-t-2 border-[#363f52]" : ""}
                    onDragOver={(e) => handleDragOver(e, lane.id)}>
                    {hasCharges
                      ? lane.charges.map((charge, cIdx) => renderChargeRow(charge, cIdx))
                      : renderChargeRow(null, 0)
                    }

                    {/* Quick-add row for this lane */}
                    {isAdding && (
                      <tr className="bg-[#1a1f2c]">
                        <td className={td}></td>
                        <td className={td}></td>
                        <td className={td}></td>
                        <td className={td}></td>
                        <td className={td}></td>
                        <td className={td}>
                          <select value={newCode} onChange={(e) => setNewCode(e.target.value)} className={selCls}>
                            <option value="">Code...</option>
                            {chargeCodes.map((cc) => <option key={cc.code} value={cc.code}>{cc.code} &mdash; {cc.name}</option>)}
                          </select>
                        </td>
                        <td className={`${td} text-[10px] text-gray-500`}>
                          {newCode ? (chargeCodes.find((c) => c.code === newCode)?.name || "") : ""}
                        </td>
                        <td className={td}>
                          <input type="number" step="0.01" value={newRate}
                            onChange={(e) => setNewRate(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(lane.id); if (e.key === "Escape") setAddingForLane(null) }}
                            placeholder="0.00"
                            className={`w-14 text-right ${selCls}`} />
                        </td>
                        <td className={td}>
                          <select value={newUom} onChange={(e) => setNewUom(e.target.value)} className={selCls}>
                            {uomOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className={td}>
                          <select value={newMode} onChange={(e) => setNewMode(e.target.value)} className={selCls}>
                            {modeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className={td}>
                          <MultiSelectEvents value={newFromEvent}
                            onChange={(v) => setNewFromEvent(v)}
                            options={Object.entries(EVENT_LABELS).map(([k, l]) => ({ value: k, label: l }))} />
                        </td>
                        <td className={td}></td>
                        <td className={td}>
                          <MultiSelectEvents value={newToEvent}
                            onChange={(v) => setNewToEvent(v)}
                            options={Object.entries(EVENT_LABELS).map(([k, l]) => ({ value: k, label: l }))} />
                        </td>
                        <td className={td}></td>
                        <td className={td}></td>
                        <td className={td}></td>
                        <td className={td}></td>
                        <td className={td}></td>
                        <td className={td}></td>
                      </tr>
                    )}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </div>

      {/* Zonal Maps — one per unique origin used in this profile's zonal lanes */}
      {(() => {
        // Collect unique origin IDs from zonal lanes
        const originIds = new Set<string>()
        lanes.forEach((l) => {
          if (l.lane_type === "zonal" && l.anchor_point_id) originIds.add(l.anchor_point_id)
        })
        if (originIds.size === 0) return null

        const allProfileOrigins = origins.filter((o) => originIds.has(o.id))
        const uniqueOrigins = allProfileOrigins.filter((o) => o.latitude && o.longitude)
        const missingCoords = allProfileOrigins.filter((o) => !o.latitude || !o.longitude)

        // Show geocode button when origins exist but are missing coordinates
        const handleGeocode = async () => {
          setGeocodeStatus("Geocoding origins...")
          try {
            const res = await fetch("/api/drivers/pay-rates/origins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
            if (res.ok) {
              const data = await res.json()
              const problemStatuses = new Set([
                "geocode_failed",
                "rejected_out_of_bounds",
                "rejected_state_mismatch",
                "rejected_not_us_country",
                "db_error",
              ])
              const issues = Array.isArray(data.results)
                ? data.results.filter((r: { status: string }) => problemStatuses.has(r.status)).length
                : 0
              setGeocodeStatus(
                issues > 0
                  ? `Geocoded ${data.updated} of ${data.total} origins (${issues} row(s) need review — see API response "results")`
                  : `Geocoded ${data.updated} of ${data.total} origins`
              )
              onOriginsRefresh()
            } else {
              setGeocodeStatus("Failed to geocode origins")
            }
          } catch { setGeocodeStatus("Geocoding request failed") }
        }

        if (uniqueOrigins.length === 0 && missingCoords.length > 0) {
          return (
            <div className="mt-4 p-4 rounded-lg border border-white/10 bg-[#0B1120]">
              <div className="flex items-center gap-2 mb-2">
                <MapIcon size={14} className="text-[#E8700A]" />
                <span className="text-xs font-semibold text-white">Zone Maps</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                {missingCoords.length} origin{missingCoords.length > 1 ? "s" : ""} missing coordinates: {missingCoords.map((o) => o.name).join(", ")}
              </p>
              {geocodeStatus && <p className="text-xs text-[#FF8C21] mb-2">{geocodeStatus}</p>}
              <button
                onClick={handleGeocode}
                className="px-3 py-1.5 rounded text-xs font-medium bg-[#E8700A] hover:bg-[#FF8C21] text-white transition-colors"
              >
                Fix Map Coordinates
              </button>
            </div>
          )
        }

        if (uniqueOrigins.length === 0) return null

        return (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 px-1">
              <MapIcon size={14} className="text-[#E8700A]" />
              <span className="text-xs font-semibold text-white">Zone Maps</span>
              {missingCoords.length > 0 && (
                <button
                  onClick={handleGeocode}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#2a3040] hover:bg-[#3a4050] text-gray-300 border border-white/10 transition-colors"
                  title={`${missingCoords.length} origin(s) missing coordinates`}
                >
                  Fix {missingCoords.length} Missing
                </button>
              )}
            </div>
            <div className={`grid gap-4 ${uniqueOrigins.length === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
              {uniqueOrigins.map((origin) => {
                // Get zones for this origin
                const originZones = zones.filter((z) => z.origin_id === origin.id)
                return (
                  <div key={origin.id} className="h-[350px]">
                    <ZoneMap
                      latitude={origin.latitude!}
                      longitude={origin.longitude!}
                      originName={`${origin.name} (${origin.code})`}
                      zones={originZones.map((z) => ({
                        id: z.id,
                        zone_number: z.zone_number ?? 0,
                        name: z.name,
                        min_miles: z.min_miles ?? null,
                        max_miles: z.max_miles ?? null,
                        reference_city: z.reference_city ?? null,
                      }))}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────
export default function RateProfilesView() {
  const [profiles, setProfiles] = useState<RateProfile[]>([])
  const [chargeCodes, setChargeCodes] = useState<ChargeCode[]>([])
  const [origins, setOrigins] = useState<LaneOrigin[]>([])
  const [zones, setZones] = useState<LaneZone[]>([])
  const [orgs, setOrgs] = useState<OrgLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [editProfile, setEditProfile] = useState<RateProfile | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<RateProfile | null>(null)
  // Inline group editing on list page — uses fixed positioning to avoid overflow clipping
  const [inlineGroupsProfileId, setInlineGroupsProfileId] = useState<string | null>(null)
  const [inlineGroups, setInlineGroups] = useState<DriverGroupOption[]>([])
  const [inlineSelectedIds, setInlineSelectedIds] = useState<Set<string>>(new Set())
  const [inlineSaving, setInlineSaving] = useState(false)
  const [inlineDropdownPos, setInlineDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const inlineGroupsRef = useRef<HTMLDivElement>(null)

  // Close inline groups dropdown on outside click
  useEffect(() => {
    if (!inlineGroupsProfileId) return
    const handler = (e: MouseEvent) => {
      if (inlineGroupsRef.current && !inlineGroupsRef.current.contains(e.target as Node)) {
        setInlineGroupsProfileId(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [inlineGroupsProfileId])

  const openInlineGroups = async (profile: RateProfile, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Position dropdown below the clicked cell, check if it would go off-screen
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = 260
    const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight + rect.height : rect.bottom + 4
    setInlineDropdownPos({ top, left: rect.left })
    setInlineGroupsProfileId(profile.id)
    setInlineSelectedIds(new Set(profile.driver_groups.map((g) => g.id)))
    // Fetch all groups if not yet loaded
    if (inlineGroups.length === 0) {
      try {
        const res = await fetch("/api/drivers/pay-rates/groups")
        if (res.ok) {
          const data = await res.json()
          setInlineGroups((data.groups || []).map((g: any) => ({ id: g.id, name: g.name, pay_type: g.pay_type })))
        }
      } catch (err) { console.error("Error fetching groups:", err) }
    }
  }

  const saveInlineGroups = async (profileId: string) => {
    setInlineSaving(true)
    try {
      await fetch("/api/drivers/pay-rates/profiles/groups", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, group_ids: Array.from(inlineSelectedIds) }),
      })
      // Update local profiles state to reflect the change
      setProfiles((prev) => prev.map((p) => {
        if (p.id !== profileId) return p
        const updatedGroups = inlineGroups
          .filter((g) => inlineSelectedIds.has(g.id))
          .map((g) => ({ id: g.id, name: g.name }))
        return { ...p, driver_groups: updatedGroups }
      }))
      setInlineGroupsProfileId(null)
    } catch (err) { console.error("Error saving groups:", err) }
    finally { setInlineSaving(false) }
  }

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/drivers/pay-rates/profiles?all=true")
      if (res.ok) { const data = await res.json(); setProfiles(data.profiles || []) }
    } catch (err) { console.error("Error fetching profiles:", err) }
    finally { setLoading(false) }
  }, [])

  const fetchReferenceData = useCallback(async () => {
    try {
      const [codesRes, originsRes, orgsRes] = await Promise.all([
        fetch("/api/drivers/pay-rates/charge-codes"),
        fetch("/api/drivers/pay-rates/origins"),
        fetch("/api/organizations/locations"),
      ])
      if (codesRes.ok) { const data = await codesRes.json(); setChargeCodes(data.charge_codes || []) }
      if (originsRes.ok) {
        const data = await originsRes.json()
        setOrigins(data.origins || [])
        const allZones: LaneZone[] = []
        for (const origin of (data.origins || [])) {
          const zoneRes = await fetch(`/api/drivers/pay-rates/zones?origin_id=${origin.id}`)
          if (zoneRes.ok) {
            const zoneData = await zoneRes.json()
            allZones.push(...(zoneData.zones || []).map((z: any) => ({ ...z, origin_id: origin.id })))
          }
        }
        setZones(allZones)
      }
      if (orgsRes.ok) {
        const data = await orgsRes.json()
        setOrgs(data.locations || [])
      }
    } catch (err) { console.error("Error fetching reference data:", err) }
  }, [])

  useEffect(() => { fetchProfiles(); fetchReferenceData() }, [fetchProfiles, fetchReferenceData])

  const filteredProfiles = searchQuery
    ? profiles.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : profiles

  const handleDeleteProfile = async (profileId: string) => {
    const res = await fetch(`/api/drivers/pay-rates/profiles?id=${profileId}`, { method: "DELETE" })
    if (!res.ok) { const d = await res.json(); alert(d.error || "Failed"); return }
    fetchProfiles()
  }

  const [copying, setCopying] = useState<string | null>(null)
  const handleCopyProfile = async (profile: RateProfile) => {
    setCopying(profile.id)
    try {
      const res = await fetch("/api/drivers/pay-rates/profiles/copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_profile_id: profile.id, name: `${profile.name} Copy` }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error || "Failed to copy"); return }
      setSelectedProfile(null) // Go back to main table after copy
      fetchProfiles()
    } catch (err) { console.error("Copy error:", err) }
    finally { setCopying(null) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-[#E8700A] animate-spin" /></div>
  }

  if (selectedProfile) {
    return (
      <div className="p-4">
        <ProfileDetailView
          profile={selectedProfile} chargeCodes={chargeCodes} origins={origins} zones={zones} orgs={orgs}
          onBack={() => { setSelectedProfile(null); fetchProfiles() }}
          onProfileUpdated={fetchProfiles}
          onEditProfile={(p) => { setEditProfile(p); setProfileModalOpen(true) }}
          onDeleteProfile={(id) => { handleDeleteProfile(id); setSelectedProfile(null) }}
          onOriginsRefresh={fetchReferenceData}
          onCopyProfile={(p) => { handleCopyProfile(p) }}
          copyingProfile={copying === selectedProfile.id} />
        {/* ProfileModal must render here too so Edit Profile works from detail view */}
        <ProfileModal open={profileModalOpen}
          onClose={() => { setProfileModalOpen(false); setEditProfile(null) }}
          onSaved={async () => {
            // Re-fetch profiles and update the selected profile with fresh data
            try {
              const res = await fetch("/api/drivers/pay-rates/profiles?all=true")
              if (res.ok) {
                const data = await res.json()
                const updated = (data.profiles || []) as RateProfile[]
                setProfiles(updated)
                const refreshed = updated.find((p) => p.id === selectedProfile.id)
                if (refreshed) setSelectedProfile(refreshed)
              }
            } catch (err) { console.error("Error refreshing profiles:", err) }
          }}
          editProfile={editProfile} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {filteredProfiles.length} Rate Profile{filteredProfiles.length !== 1 ? "s" : ""}
        </h2>
        <button onClick={() => { setEditProfile(null); setProfileModalOpen(true) }}
          className="flex items-center gap-2 rounded-lg bg-[#E8700A] hover:bg-[#FF8C21] text-white px-4 py-2 transition-colors font-medium text-sm">
          <Plus size={16} /> New Profile
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input type="text" placeholder="Search profiles..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg ${S.input}`} />
      </div>

      <div className={`rounded-lg border overflow-hidden ${S.panel}`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${S.divider}`}>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Profile Name</th>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Lanes</th>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Driver Groups</th>
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Effective</th>
              <th className="px-5 py-2.5 text-right w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-500">
                {profiles.length === 0 ? "No rate profiles yet. Create your first profile." : "No profiles match."}
              </td></tr>
            ) : (
              filteredProfiles.map((profile) => (
                <tr key={profile.id} className={`cursor-pointer ${S.row} border-b ${S.divider}`}
                  onClick={() => setSelectedProfile(profile)}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF8C21] font-medium text-sm">{profile.name}</span>
                      {!profile.is_active && <span className="px-1.5 py-0.5 bg-red-500/10 rounded text-[9px] text-red-400">Inactive</span>}
                    </div>
                    {profile.description && <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-xs">{profile.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-white text-xs">{profile.lane_count}</td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="cursor-pointer hover:bg-[#2a3040] rounded px-1 py-0.5 -mx-1 transition-colors"
                      onClick={(e) => openInlineGroups(profile, e)}>
                      {profile.driver_groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {profile.driver_groups.map((g) => (
                            <span key={g.id} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-gray-400">{g.name}</span>
                          ))}
                        </div>
                      ) : <span className="text-[11px] text-gray-600">Click to assign...</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{profile.effective_date || "\u2014"}</td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => handleCopyProfile(profile)}
                        className="p-1.5 hover:bg-white/10 rounded" title="Copy profile">
                        {copying === profile.id ? <Loader2 size={13} className="text-gray-500 animate-spin" /> : <Copy size={13} className="text-gray-500" />}
                      </button>
                      <button onClick={() => { setEditProfile(profile); setProfileModalOpen(true) }}
                        className="p-1.5 hover:bg-white/10 rounded" title="Edit profile"><Pencil size={13} className="text-gray-500" /></button>
                      <button onClick={() => handleDeleteProfile(profile.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded" title="Delete profile"><Trash2 size={13} className="text-gray-500" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Fixed-position inline groups dropdown — rendered outside table to avoid overflow clipping */}
      {inlineGroupsProfileId && inlineDropdownPos && (
        <div ref={inlineGroupsRef}
          className="fixed z-[60] bg-[#1e2330] border border-[#363f52] rounded-lg shadow-2xl min-w-[240px]"
          style={{ top: inlineDropdownPos.top, left: inlineDropdownPos.left }}>
          {inlineGroups.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Loading...
            </div>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto">
                {inlineGroups.map((g) => (
                  <label key={g.id}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-[11px] ${
                      inlineSelectedIds.has(g.id) ? "bg-[#E8700A]/10 text-white" : "text-gray-300 hover:bg-[#2a3040]"
                    }`}>
                    <input type="checkbox" checked={inlineSelectedIds.has(g.id)}
                      onChange={() => {
                        setInlineSelectedIds((prev) => {
                          const next = new Set(prev)
                          if (next.has(g.id)) next.delete(g.id); else next.add(g.id)
                          return next
                        })
                      }}
                      className="rounded border-[#363f52] bg-[#2a3040] text-[#E8700A] focus:ring-[#E8700A] focus:ring-offset-0 w-3 h-3" />
                    <span>{g.name}</span>
                    <span className="text-[9px] text-gray-500 ml-auto">{g.pay_type === "per_move" ? "Per Move" : "Hourly"}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-[#363f52]">
                <button onClick={() => setInlineGroupsProfileId(null)}
                  className="px-2 py-1 text-[10px] text-gray-400 hover:text-white">Cancel</button>
                <button onClick={() => saveInlineGroups(inlineGroupsProfileId)} disabled={inlineSaving}
                  className="px-3 py-1 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 text-white text-[10px] font-medium rounded flex items-center gap-1">
                  {inlineSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <ProfileModal open={profileModalOpen}
        onClose={() => { setProfileModalOpen(false); setEditProfile(null) }}
        onSaved={fetchProfiles} editProfile={editProfile} />
    </div>
  )
}
