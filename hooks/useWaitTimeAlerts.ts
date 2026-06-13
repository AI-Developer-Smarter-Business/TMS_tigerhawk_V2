"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type WaitTimeExceededToast = {
  id: string
  loadId: string
  referenceNumber: string
  driverName: string | null
  billableMinutes: number
  timestamp: Date
  expiresAt: number
}

const TOAST_DURATION_MS = 12_000
const MAX_VISIBLE = 6

export function emitWaitTimeExceededEvent(detail: {
  loadId: string
  referenceNumber: string
  driverName: string | null
  billableMinutes: number
}) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("waitTimeExceeded", { detail }))
}

export function useWaitTimeAlerts() {
  const [toasts, setToasts] = useState<WaitTimeExceededToast[]>([])
  const [enabled, setEnabled] = useState(true)
  const enabledRef = useRef(true)
  const toastIdCounter = useRef(0)
  const recentKeys = useRef(new Set<string>())

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    try {
      const stored = localStorage.getItem("statusToastsEnabled")
      if (stored !== null) setEnabled(stored === "true")
    } catch {
      /* ignore */
    }
    const handleToggle = (e: Event) => {
      const val = (e as CustomEvent).detail as boolean
      setEnabled(val)
      if (!val) setToasts([])
    }
    window.addEventListener("statusToastsToggled", handleToggle)
    return () => window.removeEventListener("statusToastsToggled", handleToggle)
  }, [])

  const addToast = useCallback(
    (detail: {
      loadId: string
      referenceNumber: string
      driverName: string | null
      billableMinutes: number
    }) => {
      if (!enabledRef.current) return
      const dedupeKey = `${detail.loadId}:wait-exceeded`
      if (recentKeys.current.has(dedupeKey)) return
      recentKeys.current.add(dedupeKey)
      setTimeout(() => recentKeys.current.delete(dedupeKey), TOAST_DURATION_MS + 5000)

      const toast: WaitTimeExceededToast = {
        id: `wait-toast-${++toastIdCounter.current}-${Date.now()}`,
        loadId: detail.loadId,
        referenceNumber: detail.referenceNumber || "Unknown",
        driverName: detail.driverName,
        billableMinutes: detail.billableMinutes,
        timestamp: new Date(),
        expiresAt: Date.now() + TOAST_DURATION_MS,
      }
      setToasts((prev) => [toast, ...prev].slice(0, MAX_VISIBLE * 2))
    },
    [],
  )

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.loadId && detail.billableMinutes > 0) {
        addToast(detail)
      }
    }
    window.addEventListener("waitTimeExceeded", handleEvent)
    return () => window.removeEventListener("waitTimeExceeded", handleEvent)
  }, [addToast])

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setToasts((prev) => prev.filter((t) => t.expiresAt > now))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId))
  }, [])

  const dismissAll = useCallback(() => setToasts([]), [])

  return {
    toasts: toasts.slice(0, MAX_VISIBLE),
    totalCount: toasts.length,
    dismissToast,
    dismissAll,
    enabled,
  }
}
