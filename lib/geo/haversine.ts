/** Great-circle distance in statute miles (WGS84 sphere). */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) return 0
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
