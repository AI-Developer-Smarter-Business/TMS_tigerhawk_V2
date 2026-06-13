"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LoadStatus } from "@/types/dispatcher"
import {
  computeWaitTimerSnapshot,
  formatWaitElapsed,
  type WaitTimerSnapshot,
} from "@/lib/wait-time/timer-math"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"
import { emitWaitTimeExceededEvent } from "@/hooks/useWaitTimeAlerts"

const DELIVERY_WAIT_START: LoadStatus = "Arrived At Delivery"
const WAIT_TIMER_POLL_MS = 5000
const WAIT_TIMER_REALTIME_TABLES = ["waiting_time_events", "loads"] as const
const STOP_STATUSES = new Set<LoadStatus>([
  "Delivered",
  "Dropped - Loaded",
  "Completed",
  "Cancelled",
  "In Transit",
])

type WaitEvent = {
  id: string
  event_name: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  free_time_minutes: number | null
  charge_amount: number | null
  billable: boolean | null
}

type DeliveryWaitTimerPanelProps = {
  loadId: string
  referenceNumber: string
  currentStatus: LoadStatus
  driverName: string | null
  deliveryLocation: string | null
  actualDeliveryIso?: string | null
  /** Phase A demo — local timer only (WT.4). */
  mockMode?: boolean
}

function findOpenDeliveryWait(events: WaitEvent[]): WaitEvent | null {
  return (
    events.find(
      (e) => e.event_name === "delivery_wait" && e.start_time && !e.end_time,
    ) ?? null
  )
}

export function DeliveryWaitTimerPanel({
  loadId,
  referenceNumber,
  currentStatus,
  driverName,
  deliveryLocation,
  actualDeliveryIso,
  mockMode = false,
}: DeliveryWaitTimerPanelProps) {
  const [startTimeIso, setStartTimeIso] = useState<string | null>(null)
  const [stoppedAtIso, setStoppedAtIso] = useState<string | null>(null)
  const [chargeAmount, setChargeAmount] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const exceededEmittedRef = useRef(false)
  const previousStatusRef = useRef<LoadStatus>(currentStatus)
  const ensureStartedRef = useRef(false)

  const applyFallbackStart = useCallback(() => {
    if (actualDeliveryIso && !stoppedAtIso) {
      setStartTimeIso(actualDeliveryIso)
    }
  }, [actualDeliveryIso, stoppedAtIso])

  const startViaApi = useCallback(async () => {
    if (mockMode) return
    setLoading(true)
    setApiError(null)
    try {
      const res = await fetch(`/api/dispatcher/loads/${loadId}/wait-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          event_name: "delivery_wait",
          start_time: actualDeliveryIso || new Date().toISOString(),
          location: deliveryLocation,
          free_time_minutes: 60,
          logged_by: "dispatcher",
        }),
      })
      const body = (await res.json()) as WaitEvent & { error?: string }
      if (res.ok && body.start_time) {
        setStartTimeIso(body.start_time)
        setStoppedAtIso(body.end_time)
        setChargeAmount(body.charge_amount)
        return
      }
      setApiError(body.error || "Could not start delivery wait timer")
      applyFallbackStart()
    } catch {
      setApiError("Could not start delivery wait timer")
      applyFallbackStart()
    } finally {
      setLoading(false)
    }
  }, [loadId, mockMode, deliveryLocation, actualDeliveryIso, applyFallbackStart])

  const applyWaitEvent = useCallback((event: WaitEvent) => {
    setStartTimeIso(event.start_time)
    setStoppedAtIso(event.end_time)
    setChargeAmount(event.charge_amount)
    if (event.start_time && !event.end_time) {
      exceededEmittedRef.current = false
    }
  }, [])

  const hydrateFromApi = useCallback(
    async (options?: { silent?: boolean }): Promise<boolean> => {
      if (mockMode) return false
      if (!options?.silent) setLoading(true)
      try {
        const res = await fetch(`/api/dispatcher/loads/${loadId}/wait-time`, {
          cache: "no-store",
        })
        if (!res.ok) return false
        const data = (await res.json()) as { events: WaitEvent[] }
        const open = findOpenDeliveryWait(data.events)
        if (open?.start_time) {
          applyWaitEvent(open)
          return true
        }
        const last = data.events.find((e) => e.event_name === "delivery_wait")
        if (last?.start_time) {
          applyWaitEvent(last)
          return true
        }
        return false
      } catch {
        return false
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [loadId, mockMode, applyWaitEvent],
  )

  const refreshTimerFromApi = useCallback(() => {
    void hydrateFromApi({ silent: true })
  }, [hydrateFromApi])

  const realtimeFilters = useMemo(
    () => ({
      waiting_time_events: `load_id=eq.${loadId}`,
      loads: `id=eq.${loadId}`,
    }),
    [loadId],
  )

  useEffect(() => {
    ensureStartedRef.current = false
    void (async () => {
      const hasEvent = await hydrateFromApi()
      if (
        !mockMode &&
        currentStatus === DELIVERY_WAIT_START &&
        !hasEvent &&
        !ensureStartedRef.current
      ) {
        ensureStartedRef.current = true
        await startViaApi()
      } else if (currentStatus === DELIVERY_WAIT_START && !hasEvent) {
        applyFallbackStart()
      }
    })()
  }, [hydrateFromApi, startViaApi, currentStatus, mockMode, applyFallbackStart])

  useRealtimeRefresh({
    tables: [...WAIT_TIMER_REALTIME_TABLES],
    filters: realtimeFilters,
    onRefresh: refreshTimerFromApi,
    debounceMs: 400,
  })

  // Fallback when Supabase Realtime is not enabled for waiting_time_events yet
  useEffect(() => {
    if (mockMode) return
    const shouldPoll =
      currentStatus === DELIVERY_WAIT_START || Boolean(startTimeIso && !stoppedAtIso)
    if (!shouldPoll) return
    const id = setInterval(() => {
      void hydrateFromApi({ silent: true })
    }, WAIT_TIMER_POLL_MS)
    return () => clearInterval(id)
  }, [mockMode, currentStatus, startTimeIso, stoppedAtIso, hydrateFromApi])

  useEffect(() => {
    const prev = previousStatusRef.current
    if (currentStatus === DELIVERY_WAIT_START && prev !== DELIVERY_WAIT_START) {
      if (mockMode) {
        setStartTimeIso(new Date().toISOString())
        setStoppedAtIso(null)
        exceededEmittedRef.current = false
      } else {
        ensureStartedRef.current = true
        void startViaApi()
      }
    }
    if (STOP_STATUSES.has(currentStatus) && startTimeIso && !stoppedAtIso) {
      if (mockMode) {
        setStoppedAtIso(new Date().toISOString())
      }
    }
    previousStatusRef.current = currentStatus
  }, [currentStatus, mockMode, startTimeIso, stoppedAtIso, startViaApi])

  const effectiveStartIso = startTimeIso ?? actualDeliveryIso ?? null

  useEffect(() => {
    if (!effectiveStartIso || stoppedAtIso) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [effectiveStartIso, stoppedAtIso])

  const snapshot: WaitTimerSnapshot = computeWaitTimerSnapshot(
    effectiveStartIso,
    stoppedAtIso,
    Date.now(),
  )
  void tick
  const active =
    currentStatus === DELIVERY_WAIT_START || Boolean(effectiveStartIso && !stoppedAtIso)

  useEffect(() => {
    if (!snapshot.exceededThreshold || exceededEmittedRef.current) return
    exceededEmittedRef.current = true
    emitWaitTimeExceededEvent({
      loadId,
      referenceNumber,
      driverName,
      billableMinutes: snapshot.billableMinutes,
    })
  }, [snapshot.exceededThreshold, snapshot.billableMinutes, loadId, referenceNumber, driverName])

  if (!active && snapshot.phase === "idle") {
    return null
  }

  const phaseLabel =
    snapshot.phase === "billable"
      ? "Billable wait"
      : snapshot.phase === "free"
        ? "Free waiting time"
        : snapshot.phase === "stopped"
          ? "Stopped"
          : active && !effectiveStartIso
            ? "Starting…"
            : "Not started"

  const phaseClass =
    snapshot.phase === "billable"
      ? "text-red-400 border-red-500/30"
      : snapshot.phase === "free"
        ? "text-[#FF8C21] border-[#E8700A]/30"
        : "text-gray-400 border-white/10"

  return (
    <div className="bg-[#E8700A]/10 border border-[#E8700A]/25 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-[#FF8C21] uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#E8700A] animate-pulse inline-block" />
          Delivery wait time
        </h4>
        {active && !stoppedAtIso ? (
          <span className="text-[10px] font-bold uppercase text-[#FF8C21] bg-[#E8700A]/20 px-2 py-0.5 rounded">
            Waiting at delivery
          </span>
        ) : null}
      </div>

      {loading ? <p className="text-xs text-gray-500">Loading timer…</p> : null}
      {apiError ? <p className="text-xs text-red-400 mt-1">{apiError}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl font-bold text-white tabular-nums">
          {formatWaitElapsed(snapshot.elapsedMs)}
        </span>
        <span
          className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${phaseClass}`}
        >
          {phaseLabel}
        </span>
      </div>

      {snapshot.phase === "free" ? (
        <p className="text-xs text-gray-400 mt-1.5">
          {snapshot.freeMinutesRemaining} min free time remaining
        </p>
      ) : null}

      {snapshot.phase === "billable" ? (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
          Billable: {snapshot.billableMinutes} min
          {chargeAmount != null && chargeAmount > 0 ? ` · $${chargeAmount.toFixed(2)} charge` : ""}
          {" · "}
          <a
            href="/dashboard/accounts-receivable/waiting-time-audit"
            className="text-[#FF8C21] hover:underline"
          >
            Waiting Time Audit →
          </a>
        </div>
      ) : null}

      {deliveryLocation ? (
        <p className="text-[10px] text-gray-500 mt-2 truncate">{deliveryLocation}</p>
      ) : null}

      {mockMode ? (
        <p className="text-[10px] text-gray-500 mt-2 italic">
          Demo mode — timer stored locally (Phase A).
        </p>
      ) : null}
    </div>
  )
}
