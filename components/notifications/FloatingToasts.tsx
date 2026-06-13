// components/notifications/FloatingToasts.tsx
// Status change toast notifications — slide down from top-right, 10s auto-dismiss
"use client"

import { useEffect, useState } from "react"
import { useLoadStatusSubscription, StatusChangeToast } from "@/hooks/useLoadStatusSubscription"
import { useWaitTimeAlerts, WaitTimeExceededToast } from "@/hooks/useWaitTimeAlerts"
import { LOAD_STATUS_COLORS, LoadStatus } from "@/types/dispatcher"

// ─── Individual toast card ───────────────────────────────────
function ToastCard({
  toast,
  onDismiss,
}: {
  toast: StatusChangeToast
  onDismiss: (id: string) => void
}) {
  const [progress, setProgress] = useState(100)
  const [isExiting, setIsExiting] = useState(false)
  const [isEntering, setIsEntering] = useState(true)

  // Slide-in animation
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsEntering(false))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Progress countdown
  useEffect(() => {
    const total = toast.expiresAt - toast.timestamp.getTime()
    const interval = setInterval(() => {
      const remaining = toast.expiresAt - Date.now()
      const pct = Math.max(0, (remaining / total) * 100)
      setProgress(pct)
      if (pct <= 0) {
        setIsExiting(true)
        clearInterval(interval)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [toast.expiresAt, toast.timestamp])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  const newStatusColor = LOAD_STATUS_COLORS[toast.newStatus as LoadStatus]
  const accentColor = newStatusColor?.text || "text-gray-400"
  const accentBorder = newStatusColor?.border || "border-gray-500/20"
  const accentBg = newStatusColor?.bg || "bg-gray-500/10"

  const timeStr = toast.timestamp.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })

  return (
    <div
      className={`relative w-80 bg-[#1A2332] border ${accentBorder} rounded-lg shadow-2xl shadow-black/60 overflow-hidden transition-all duration-300 ease-out ${
        isEntering
          ? "opacity-0 -translate-y-4"
          : isExiting
            ? "opacity-0 translate-x-12 scale-95"
            : "opacity-100 translate-y-0 translate-x-0 scale-100"
      }`}
    >
      {/* Content */}
      <div className="flex items-start gap-3 p-3">
        {/* Status icon */}
        <div className={`mt-0.5 flex-shrink-0 p-1.5 rounded-lg ${accentBg}`}>
          <svg className={`w-4 h-4 ${accentColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-white truncate">
              {toast.referenceNumber}
            </p>
            <span className="text-[10px] text-gray-600">{timeStr}</span>
          </div>
          {toast.driverName && (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">
              <svg className="w-3 h-3 inline-block mr-1 -mt-0.5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              {toast.driverName}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] text-gray-500">{toast.oldStatus}</span>
            <svg className="w-3 h-3 text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <span className={`text-[11px] font-semibold ${accentColor}`}>{toast.newStatus}</span>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-gray-600 hover:text-gray-300 transition-colors"
          title="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar — countdown from right to left */}
      <div className="h-[2px] bg-white/5">
        <div
          className={`h-full transition-all duration-100 ease-linear ${
            newStatusColor ? newStatusColor.bg.replace("/10", "/50") : "bg-gray-500/50"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ─── Wait time exceeded toast (WT.12) ────────────────────────
function WaitTimeToastCard({
  toast,
  onDismiss,
}: {
  toast: WaitTimeExceededToast
  onDismiss: (id: string) => void
}) {
  const [isExiting, setIsExiting] = useState(false)
  const [isEntering, setIsEntering] = useState(true)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsEntering(false))
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  return (
    <div
      className={`relative w-80 bg-[#1A2332] border border-red-500/30 rounded-lg shadow-2xl shadow-black/60 overflow-hidden transition-all duration-300 ease-out ${
        isEntering
          ? "opacity-0 -translate-y-4"
          : isExiting
            ? "opacity-0 translate-x-12 scale-95"
            : "opacity-100 translate-y-0 translate-x-0 scale-100"
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="mt-0.5 flex-shrink-0 p-1.5 rounded-lg bg-red-500/10">
          <span className="text-base">⏳</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{toast.referenceNumber}</p>
          {toast.driverName ? (
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{toast.driverName}</p>
          ) : null}
          <p className="text-[11px] text-red-400 font-semibold mt-1">
            Waiting time exceeded — {toast.billableMinutes} min billable
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 text-gray-600 hover:text-gray-300 transition-colors"
          title="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────
export function FloatingToasts() {
  const { toasts, totalCount, dismissToast, dismissAll, enabled } = useLoadStatusSubscription()
  const {
    toasts: waitToasts,
    totalCount: waitTotalCount,
    dismissToast: dismissWaitToast,
    dismissAll: dismissAllWait,
    enabled: waitEnabled,
  } = useWaitTimeAlerts()

  const showStatus = enabled && toasts.length > 0
  const showWait = waitEnabled && waitToasts.length > 0
  if (!showStatus && !showWait) return null

  const combinedTotal = (enabled ? totalCount : 0) + (waitEnabled ? waitTotalCount : 0)

  return (
    <div className="fixed top-14 right-4 z-50 flex flex-col gap-2">
      {waitEnabled &&
        waitToasts.map((toast) => (
          <WaitTimeToastCard key={toast.id} toast={toast} onDismiss={dismissWaitToast} />
        ))}
      {enabled &&
        toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}

      {combinedTotal >= 2 && (
        <button
          onClick={() => {
            dismissAll()
            dismissAllWait()
          }}
          className="self-end px-3 py-1.5 bg-[#1A2332] border border-white/10 rounded-lg text-[11px] font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors shadow-lg"
        >
          Dismiss All ({combinedTotal})
        </button>
      )}
    </div>
  )
}
