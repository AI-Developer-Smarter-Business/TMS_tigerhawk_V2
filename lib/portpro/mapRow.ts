/**
 * lib/portpro/mapRow.ts
 *
 * Maps a PortPro CSV row (keyed by header names) into TigerHawk DB-ready
 * objects for the containers, loads, customers, and drivers tables.
 *
 * Shared by both the web import (API route) and the CLI script.
 */

// ─── Date helpers ─────────────────────────────────────────

/** Parse PortPro datetime: "MM/DD/YY HH:MM AM/PM" or "MM/DD/YY" → ISO string */
export function parseDate(val: string | undefined | null): string | null {
  if (!val || val.trim() === "") return null
  const trimmed = val.trim()

  // Handle MM/DD/YY or MM/DD/YYYY with optional time
  const match = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM))?/i,
  )
  if (match) {
    const month = match[1].padStart(2, "0")
    const day = match[2].padStart(2, "0")
    let year = match[3]
    if (year.length === 2) year = "20" + year

    if (match[4]) {
      // Has time component
      let hours = parseInt(match[4], 10)
      const minutes = match[5]
      const ampm = (match[7] || "").toUpperCase()
      if (ampm === "PM" && hours < 12) hours += 12
      if (ampm === "AM" && hours === 12) hours = 0
      return `${year}-${month}-${day}T${String(hours).padStart(2, "0")}:${minutes}:00Z`
    }
    return `${year}-${month}-${day}`
  }

  // Fallback: try native Date parsing
  try {
    const d = new Date(trimmed)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

/** Parse to date-only (YYYY-MM-DD) */
export function parseDateOnly(val: string | undefined | null): string | null {
  const iso = parseDate(val)
  if (!iso) return null
  return iso.split("T")[0]
}

/** Parse number, stripping commas */
export function parseNum(val: string | undefined | null): number | null {
  if (!val || val.trim() === "") return null
  const n = parseFloat(val.replace(/,/g, ""))
  return isNaN(n) ? null : n
}

/** Parse boolean from "Yes"/"No"/"true"/"false"/"1"/"0" */
export function parseBool(val: string | undefined | null): boolean {
  const v = (val || "").toLowerCase().trim()
  return v === "yes" || v === "true" || v === "1"
}

// ─── Status mapping ───────────────────────────────────────

/** All valid load statuses per DB check constraint */
const VALID_LOAD_STATUSES = new Set([
  "Available",
  "Available At Port",
  "Pending",
  "Customs Hold",
  "Freight Released",
  "Created",
  "Assigned",
  "Dispatched",
  "In Transit",
  "Arrived At Pickup",
  "Arrived At Delivery",
  "Arrived At Return Empty",
  "Arrived To Hook Container",
  "At Warehouse",
  "Dropped - Empty",
  "Dropped - Loaded",
  "Enroute To Drop Container",
  "Enroute To Return Empty",
  "Delivered",
  "Completed",
  "Cancelled",
])

const STATUS_MAP: Record<string, string> = {
  AVAILABLE: "Available",
  "AVAILABLE AT PORT": "Available At Port",
  PENDING: "Pending",
  DISPATCHED: "Dispatched",
  DROPPED: "Delivered",
  "DROPPED EMPTY": "Dropped - Empty",
  "DROPPED - EMPTY": "Dropped - Empty",
  "DROPPED LOADED": "Dropped - Loaded",
  "DROPPED - LOADED": "Dropped - Loaded",
  ASSIGNED: "Assigned",
  CREATED: "Created",
  "AT WAREHOUSE": "At Warehouse",
  "ENROUTE TO DROP CONTAINER": "Enroute To Drop Container",
  "ENROUTE TO RETURN EMPTY": "Enroute To Return Empty",
  "ENROUTE TO DELIVER LOAD": "In Transit",
  "ENROUTE TO PICK CONTAINER": "In Transit",
  "ENROUTE TO HOOK CONTAINER": "In Transit",
  "ARRIVED AT DELIVER LOAD": "Arrived At Delivery",
  "ARRIVED AT DELIVERY": "Arrived At Delivery",
  "ARRIVED AT PICK CONTAINER": "Arrived At Pickup",
  "ARRIVED AT PICKUP": "Arrived At Pickup",
  "ARRIVED AT RETURN EMPTY": "Arrived At Return Empty",
  "ARRIVED TO HOOK CONTAINER": "Arrived To Hook Container",
  "CUSTOMS HOLD": "Customs Hold",
  "FREIGHT RELEASED": "Freight Released",
  "IN TRANSIT": "In Transit",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  CANCELED: "Cancelled",
}

export function mapStatus(raw: string | undefined | null): string {
  if (!raw) return "Pending"
  const mapped = STATUS_MAP[raw.toUpperCase().trim()]
  if (mapped && VALID_LOAD_STATUSES.has(mapped)) return mapped
  // Fallback: try to find a partial match
  const upper = raw.toUpperCase().trim()
  if (upper.includes("ENROUTE") || upper.includes("EN ROUTE")) return "In Transit"
  if (upper.includes("ARRIVED")) return "In Transit"
  if (upper.includes("DROPPED")) return "Delivered"
  if (upper.includes("AVAILABLE")) return "Available"
  return "Pending"
}

/** Map PortPro "Move" → load_type */
export function mapLoadType(move: string | undefined | null): string | null {
  const m = (move || "").toUpperCase().trim()
  if (m === "IMPORT") return "Import"
  if (m === "EXPORT") return "Export"
  if (m === "ROAD") return "Road"
  if (m === "BILL ONLY" || m === "BILL-ONLY") return "Bill Only"
  // Return null only if empty — the DB allows null for load_type
  return m ? "Import" : null
}

/** Normalize container size: "40'" → "40", "20'" → "20" */
export function normalizeContainerSize(
  raw: string | undefined | null,
): string | null {
  if (!raw || raw.trim() === "") return null
  return raw.trim().replace(/'/g, "")
}

/** Valid container types per DB check constraint */
const VALID_CONTAINER_TYPES = new Set(["HC", "ST", "RF", "OT", "FR", "TK"])

/** Map raw container type to a valid DB enum value, defaulting to "ST" */
export function normalizeContainerType(
  raw: string | undefined | null,
): string {
  if (!raw || raw.trim() === "") return "ST"
  const upper = raw.trim().toUpperCase()
  if (VALID_CONTAINER_TYPES.has(upper)) return upper
  // Best-effort mapping for common full names
  if (upper.includes("HIGH CUBE") || upper.includes("HIGH-CUBE")) return "HC"
  if (upper.includes("REEFER") || upper.includes("REFRIG")) return "RF"
  if (upper.includes("OPEN TOP")) return "OT"
  if (upper.includes("FLAT")) return "FR"
  if (upper.includes("TANK")) return "TK"
  if (upper.includes("STANDARD") || upper.includes("DRY")) return "ST"
  return "ST" // safe default
}

// ─── Types ────────────────────────────────────────────────

/** A single PortPro CSV row as parsed by PapaParse (string-keyed object) */
export type PortProRow = Record<string, string>

/** Container record ready for DB upsert */
export interface MappedContainer {
  container_number: string
  bol_number: string | null
  booking_number: string | null
  size: string | null
  type: string
  status: string
  last_free_day: string | null
  weight_lbs: number | null
  seal_number: string | null
  shipping_line: string | null
  notes: string | null
}

/** Load record ready for DB upsert (minus FK IDs which are resolved at import time) */
export interface MappedLoad {
  reference_number: string
  status: string
  load_type: string | null
  container_number: string | null
  customer_name: string | null
  driver_name: string | null
  pickup_location: string | null
  delivery_location: string | null
  return_location: string | null
  pickup_apt_from: string | null
  vessel_eta: string | null
  discharge_date: string | null
  outgate_date: string | null
  ingate_date: string | null
  empty_date: string | null
  per_diem_free_day: string | null
  completed_date: string | null
  delivered_to_user_date: string | null
  ssl: string | null
  mbol: string | null
  house_bol: string | null
  seal_number: string | null
  vessel_name: string | null
  voyage: string | null
  purchase_order: string | null
  shipment_number: string | null
  pickup_number: string | null
  reservation_number: string | null
  return_number: string | null
  chassis_number: string | null
  chassis_size: string | null
  chassis_type: string | null
  container_size: string | null
  container_type: string | null
  commodity: string | null
  total_weight: number | null
  temperature: string | null
  rate: number | null
  distance: number | null
  is_hazmat: boolean
  is_overweight: boolean
  freight_hold: string
  customs_hold: string
  carrier_hold: boolean
  notes: string | null
  scheduled_pickup: string | null
}

// ─── Row mapper ───────────────────────────────────────────

/**
 * Map a raw PortPro CSV row into structured load + container data.
 * Returns null if the row has no Load # (skip invalid rows).
 */
export function mapPortProRow(r: PortProRow): {
  load: MappedLoad
  container: MappedContainer | null
} | null {
  const refNum = (r["Load #"] || "").trim()
  if (!refNum) return null

  const containerNum = (r["Container #"] || "").trim()
  const hasContainer = containerNum.length > 0

  // Map container (only if container number present)
  const container: MappedContainer | null = hasContainer
    ? {
        container_number: containerNum,
        bol_number: r["BOL/BKG"] || null,
        booking_number: r["BOOKING #"] || null,
        size: normalizeContainerSize(r["Container Size"]),
        type: normalizeContainerType(r["Container Type"]),
        status: mapContainerStatus(r["Status"]),
        last_free_day: parseDateOnly(r["Last Free Day"]),
        weight_lbs: parseNum(r["Total Weight"]),
        seal_number: r["Seal #"] || null,
        shipping_line: r["SSL"] || null,
        notes: null,
      }
    : null

  // Map load
  const driverStr = (r["Driver"] || "").trim()
  const primaryDriver = driverStr ? driverStr.split(",")[0].trim() : null

  const load: MappedLoad = {
    reference_number: refNum,
    status: mapStatus(r["Status"]),
    load_type: mapLoadType(r["Move"]),
    container_number: hasContainer ? containerNum : null,
    customer_name: (r["Customer"] || "").trim() || null,
    driver_name: primaryDriver,
    pickup_location: r["Pick Up Location"] || null,
    delivery_location: r["Delivery Location"] || null,
    return_location: r["Return Location"] || null,
    pickup_apt_from: parseDate(r["APT"]),
    vessel_eta: parseDate(r["ETA"]),
    discharge_date: parseDate(r["Discharged Date"]),
    outgate_date: parseDate(r["Outgate Date"]),
    ingate_date: parseDate(r["Ingate Date"]),
    empty_date: parseDate(r["Empty Date"]),
    per_diem_free_day: parseDateOnly(r["Per Diem Free Day"]),
    completed_date: parseDate(r["Load Completed At"]),
    delivered_to_user_date: parseDate(r["Deliver Load Arrived"]),
    ssl: r["SSL"] || null,
    mbol: r["BOL/BKG"] || null,
    house_bol: r["House BOL"] || null,
    seal_number: r["Seal #"] || null,
    vessel_name: r["Vessel Name"] || null,
    voyage: r["Voyage"] || null,
    purchase_order: r["Purchase Order #"] || r["PO #"] || null,
    shipment_number: r["Shipment"] || null,
    pickup_number: r["Pick up #"] || r["PICKUP #"] || null,
    reservation_number: r["Reservation #"] || null,
    return_number: r["Return #"] || null,
    chassis_number: r["Chassis #"] || null,
    chassis_size: r["Chassis Size"] || null,
    chassis_type: r["Chassis Type"] || null,
    container_size: normalizeContainerSize(r["Container Size"]),
    container_type: normalizeContainerType(r["Container Type"]),
    commodity: r["Commodity"] || null,
    total_weight: parseNum(r["Total Weight"]),
    temperature: r["Temperature"] || null,
    rate: parseNum(r["Pricing Total"]),
    distance: parseNum(r["Total Distance"]),
    is_hazmat: parseBool(r["Hazmat"]),
    is_overweight: parseBool(r["Over Weight"]),
    freight_hold:
      r["Freight"] === "Hold"
        ? "hold"
        : r["Freight"] === "Released" || r["Freight"] === "RELEASED"
          ? "released"
          : "none",
    customs_hold:
      r["Custom"] === "Hold" || r["Custom"] === "HOLD"
        ? "hold"
        : r["Custom"] === "Released" || r["Custom"] === "RELEASED"
          ? "released"
          : "none",
    carrier_hold: parseBool(r["Carrier Hold"]),
    notes: r["Load Notes"] || r["Driver Note"] || null,
    scheduled_pickup: parseDate(r["Move Assigned Date"]),
  }

  return { load, container }
}

// ─── Container status mapping ─────────────────────────────

function mapContainerStatus(loadStatus: string | undefined | null): string {
  const s = (loadStatus || "").toUpperCase().trim()
  if (s === "AVAILABLE" || s === "FREIGHT RELEASED") return "Available"
  if (s === "PENDING" || s === "CUSTOMS HOLD") return "On Vessel"
  if (s.includes("ENROUTE") || s.includes("IN TRANSIT") || s === "DISPATCHED")
    return "In Transit"
  if (s.includes("ARRIVED") || s === "DROPPED") return "Picked Up"
  if (s === "COMPLETED") return "Released"
  return "Available"
}
