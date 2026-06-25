import { DETENTION_EMAIL_TIMEZONE } from "@/lib/wait-time/constants"

/** Resolve elapsed wait minutes from stored duration and/or start/end timestamps. */
export function resolveWaitEventDurationMinutes(
  event: {
    duration_minutes?: number | null
    start_time?: string | null
    end_time?: string | null
  },
  nowMs: number = Date.now(),
): number {
  if (event.start_time && event.end_time) {
    return Math.max(
      0,
      Math.round(
        (new Date(event.end_time).getTime() - new Date(event.start_time).getTime()) /
          60_000,
      ),
    )
  }

  if (event.start_time && !event.end_time) {
    const fromClock = Math.max(
      0,
      Math.round((nowMs - new Date(event.start_time).getTime()) / 60_000),
    )
    const stored = Math.max(0, Number(event.duration_minutes) || 0)
    return Math.max(stored, fromClock)
  }

  return Math.max(0, Number(event.duration_minutes) || 0)
}

export function formatWaitEmailTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DETENTION_EMAIL_TIMEZONE,
    timeZoneName: "short",
  })
}
