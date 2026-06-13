export type WaitTimerPhase = "idle" | "free" | "billable" | "stopped"

export type WaitTimerSnapshot = {
  phase: WaitTimerPhase
  elapsedMs: number
  elapsedMinutes: number
  freeMinutesRemaining: number
  billableMinutes: number
  exceededThreshold: boolean
}

export const DEFAULT_FREE_WAIT_MINUTES = 60

export function computeWaitTimerSnapshot(
  startTimeIso: string | null,
  stoppedAtIso: string | null,
  nowMs: number = Date.now(),
  freeMinutes: number = DEFAULT_FREE_WAIT_MINUTES,
): WaitTimerSnapshot {
  if (!startTimeIso) {
    return {
      phase: "idle",
      elapsedMs: 0,
      elapsedMinutes: 0,
      freeMinutesRemaining: freeMinutes,
      billableMinutes: 0,
      exceededThreshold: false,
    }
  }

  const startMs = new Date(startTimeIso).getTime()
  const endMs = stoppedAtIso ? new Date(stoppedAtIso).getTime() : nowMs
  const elapsedMs = Math.max(0, endMs - startMs)
  const elapsedMinutes = Math.floor(elapsedMs / 60_000)
  const freeMs = freeMinutes * 60_000
  const exceededThreshold = elapsedMs > freeMs
  const billableMinutes = exceededThreshold
    ? Math.ceil((elapsedMs - freeMs) / 60_000)
    : 0
  const freeMinutesRemaining = exceededThreshold
    ? 0
    : Math.max(0, Math.ceil((freeMs - elapsedMs) / 60_000))

  let phase: WaitTimerPhase = "free"
  if (stoppedAtIso) {
    phase = "stopped"
  } else if (exceededThreshold) {
    phase = "billable"
  }

  return {
    phase,
    elapsedMs,
    elapsedMinutes,
    freeMinutesRemaining,
    billableMinutes,
    exceededThreshold,
  }
}

export function formatWaitElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}
