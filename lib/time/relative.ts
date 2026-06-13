export function hoursSince(iso: string, nowMs: number): number {
  return (nowMs - new Date(iso).getTime()) / (1000 * 60 * 60)
}

export function daysUntil(iso: string, nowMs: number): number {
  return Math.ceil((new Date(iso).getTime() - nowMs) / (1000 * 60 * 60 * 24))
}

export function formatStalePortWarning(phSyncedAt: string, nowMs: number | null): string {
  if (nowMs === null) {
    return "Port data: stale"
  }
  return `Port data: stale (${Math.round(hoursSince(phSyncedAt, nowMs))}h ago)`
}

export function formatSyncedAgo(phSyncedAt: string, nowMs: number | null): string {
  if (nowMs === null) {
    return ""
  }
  return `${Math.round((hoursSince(phSyncedAt, nowMs) * 10)) / 10}h ago`
}
