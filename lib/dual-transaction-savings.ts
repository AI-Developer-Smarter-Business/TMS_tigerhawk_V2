/**
 * Dual-transaction empty-mile savings (estimated).
 * Baseline empty legs: delivery → return (import empty) + return → pickup (export reposition).
 * Dual: delivery → return only; pickup at return yard avoids the reposition leg.
 * savedMiles = max(0, dist(return, pickup)).
 */
import { haversineMiles } from "@/lib/geo/haversine"

/** Default $/mi for avoided empty repositioning (ops-tunable; legacy ~$150/trip ≈ 75 mi @ $2). */
export const DUAL_EMPTY_SAVED_COST_PER_MILE_USD = 2

export function normalizeLocationKey(raw: string): string {
  return raw.trim().toLowerCase()
}

export type LatLng = { lat: number; lng: number }

/** Map keyed by normalizeLocationKey(address string). */
export type LocationCoordMap = Record<string, LatLng | null | undefined>

export function getContainerSizeCategory(size: string, type: string): string {
  const s = size || ""
  const t = type || ""
  if (s.includes("20")) return "20"
  if (s.includes("40")) {
    if (t.includes("HC") || t.includes("High")) return "40hc"
    return "40st"
  }
  if (s.includes("45")) return "45"
  return "special"
}

export type DualPairLoadSlice = {
  id: string
  ssl: string | null
  container_size: string | null
  container_type: string | null
  containers?: { shipping_line: string | null; size: string | null; type: string | null } | null
  delivery_location: string | null
  return_location: string | null
  pickup_location: string | null
}

export function dualPairCompatible(returnLoad: DualPairLoadSlice, pickupLoad: DualPairLoadSlice): boolean {
  const sslR = returnLoad.ssl || returnLoad.containers?.shipping_line || ""
  const sslP = pickupLoad.ssl || pickupLoad.containers?.shipping_line || ""
  const sizeR = returnLoad.container_size || returnLoad.containers?.size || ""
  const sizeP = pickupLoad.container_size || pickupLoad.containers?.size || ""
  const typeR = returnLoad.container_type || returnLoad.containers?.type || ""
  const typeP = pickupLoad.container_type || pickupLoad.containers?.type || ""
  return (
    returnLoad.return_location === pickupLoad.pickup_location &&
    sslR === sslP &&
    getContainerSizeCategory(sizeR, typeR) === getContainerSizeCategory(sizeP, typeP)
  )
}

export function pairEmptyMilesSaved(
  importReturnLoad: DualPairLoadSlice,
  exportPickupLoad: DualPairLoadSlice,
  coordMap: LocationCoordMap
): { savedMiles: number; savingsUsd: number } {
  const del = importReturnLoad.delivery_location
  const ret = importReturnLoad.return_location
  const pik = exportPickupLoad.pickup_location
  if (!del?.trim() || !ret?.trim() || !pik?.trim()) {
    return { savedMiles: 0, savingsUsd: 0 }
  }
  const cDel = coordMap[normalizeLocationKey(del)]
  const cRet = coordMap[normalizeLocationKey(ret)]
  const cPik = coordMap[normalizeLocationKey(pik)]
  if (!cDel || !cRet || !cPik) {
    return { savedMiles: 0, savingsUsd: 0 }
  }
  const repositionMi = haversineMiles(cRet.lat, cRet.lng, cPik.lat, cPik.lng)
  const savedMiles = Math.max(0, Math.round(repositionMi * 100) / 100)
  const savingsUsd =
    Math.round(savedMiles * DUAL_EMPTY_SAVED_COST_PER_MILE_USD * 100) / 100
  return { savedMiles, savingsUsd }
}

export function sumPairSavingsUsd(
  pairs: { returnLoad: DualPairLoadSlice; pickupLoad: DualPairLoadSlice }[],
  coordMap: LocationCoordMap
): { totalUsd: number; totalSavedMiles: number } {
  let totalUsd = 0
  let totalSavedMiles = 0
  for (const { returnLoad, pickupLoad } of pairs) {
    const { savedMiles, savingsUsd } = pairEmptyMilesSaved(returnLoad, pickupLoad, coordMap)
    totalUsd += savingsUsd
    totalSavedMiles += savedMiles
  }
  return {
    totalUsd: Math.round(totalUsd * 100) / 100,
    totalSavedMiles: Math.round(totalSavedMiles * 100) / 100,
  }
}

/** Upper-bound style: each return gets its best compatible pickup (no assignment constraint). */
export function potentialSavingsUsdGreedy(
  returns: DualPairLoadSlice[],
  pickups: DualPairLoadSlice[],
  coordMap: LocationCoordMap
): { totalUsd: number } {
  let sum = 0
  for (const r of returns) {
    let best = 0
    for (const p of pickups) {
      if (dualPairCompatible(r, p)) {
        best = Math.max(best, pairEmptyMilesSaved(r, p, coordMap).savingsUsd)
      }
    }
    sum += best
  }
  return { totalUsd: Math.round(sum * 100) / 100 }
}
