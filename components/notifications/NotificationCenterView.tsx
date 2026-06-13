"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type ActivityNotification = {
  id: string
  entity_type: string
  entity_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

function formatTitle(n: ActivityNotification): string {
  if (n.entity_type === "load" && n.action === "status_changed") {
    const ref = typeof n.details?.reference_number === "string" ? n.details.reference_number : n.entity_id
    return `Load ${ref} status changed`
  }
  if (n.entity_type === "ap_settlement" && n.action.includes("email")) {
    return "Settlement email event"
  }
  if (n.entity_type === "ar_invoice" && n.action === "batch_consolidated") {
    return "A/R batch invoice consolidated"
  }
  return `${n.entity_type} • ${n.action}`
}

function formatDetail(n: ActivityNotification): string {
  const details = n.details || {}
  if (n.entity_type === "load" && n.action === "status_changed") {
    const oldStatus = typeof details.old_status === "string" ? details.old_status : "Unknown"
    const newStatus = typeof details.new_status === "string" ? details.new_status : "Unknown"
    return `${oldStatus} -> ${newStatus}`
  }
  if (n.entity_type === "ap_settlement" && n.action.includes("email")) {
    const driver = typeof details.driver_name === "string" ? details.driver_name : "Driver"
    return `${driver} • ${n.action}`
  }
  if (n.entity_type === "ar_invoice" && n.action === "batch_consolidated") {
    const count = Array.isArray(details.consolidated_invoice_ids)
      ? details.consolidated_invoice_ids.length
      : undefined
    return count ? `${count} line invoice(s) consolidated` : "Grouped customer invoice created"
  }
  const actor =
    (typeof details.updated_by === "string" && details.updated_by) ||
    (typeof details.created_by === "string" && details.created_by) ||
    (typeof details.changed_by === "string" && details.changed_by) ||
    ""
  return actor || "Operational event"
}

export function NotificationCenterView() {
  const [items, setItems] = useState<ActivityNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/notifications?limit=100")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to load notifications")
        return
      }
      setItems(Array.isArray(data.notifications) ? data.notifications : [])
    } catch {
      setError("Failed to load notifications")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("notification-center-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log" },
        () => {
          setRefreshing(true)
          fetchNotifications(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchNotifications])

  const grouped = useMemo(() => {
    const map = new Map<string, ActivityNotification[]>()
    for (const i of items) {
      const day = new Date(i.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      const prev = map.get(day) || []
      prev.push(i)
      map.set(day, prev)
    }
    return Array.from(map.entries())
  }, [items])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Notification Center</h2>
          <p className="text-sm text-gray-400">Operational feed and history by role.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true)
            fetchNotifications(true)
          }}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:text-white hover:bg-white/5"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded p-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-gray-400">Loading notifications...</div>
      ) : grouped.length === 0 ? (
        <div className="text-sm text-gray-400">No notifications yet.</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, rows]) => (
            <section key={day} className="bg-[#111827] border border-white/10 rounded-lg">
              <div className="px-4 py-2 border-b border-white/10 text-xs text-gray-400">{day}</div>
              <ul className="divide-y divide-white/5">
                {rows.map((n) => (
                  <li key={n.id} className="px-4 py-3">
                    <div className="text-sm text-white">{formatTitle(n)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDetail(n)}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
