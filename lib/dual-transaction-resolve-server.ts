import { forwardGeocodeUsFreeform } from "@/lib/geocoding/lane-origin-nominatim"
import { normalizeLocationKey, type LocationCoordMap } from "@/lib/dual-transaction-savings"

const DEFAULT_MAX = 48

export async function buildLocationCoordMap(
  addresses: string[],
  maxUnique = DEFAULT_MAX
): Promise<LocationCoordMap> {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const s of addresses) {
    const t = typeof s === "string" ? s.trim() : ""
    if (!t) continue
    const k = normalizeLocationKey(t)
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(t)
    if (unique.length >= maxUnique) break
  }

  const coords: LocationCoordMap = {}
  for (const addr of unique) {
    const key = normalizeLocationKey(addr)
    const pt = await forwardGeocodeUsFreeform(addr)
    coords[key] = pt ? { lat: pt.lat, lng: pt.lon } : null
  }
  return coords
}

export function collectLocationStringsFromLoads(
  rows: Array<{
    delivery_location?: string | null
    return_location?: string | null
    pickup_location?: string | null
  }>
): string[] {
  const out: string[] = []
  for (const r of rows) {
    if (r.delivery_location?.trim()) out.push(r.delivery_location.trim())
    if (r.return_location?.trim()) out.push(r.return_location.trim())
    if (r.pickup_location?.trim()) out.push(r.pickup_location.trim())
  }
  return out
}
