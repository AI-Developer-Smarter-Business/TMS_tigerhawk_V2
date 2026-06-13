/**
 * Nominatim helpers for lane_origins: throttle, forward geocode, reverse verify, US bounds.
 * @see docs/SUGGESTION_FOR_RESOLVING_GEOLOCATION.md
 */

/** Nominatim requires a valid User-Agent identifying the application. */
export const NOMINATIM_USER_AGENT = "TigerhawkTMS/1.0"
const NOMINATIM_MIN_INTERVAL_MS = 1100

let lastNominatimRequestAt = 0

export async function nominatimThrottle(): Promise<void> {
  const now = Date.now()
  const wait = Math.max(0, lastNominatimRequestAt + NOMINATIM_MIN_INTERVAL_MS - now)
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait))
  }
  lastNominatimRequestAt = Date.now()
}

/** Continental US, Alaska, and Hawaii — rejects obvious non-US pins while allowing common TMS lanes. */
export function isLikelyUsLocation(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat >= 24.0 && lat <= 50.0 && lng >= -125.0 && lng <= -66.0) return true
  if (lat >= 54.0 && lat <= 72.0 && lng >= -170.0 && lng <= -130.0) return true
  if (lat >= 18.5 && lat <= 22.5 && lng >= -161.0 && lng <= -154.5) return true
  return false
}

export function normalizeUsStateAbbrev(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const t = raw.trim()
  if (t.length === 0) return null
  const upper = t.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper)) return upper
  const usMatch = upper.match(/^US-([A-Z]{2})$/)
  if (usMatch) return usMatch[1]
  return null
}

type ReverseMeta = { countryCode: string | null; stateCode: string | null }

async function reverseGeocodeUsMeta(lat: number, lng: number): Promise<ReverseMeta | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&format=json`,
      {
        headers: { "User-Agent": NOMINATIM_USER_AGENT },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return null
    const raw: unknown = await res.json()
    if (raw === null || typeof raw !== "object") return null
    const addrVal = (raw as Record<string, unknown>).address
    if (addrVal === null || typeof addrVal !== "object") {
      return { countryCode: null, stateCode: null }
    }
    const addr = addrVal as Record<string, unknown>
    const countryCode = typeof addr.country_code === "string" ? addr.country_code.toLowerCase() : null
    const nominatimIsoRegionKey = "ISO3166-2-lvl4"
    const isoRaw = addr[nominatimIsoRegionKey]
    let stateCode: string | null = null
    if (typeof isoRaw === "string" && isoRaw.toUpperCase().startsWith("US-")) {
      stateCode = isoRaw.slice(3, 5).toUpperCase()
    }
    return { countryCode, stateCode }
  } catch {
    return null
  }
}

/**
 * Forward geocode city + state (US). Caller should throttle before if chaining multiple Nominatim calls.
 */
/** Max length for freeform forward-geocode queries (URLs + abuse). */
const FORWARD_QUERY_MAX_LEN = 400

/**
 * Single forward geocode (US-only via countrycodes=us). Throttles internally.
 * Drops hits outside supported US bbox (aligned with lane_origins validation).
 */
export async function forwardGeocodeUsFreeform(query: string): Promise<{ lat: number; lon: number } | null> {
  const q = query.trim()
  if (!q || q.length > FORWARD_QUERY_MAX_LEN) return null
  try {
    await nominatimThrottle()
    const enc = encodeURIComponent(q)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${enc}&limit=1&countrycodes=us`,
      {
        headers: { "User-Agent": NOMINATIM_USER_AGENT },
        signal: AbortSignal.timeout(8000),
      }
    )
    if (!res.ok) return null
    const results = (await res.json()) as { lat?: string; lon?: string }[]
    if (!results?.length || !results[0].lat || !results[0].lon) return null
    const lat = parseFloat(results[0].lat)
    const lon = parseFloat(results[0].lon)
    if (!isLikelyUsLocation(lat, lon)) return null
    return { lat, lon }
  } catch {
    return null
  }
}

/**
 * Same fallback chain as legacy client geocoding: full string, then city/state/zip, then city/state.
 */
export async function geocodeUsAddressWithFallbacks(address: string): Promise<{ lat: number; lon: number } | null> {
  const trimmed = address.trim()
  if (!trimmed) return null

  let coords = await forwardGeocodeUsFreeform(trimmed)
  if (coords) return coords

  const parts = trimmed.split(",").map((p) => p.trim())
  if (parts.length >= 3) {
    const cityStateZip = parts.slice(1).join(", ")
    coords = await forwardGeocodeUsFreeform(cityStateZip)
    if (coords) return coords
  }
  if (parts.length >= 4) {
    const cityState = parts.slice(1, 3).join(", ")
    coords = await forwardGeocodeUsFreeform(cityState)
    if (coords) return coords
  }
  return null
}

export async function geocodeCityState(city: string, state: string): Promise<{ lat: number; lon: number } | null> {
  const c = city?.trim()
  const s = state?.trim()
  if (!c || !s) return null
  return forwardGeocodeUsFreeform(`${c}, ${s}, USA`)
}

export type VerifyCoordsFailure = {
  ok: false
  code: "COORDS_OUTSIDE_US_BOUNDS" | "STATE_COORD_MISMATCH" | "REVERSE_GEOCODE_COUNTRY_MISMATCH"
  message: string
}

export type VerifyCoordsSuccess = { ok: true }

/**
 * US bbox check; optional reverse-geocode vs expected 2-letter state when `expectedStateRaw` normalizes.
 * If reverse geocode fails, verification is skipped (soft fail) per product doc.
 */
export async function verifyCoordsForOrigin(
  lat: number,
  lng: number,
  expectedStateRaw: string | null | undefined
): Promise<VerifyCoordsSuccess | VerifyCoordsFailure> {
  if (!isLikelyUsLocation(lat, lng)) {
    return {
      ok: false,
      code: "COORDS_OUTSIDE_US_BOUNDS",
      message: "Coordinates are outside supported US regions (continental, Alaska, Hawaii).",
    }
  }
  const expected = normalizeUsStateAbbrev(expectedStateRaw)
  if (!expected) {
    return { ok: true }
  }
  await nominatimThrottle()
  const rev = await reverseGeocodeUsMeta(lat, lng)
  if (!rev) {
    return { ok: true }
  }
  if (rev.countryCode && rev.countryCode !== "us") {
    return {
      ok: false,
      code: "REVERSE_GEOCODE_COUNTRY_MISMATCH",
      message: "Reverse geocode indicates a non-US location.",
    }
  }
  if (rev.stateCode && rev.stateCode !== expected) {
    return {
      ok: false,
      code: "STATE_COORD_MISMATCH",
      message: `Expected state ${expected}, reverse geocode suggests ${rev.stateCode}.`,
    }
  }
  return { ok: true }
}

export type BulkGeocodeRowStatus =
  | "success"
  | "skipped_no_city_state"
  | "geocode_failed"
  | "rejected_out_of_bounds"
  | "rejected_state_mismatch"
  | "rejected_not_us_country"
  | "dry_run_would_update"
  | "db_error"

export type BulkGeocodeRowResult = {
  id: string
  name: string
  status: BulkGeocodeRowStatus
  detail?: string
}
