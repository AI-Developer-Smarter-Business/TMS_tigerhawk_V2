"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface ContainerResult {
  container_number: string
  status: "ok" | "skip" | "fail" | "not_found"
  message?: string
}

interface RotateProgress {
  state: "running" | "done" | "error" | "idle"
  started_at?: string
  current_container?: string
  results: ContainerResult[]
  checked: number
  updated: number
  skipped: number
  errors: number
}

const ROTATE_INTERVAL_MS = 15 * 60_000 // 15 minutes
const POLL_INTERVAL_MS = 2000
const DONE_DISPLAY_MS = 15000

interface RotationStatusProps {
  onComplete?: () => void
}

export function RotationStatus({ onComplete }: RotationStatusProps) {
  const [progress, setProgress] = useState<RotateProgress | null>(null)
  const [visible, setVisible] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const busyRef = useRef(false)
  const runIdRef = useRef<string | null>(null)
  // Stable ref for onComplete so it never causes triggerRotation to be recreated
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current)
    hideRef.current = setTimeout(() => setVisible(false), DONE_DISPLAY_MS)
  }, [])

  const fetchStatus = useCallback(async (): Promise<RotateProgress | null> => {
    try {
      const res = await fetch("/api/port-houston/rotate/status")
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const triggerRotation = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true

    if (hideRef.current) clearTimeout(hideRef.current)
    runIdRef.current = null

    setProgress({ state: "running", results: [], checked: 0, updated: 0, skipped: 0, errors: 0 })
    setVisible(true)

    stopPolling()
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus()
      if (!data || data.state === "idle") return

      if (runIdRef.current && data.started_at !== runIdRef.current) return
      if (!runIdRef.current && data.state === "running" && data.started_at) {
        runIdRef.current = data.started_at
      }

      setProgress(data)

      if (data.state === "done" || data.state === "error") {
        stopPolling()
        scheduleHide()
      }
    }, POLL_INTERVAL_MS)

    try {
      const res = await fetch("/api/port-houston/rotate", { method: "POST" })
      const body = await res.json().catch(() => ({}))
      console.log("[RotationStatus] Rotate response:", res.status, body)
      if (!res.ok) {
        console.error("[RotationStatus] Rotate failed:", res.status, body)
      }
    } catch (err) {
      console.error("[RotationStatus] Rotate network error:", err)
    }

    const final = await fetchStatus()
    console.log("[RotationStatus] Final status:", final)
    if (final && final.state !== "idle") {
      setProgress(final)
    }

    stopPolling()
    busyRef.current = false
    scheduleHide()

    if (final && final.updated > 0 && onCompleteRef.current) {
      onCompleteRef.current()
    }
  }, [fetchStatus, stopPolling, scheduleHide])

  useEffect(() => {
    triggerRotation()
    rotateRef.current = setInterval(triggerRotation, ROTATE_INTERVAL_MS)
    return () => {
      if (rotateRef.current) clearInterval(rotateRef.current)
      stopPolling()
      if (hideRef.current) clearTimeout(hideRef.current)
    }
  }, [triggerRotation, stopPolling])

  if (!progress || !visible) return null

  const isRunning = progress.state === "running"
  const results = progress.results || []
  const okCount = results.filter(r => r.status === "ok").length
  const failCount = results.filter(r => r.status === "fail").length
  const skipCount = results.filter(r => r.status === "skip" || r.status === "not_found").length

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono bg-gray-900/60 border border-gray-800 rounded px-2 py-1">
      {/* Spinner while running */}
      {isRunning && (
        <svg className="w-3 h-3 animate-spin text-[#E8700A] flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}

      {/* Current container name while running */}
      {isRunning && progress.current_container && (
        <span className="text-gray-500">{progress.current_container}</span>
      )}
      {isRunning && !progress.current_container && results.length === 0 && (
        <span className="text-gray-500">Syncing...</span>
      )}

      {/* Totals */}
      {progress.checked > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{progress.checked}</span>
          {okCount > 0 && <span className="text-emerald-400">{okCount} ✓</span>}
          {failCount > 0 && <span className="text-red-400">{failCount} ✗</span>}
          {skipCount > 0 && <span className="text-amber-400">{skipCount} —</span>}
        </div>
      )}
    </div>
  )
}
