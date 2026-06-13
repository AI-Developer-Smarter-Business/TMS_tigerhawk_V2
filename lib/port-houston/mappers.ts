// lib/port-houston/mappers.ts
// Transform Port Houston API payloads into Supabase-compatible rows

import type { PHVesselVisit, PHUnit } from "./types"

// ============================================================
// Timestamp Conversion
// ============================================================
// PH API returns timestamps in mixed formats:
//   - Epoch milliseconds as numbers (e.g. 1771351200000)
//   - Epoch milliseconds as strings (e.g. "1771351200000")
//   - ISO 8601 strings (e.g. "2026-02-18T12:00:00Z")
//   - null / undefined
// Supabase expects ISO 8601 strings for timestamptz columns.

function toISOTimestamp(value: unknown): string | null {
  if (value == null || value === "") return null

  // If it's a number, treat as epoch milliseconds
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null
    return new Date(value).toISOString()
  }

  if (typeof value === "string") {
    // Check if it's a numeric string (epoch ms)
    if (/^\d{10,13}$/.test(value)) {
      const ms = value.length <= 10 ? Number(value) * 1000 : Number(value)
      return new Date(ms).toISOString()
    }
    // Otherwise assume it's already an ISO string — validate it
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toISOString()
    return null
  }

  return null
}

// ============================================================
// Facility Code Mapping
// ============================================================
// PH uses "BPT" for Bayport Container Terminal
// Our DB uses "BAY" for Bayport, "BCT" for Barbours Cut (vessels.terminal, sync).
// UI terminal filters derive BCT/BAY labels from `terminals.name` via `lib/terminals/phTerminalFilters.ts`.
const FACILITY_MAP: Record<string, string> = {
  BPT: "BAY",
  BCT: "BCT",
  S40_YARD: "BAY", // fallback for scope-level facility
}

// Facilities that are container terminals we care about
const VALID_TERMINALS = new Set(["BAY", "BCT"])

function mapFacility(facility?: string): string | null {
  if (!facility) return "BAY" // default
  const mapped = FACILITY_MAP[facility] || null
  return mapped
}

/**
 * Check if a mapped terminal is one we track (BCT or BAY).
 * PH returns vessels at many facilities (TBT, STEEL, LIQUID, etc.)
 * that aren't container terminals — we skip those.
 */
export function isValidTerminal(terminal: string | null): boolean {
  return terminal !== null && VALID_TERMINALS.has(terminal)
}

// ============================================================
// Vessel Mapper
// ============================================================
/**
 * PH sometimes sends ibVyg/obVyg equal to the vessel display name instead of a voyage code.
 * Prefer a suffix from visitId (e.g. CHI-610E → 610E) when that happens.
 */
function voyageNumberFromPh(pv: PHVesselVisit): string {
  const raw = (pv.ibVyg || pv.obVyg || "").trim()
  const vesName = (pv.vesName || "").trim()
  if (!raw) return ""
  const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase()
  if (vesName && norm(raw) === norm(vesName)) {
    const vid = (pv.visitId || "").trim()
    const m = vid.match(/^[A-Za-z0-9]+-(.+)$/)
    if (m) return m[1]
    return ""
  }
  return raw
}

export interface MappedVessel {
  visit_id: string
  name: string
  voyage_number: string
  terminal: string | null
  shipping_line: string | null
  visit_phase: string | null
  eta: string | null
  ata: string | null
  etd: string | null
  time_first_available: string | null
  time_discharge_complete: string | null
  cargo_cutoff: string | null
  service_name: string | null
  ph_synced_at: string
}

export function mapVessel(pv: PHVesselVisit): MappedVessel {
  return {
    visit_id: pv.visitId,
    name: pv.vesName || pv.vesId || "Unknown",
    voyage_number: voyageNumberFromPh(pv),
    terminal: mapFacility(pv.facility),
    shipping_line: pv.lineName || pv.lineId || null,
    visit_phase: pv.visitPhase || null,
    eta: toISOTimestamp(pv.eta) || toISOTimestamp(pv.publishedEta),
    ata: toISOTimestamp(pv.ata),
    etd: toISOTimestamp(pv.etd) || toISOTimestamp(pv.publishedEtd),
    time_first_available: toISOTimestamp(pv.timeFirstAvailability),
    time_discharge_complete: toISOTimestamp(pv.timeDischargeComplete),
    cargo_cutoff: toISOTimestamp(pv.cargoCutoff),
    service_name: pv.serviceName || null,
    ph_synced_at: new Date().toISOString(),
  }
}

// ============================================================
// Container / Unit Mapper
// ============================================================
export interface MappedContainer {
  unit_id: string
  container_number: string
  category: string | null
  freight_kind: string | null
  transit_state: string | null
  shipping_line: string | null
  equipment_type: string | null
  size: string
  bol_number: string | null
  status: string
  stopped_vessel: boolean
  stopped_rail: boolean
  stopped_road: boolean
  impediment_road: string | null
  gross_weight_kg: number | null
  seal_number: string | null
  time_in: string | null
  time_out: string | null
  dray_status: string | null
  last_free_day: string | null
  ph_synced_at: string
  // Used to link vessel after upsert
  _vessel_visit_id?: string
}

/**
 * Extract container size (20/40/45) from PH eqtypeId or nominalLength.
 * Examples: "40HC" → "40", "20GP" → "20", "45HC" → "45", "NOM40" → "40"
 */
function extractSize(eqtypeId?: string, nominalLength?: string): string {
  // Try eqtypeId first: "40HC", "20GP", "45HC", "40GP"
  if (eqtypeId) {
    const match = eqtypeId.match(/^(\d{2})/)
    if (match) {
      const num = match[1]
      if (num === "20" || num === "40" || num === "45") return num
    }
  }
  // Try nominalLength: "NOM20", "NOM40", "NOM45"
  if (nominalLength) {
    const match = nominalLength.match(/(\d{2})$/)
    if (match) {
      const num = match[1]
      if (num === "20" || num === "40" || num === "45") return num
    }
  }
  return "40" // default
}

/**
 * Map PH transit state to our container status.
 *
 * PH transit states:
 *   S10_ADVISED → container announced but not yet arrived
 *   S20_INBOUND → on vessel approaching port
 *   S30_ECIN → entered through gate/rail inbound
 *   S40_YARD → sitting in the yard
 *   S50_ECOUT → exiting through gate/rail outbound
 *   S60_LOADED → loaded onto outbound carrier
 *   S70_DEPARTED → left the port
 *
 * Our statuses: "On Vessel" | "Available" | "Released" | "Picked Up"
 */
function mapContainerStatus(unit: PHUnit): string {
  const state = unit.transitState || ""
  const stoppedRoad = unit.stopFlags?.stoppedRoad ?? false

  switch (state) {
    case "S10_ADVISED":
    case "S20_INBOUND":
    case "S30_ECIN":
      return "On Vessel"

    case "S40_YARD":
      // In yard: "Available" if no road holds, "Released" if held
      // Note: "Released" in our system means customs-released but possibly
      // with holds. If the container has road stops, it can't be picked up.
      return stoppedRoad ? "Released" : "Available"

    case "S50_ECOUT":
    case "S60_LOADED":
    case "S70_DEPARTED":
      return "Picked Up"

    default:
      // Unknown state — keep as Available if in yard context
      return "Available"
  }
}

export function mapUnit(pu: PHUnit): MappedContainer {
  const vesselVisitId =
    pu.routing?.declaredIbVisit?.visitId ||
    pu.routing?.actualIbVisit?.visitId ||
    pu.actualIbVisit?.visitId ||
    undefined

  return {
    unit_id: pu.unitId,
    container_number: pu.unitId,
    category: pu.category || null,
    freight_kind: pu.freightKind || null,
    transit_state: pu.transitState || null,
    shipping_line: pu.line || null,
    equipment_type: pu.eqtypeId || null,
    size: extractSize(pu.eqtypeId, pu.nominalLength),
    bol_number: pu.blNbr || null,
    status: mapContainerStatus(pu),
    stopped_vessel: pu.stopFlags?.stoppedVessel ?? false,
    stopped_rail: pu.stopFlags?.stoppedRail ?? false,
    stopped_road: pu.stopFlags?.stoppedRoad ?? false,
    impediment_road: pu.impediments?.impedimentRoad || null,
    gross_weight_kg: pu.contents?.goodsAndCtrWtKg ?? null,
    seal_number: pu.seals?.sealNbr1 || null,
    time_in: toISOTimestamp(pu.timestamps?.timeIn),
    time_out: toISOTimestamp(pu.timestamps?.timeOut),
    dray_status: pu.drayStatus || null,
    last_free_day: toISOTimestamp(pu.ufvBilling?.lastFreeDay),
    ph_synced_at: new Date().toISOString(),
    _vessel_visit_id: vesselVisitId,
  }
}
