// components/notifications/StatusToastToggle.tsx
// On/off toggle for live status change toast notifications — placed in header bar
"use client"

import { useEffect, useState } from "react"

export function StatusToastToggle() {
  const [enabled, setEnabled] = useState(true)

  // Sync with localStorage (source of truth shared with useLoadStatusSubscription)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("statusToastsEnabled")
      if (stored !== null) setEnabled(stored === "true")
    } catch { /* ignore */ }

    // Listen for changes from the hook
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "statusToastsEnabled" && e.newValue !== null) {
        setEnabled(e.newValue === "true")
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    try {
      localStorage.setItem("statusToastsEnabled", String(next))
      // Dispatch a custom event so the hook picks up the change in the same tab
      window.dispatchEvent(new CustomEvent("statusToastsToggled", { detail: next }))
    } catch { /* ignore */ }
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
        enabled
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
          : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300"
      }`}
      title={enabled ? "Live status notifications on — click to disable" : "Status notifications off — click to enable"}
    >
      {enabled ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 0 0 3.844.148M6.956 6.956a6 6 0 0 1 11.044 2.794v.75c0 1.764.521 3.41 1.413 4.788M6.956 6.956 2.25 2.25m4.706 4.706A8.927 8.927 0 0 0 6 9.75V9a5.966 5.966 0 0 1 .684-2.794M6.956 6.956 3.687 14.272a8.992 8.992 0 0 0 2.17.77M17.413 14.538A8.955 8.955 0 0 1 18 9.75V9m-2.587 5.538L3.687 14.272m13.726.266 2.337 2.337M3.687 14.272A24.099 24.099 0 0 0 9.143 17.082m0 0a3 3 0 1 0 5.714 0" />
        </svg>
      )}
      {enabled ? "Live" : "Off"}
    </button>
  )
}
