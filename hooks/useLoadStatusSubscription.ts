// hooks/useLoadStatusSubscription.ts
"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

export type StatusChangeToast = {
  id: string
  loadId: string
  referenceNumber: string
  driverName: string | null
  oldStatus: string
  newStatus: string
  timestamp: Date
  /** Absolute ms time when this toast should auto-dismiss */
  expiresAt: number
}

const TOAST_DURATION_MS = 10_000 // 10 seconds
const MAX_VISIBLE = 8

/**
 * Dispatch a custom event to trigger a toast notification from the same tab.
 * This is used as a reliable fallback since Supabase Realtime `postgres_changes`
 * requires replica identity FULL on the table to include old record data,
 * and may not be enabled in all deployments.
 */
export function emitStatusChangeEvent(detail: {
  loadId: string
  referenceNumber: string
  driverName: string | null
  oldStatus: string
  newStatus: string
}) {
  window.dispatchEvent(new CustomEvent("loadStatusChanged", { detail }))
}

export function useLoadStatusSubscription() {
  const [toasts, setToasts] = useState<StatusChangeToast[]>([])
  const [enabled, setEnabled] = useState(true)
  const enabledRef = useRef(true)
  const toastIdCounter = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Track recently shown toasts to deduplicate between Realtime and custom events
  const recentToastKeys = useRef(new Set<string>())

  // Keep ref in sync with state
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  // Load preference from localStorage and listen for toggle events from StatusToastToggle
  useEffect(() => {
    try {
      const stored = localStorage.getItem("statusToastsEnabled")
      if (stored !== null) setEnabled(stored === "true")
    } catch { /* ignore */ }

    // Listen for same-tab toggle events from StatusToastToggle component
    const handleToggle = (e: Event) => {
      const val = (e as CustomEvent).detail as boolean
      setEnabled(val)
      if (!val) setToasts([])
    }
    window.addEventListener("statusToastsToggled", handleToggle)
    return () => window.removeEventListener("statusToastsToggled", handleToggle)
  }, [])

  const toggleEnabled = useCallback((val: boolean) => {
    setEnabled(val)
    try { localStorage.setItem("statusToastsEnabled", String(val)) } catch { /* ignore */ }
    if (!val) setToasts([]) // Clear toasts when disabling
  }, [])

  // Helper to add a toast (shared between Realtime and custom event handlers)
  const addToast = useCallback((detail: {
    loadId: string
    referenceNumber: string
    driverName: string | null
    oldStatus: string
    newStatus: string
  }) => {
    if (!enabledRef.current) return

    // Deduplicate: use loadId + oldStatus + newStatus as a key
    const dedupeKey = `${detail.loadId}:${detail.oldStatus}:${detail.newStatus}`
    if (recentToastKeys.current.has(dedupeKey)) return
    recentToastKeys.current.add(dedupeKey)
    // Clear dedup key after toast duration + buffer
    setTimeout(() => recentToastKeys.current.delete(dedupeKey), TOAST_DURATION_MS + 2000)

    const toast: StatusChangeToast = {
      id: `toast-${++toastIdCounter.current}-${Date.now()}`,
      loadId: detail.loadId,
      referenceNumber: detail.referenceNumber || "Unknown",
      driverName: detail.driverName,
      oldStatus: detail.oldStatus,
      newStatus: detail.newStatus,
      timestamp: new Date(),
      expiresAt: Date.now() + TOAST_DURATION_MS,
    }

    setToasts(prev => {
      const updated = [toast, ...prev]
      return updated.slice(0, MAX_VISIBLE * 2)
    })
  }, [])

  // Tick to check for expired toasts
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now()
      setToasts(prev => prev.filter(t => t.expiresAt > now))
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Listen for custom events (reliable same-tab fallback)
  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && detail.oldStatus && detail.newStatus && detail.oldStatus !== detail.newStatus) {
        addToast(detail)
      }
    }
    window.addEventListener("loadStatusChanged", handleCustomEvent)
    return () => window.removeEventListener("loadStatusChanged", handleCustomEvent)
  }, [addToast])

  // Subscribe to loads table changes via Supabase Realtime
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("load-status-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loads",
        },
        async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Skip if notifications are disabled
          if (!enabledRef.current) return

          const newRecord = payload.new as Record<string, unknown>
          const oldRecord = payload.old as Record<string, unknown>

          // Only fire if status actually changed
          // Note: oldRecord.status may be undefined if replica identity is not FULL,
          // in which case only the primary key is included in `old`.
          // We still fire a toast if we can detect the change.
          if (!newRecord || !newRecord.status) return

          // If old record has status info, check if it actually changed
          if (oldRecord?.status && oldRecord.status === newRecord.status) return

          // If old record doesn't have status (replica identity DEFAULT), we still
          // show the toast since we know an UPDATE happened and we have new status
          const oldStatus = (oldRecord?.status as string) || "Unknown"
          const newStatus = newRecord.status as string

          // Fetch driver name if driver_id exists
          let driverName: string | null = null
          const driverId = newRecord.driver_id as string | null
          if (driverId) {
            try {
              const { data: driver } = await supabase
                .from("drivers")
                .select("name")
                .eq("id", driverId)
                .single()
              driverName = driver?.name || null
            } catch { /* ignore */ }
          }

          addToast({
            loadId: newRecord.id as string,
            referenceNumber: (newRecord.reference_number as string) || "Unknown",
            driverName,
            oldStatus,
            newStatus,
          })
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[StatusToasts] Realtime channel error — toasts will use fallback events only")
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [addToast])

  const dismissToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(t => t.id !== toastId))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  // Only return up to MAX_VISIBLE
  const visibleToasts = toasts.slice(0, MAX_VISIBLE)
  const hasMore = toasts.length > MAX_VISIBLE

  return {
    toasts: visibleToasts,
    hasMore,
    totalCount: toasts.length,
    dismissToast,
    dismissAll,
    enabled,
    toggleEnabled,
  }
}
