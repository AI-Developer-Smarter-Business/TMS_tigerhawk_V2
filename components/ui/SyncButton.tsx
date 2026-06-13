// components/ui/SyncButton.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"

interface SyncButtonProps {
  label?: string
  endpoint?: string
}

export function SyncButton({
  label = "Sync Now",
  endpoint = "/api/port-houston/sync",
}: SyncButtonProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  // Auto-dismiss result toast after 5 seconds
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setResult(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [result])

  const handleSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setResult(null)

    // AbortController for client-side timeout (55s — within Vercel Pro's 60s limit)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 55000)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Handle non-JSON responses (e.g. HTML error pages)
      const contentType = response.headers.get("content-type") || ""
      if (!contentType.includes("application/json")) {
        throw new Error(
          `Server returned ${response.status} (${response.statusText})`
        )
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Sync failed (${response.status})`)
      }

      const parts: string[] = []
      if (data.vessels > 0) parts.push(`${data.vessels} vessels`)
      if (data.containers > 0) parts.push(`${data.containers} containers`)

      setResult({
        type: "success",
        message:
          parts.length > 0
            ? `Synced ${parts.join(" and ")}`
            : "Sync complete — no new data",
      })

      // Refresh after short delay to show updated data
      setTimeout(() => router.refresh(), 1500)
    } catch (err) {
      clearTimeout(timeoutId)

      let message = "Sync failed"
      if (err instanceof DOMException && err.name === "AbortError") {
        message =
          "Sync timed out — the Port Houston API may be slow. Try again in a moment."
      } else if (err instanceof TypeError && err.message === "Failed to fetch") {
        message = "Network error — check your connection or Vercel deployment."
      } else if (err instanceof Error) {
        message = err.message
      }

      setResult({ type: "error", message })
    } finally {
      setSyncing(false)
    }
  }, [syncing, endpoint])

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {syncing ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Syncing...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
              />
            </svg>
            {label}
          </>
        )}
      </button>

      {/* Result toast — inline instead of absolute to avoid clipping */}
      {result && (
        <div
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg animate-in fade-in ${
            result.type === "success"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/15 text-red-400 border border-red-500/20"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  )
}
