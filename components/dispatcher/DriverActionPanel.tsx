// components/dispatcher/DriverActionPanel.tsx
// Simulated driver action panel — shows valid next statuses as clickable buttons
// Used for testing flow-through load status lifecycle without a mobile driver app
"use client"

import { useState, useEffect, useCallback } from "react"
import { LoadStatus, VALID_LOAD_TRANSITIONS, LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { emitStatusChangeEvent } from "@/hooks/useLoadStatusSubscription"
import { useUserRole } from "@/lib/auth/useUserRole"

type DriverActionPanelProps = {
  loadId: string
  referenceNumber: string
  currentStatus: LoadStatus
  driverName: string | null
  onStatusChanged: () => void
  /** Hold field keys currently active (`hold` or carrier true); blocks transitions for non-admins (API enforces too). */
  activeHolds?: string[]
}

// Categorize statuses for visual grouping
const DRIVER_STATUSES = new Set<LoadStatus>([
  "Arrived At Pickup",
  "In Transit",
  "Arrived At Delivery",
  "Delivered",
  "At Warehouse",
  "Arrived To Hook Container",
  "Enroute To Drop Container",
  "Dropped - Loaded",
  "Dropped - Empty",
  "Enroute To Return Empty",
  "Arrived At Return Empty",
])

const FINAL_STATUSES = new Set<LoadStatus>(["Completed", "Cancelled"])

type TransitionMap = Record<string, string[]>

export function DriverActionPanel({
  loadId,
  referenceNumber,
  currentStatus,
  driverName,
  onStatusChanged,
  activeHolds = [],
}: DriverActionPanelProps) {
  const { role, loading: roleLoading } = useUserRole()
  const blockedByHolds =
    activeHolds.length > 0 && !roleLoading && role !== "admin"

  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastChange, setLastChange] = useState<{ from: string; to: string } | null>(null)
  const [transitionMap, setTransitionMap] = useState<TransitionMap | null>(null)

  // Fetch effective transitions (DB overrides or defaults)
  const loadTransitions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/transitions")
      if (res.ok) {
        const data = await res.json()
        setTransitionMap(data.transitions)
      } else {
        // Fallback to hardcoded if API fails (e.g. table doesn't exist yet)
        setTransitionMap(VALID_LOAD_TRANSITIONS as TransitionMap)
      }
    } catch {
      // Fallback to hardcoded
      setTransitionMap(VALID_LOAD_TRANSITIONS as TransitionMap)
    }
  }, [])

  useEffect(() => {
    loadTransitions()
  }, [loadTransitions])

  // While loading transitions, use hardcoded as temporary fallback
  const effectiveMap = transitionMap || (VALID_LOAD_TRANSITIONS as TransitionMap)
  const validNext = (effectiveMap[currentStatus] || []) as LoadStatus[]

  // Nothing to show for terminal statuses
  if (validNext.length === 0) {
    return null
  }

  // Split into driver actions, dispatcher actions, and terminal
  const driverActions = validNext.filter((s) => DRIVER_STATUSES.has(s))
  const finalActions = validNext.filter((s) => FINAL_STATUSES.has(s))
  const dispatcherActions = validNext.filter(
    (s) => !DRIVER_STATUSES.has(s) && !FINAL_STATUSES.has(s)
  )

  const handleTransition = async (newStatus: LoadStatus) => {
    setUpdating(newStatus)
    setError(null)
    setLastChange(null)
    try {
      const res = await fetch(`/api/dispatcher/loads/${loadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          data.code === "ACTIVE_HOLDS" && Array.isArray(data.activeHolds)
            ? `${data.error || "Hold active"} (${data.activeHolds.join(", ")})`
            : data.error || "Failed to update status"
        setError(msg)
        return
      }
      setLastChange({ from: currentStatus, to: newStatus })
      // Emit custom event for toast notifications (reliable same-tab fallback)
      emitStatusChangeEvent({
        loadId,
        referenceNumber,
        driverName,
        oldStatus: currentStatus,
        newStatus,
      })
      onStatusChanged()
    } catch {
      setError("Network error")
    } finally {
      setUpdating(null)
    }
  }

  const statusButton = (status: LoadStatus, variant: "driver" | "dispatcher" | "final") => {
    const colors = LOAD_STATUS_COLORS[status]
    const isUpdating = updating === status
    const baseClasses =
      "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border"
    const variantClasses =
      variant === "final"
        ? status === "Cancelled"
          ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          : "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
        : variant === "driver"
          ? `${colors?.bg || "bg-blue-500/10"} ${colors?.border || "border-blue-500/20"} ${colors?.text || "text-blue-400"} hover:brightness-125`
          : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"

    return (
      <button
        key={status}
        onClick={() => handleTransition(status)}
        disabled={isUpdating || !!updating || blockedByHolds}
        title={
          blockedByHolds
            ? "Release active holds before changing status (admin users may still change status)."
            : undefined
        }
        className={`${baseClasses} ${variantClasses} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <div className="flex items-center justify-between">
          <span>{isUpdating ? "Updating..." : status}</span>
          <svg
            className="w-3.5 h-3.5 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </button>
    )
  }

  return (
    <div className="border-t border-white/5 pt-4">
      <h4 className="text-xs font-semibold text-[#E8700A] uppercase tracking-wider mb-1">
        Status Actions
      </h4>
      {driverName && (
        <p className="text-[10px] text-gray-500 mb-3">
          Driver: <span className="text-gray-400">{driverName}</span>
        </p>
      )}

      {error && (
        <div className="mb-2 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
          {error}
        </div>
      )}

      {lastChange && (
        <div className="mb-2 px-2 py-1.5 bg-green-500/10 border border-green-500/20 rounded text-[10px] text-green-400">
          {lastChange.from} → {lastChange.to}
        </div>
      )}

      <div className="space-y-1.5">
        {/* Driver field actions (in-transit, arrived, etc.) */}
        {driverActions.length > 0 && (
          <>
            {driverActions.length > 0 && dispatcherActions.length > 0 && (
              <p className="text-[9px] text-gray-600 uppercase tracking-wider pt-1">Driver</p>
            )}
            {driverActions.map((s) => statusButton(s, "driver"))}
          </>
        )}

        {/* Dispatcher actions (assign, dispatch, etc.) */}
        {dispatcherActions.length > 0 && (
          <>
            {driverActions.length > 0 && (
              <p className="text-[9px] text-gray-600 uppercase tracking-wider pt-2">Dispatcher</p>
            )}
            {dispatcherActions.map((s) => statusButton(s, "dispatcher"))}
          </>
        )}

        {/* Final statuses */}
        {finalActions.length > 0 && (
          <>
            <div className="border-t border-white/5 my-1.5" />
            {finalActions.map((s) => statusButton(s, "final"))}
          </>
        )}
      </div>
    </div>
  )
}
