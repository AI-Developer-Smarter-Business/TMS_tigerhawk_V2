// components/notifications/NotificationBell.tsx
"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useUserRole } from "@/lib/auth/useUserRole"

type Alert = {
  id: string
  type: "demurrage" | "unassigned" | "vessel" | "waiting_time"
  title: string
  detail: string
  urgency: "critical" | "warning" | "info"
  href: string
}

type NotificationSettingsMap = {
  demurrage_warning_days: number
  demurrage_critical_days: number
  unassigned_critical_hours: number
  vessel_today_only: boolean
}

export function NotificationBell() {
  const { role, loading: roleLoading } = useUserRole()
  const isStaff = role === "admin" || role === "dispatcher" || role === "accounting" || role === "finance"
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [realtimeHealthy, setRealtimeHealthy] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchAlerts = useCallback(async () => {
    const supabase = createClient()
    const settings: NotificationSettingsMap = {
      demurrage_warning_days: 3,
      demurrage_critical_days: 1,
      unassigned_critical_hours: 24,
      vessel_today_only: true,
    }

    const { data: settingRows } = await supabase
      .from("notification_settings")
      .select("setting_key, enabled, config")
      .in("setting_key", ["demurrage_alerts", "unassigned_load_alerts", "vessel_arrival_alerts"])

    for (const row of settingRows || []) {
      if (!row.enabled || !row.config || typeof row.config !== "object") continue
      const config = row.config as Record<string, unknown>
      if (row.setting_key === "demurrage_alerts") {
        settings.demurrage_warning_days = Number(config.warning_days) || settings.demurrage_warning_days
        settings.demurrage_critical_days = Number(config.critical_days) || settings.demurrage_critical_days
      }
      if (row.setting_key === "unassigned_load_alerts") {
        settings.unassigned_critical_hours = Number(config.critical_after_hours) || settings.unassigned_critical_hours
      }
      if (row.setting_key === "vessel_arrival_alerts") {
        settings.vessel_today_only = config.show_arriving_today !== false
      }
    }

    const newAlerts: Alert[] = []

    const { data: containers } = await supabase
      .from("containers")
      .select("id, container_number, last_free_day, status")
      .not("last_free_day", "is", null)
      .in("status", ["Available", "Released", "On Vessel", "In Transit"])
      .limit(120)

    if (containers) {
      for (const c of containers) {
        if (!c.last_free_day) continue
        const daysLeft = Math.ceil(
          (new Date(c.last_free_day).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        if (daysLeft < 0) {
          newAlerts.push({
            id: `dem-${c.id}`,
            type: "demurrage",
            title: c.container_number,
            detail: `Demurrage overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? "s" : ""}`,
            urgency: "critical",
            href: "/dashboard/containers",
          })
        } else if (daysLeft <= settings.demurrage_critical_days) {
          newAlerts.push({
            id: `dem-${c.id}`,
            type: "demurrage",
            title: c.container_number,
            detail: daysLeft === 0 ? "Last free day is TODAY" : "Last free day is TOMORROW",
            urgency: "critical",
            href: "/dashboard/containers",
          })
        } else if (daysLeft <= settings.demurrage_warning_days) {
          newAlerts.push({
            id: `dem-${c.id}`,
            type: "demurrage",
            title: c.container_number,
            detail: `${daysLeft} days until demurrage`,
            urgency: "warning",
            href: "/dashboard/containers",
          })
        }
      }
    }

    const { data: unassigned } = await supabase
      .from("loads")
      .select("id, reference_number, created_at")
      .eq("status", "Created")
      .is("driver_id", null)
      .order("created_at", { ascending: true })
      .limit(120)

    if (unassigned) {
      for (const s of unassigned) {
        const hoursAgo = Math.round(
          (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60)
        )
        newAlerts.push({
          id: `unassigned-${s.id}`,
          type: "unassigned",
          title: s.reference_number,
          detail:
            hoursAgo < 1
              ? "Needs driver assigned — just created"
              : `Needs driver assigned — ${hoursAgo}h ago`,
          urgency: hoursAgo >= settings.unassigned_critical_hours ? "critical" : "warning",
          href: "/dashboard/dispatcher",
        })
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const upper = new Date(tomorrow)
    if (!settings.vessel_today_only) upper.setDate(upper.getDate() + 1)

    const { data: vessels } = await supabase
      .from("vessels")
      .select("id, name, terminal, eta")
      .gte("eta", today.toISOString())
      .lt("eta", upper.toISOString())
      .limit(50)

    if (vessels) {
      for (const v of vessels) {
        const etaTime = new Date(v.eta).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
        newAlerts.push({
          id: `vessel-${v.id}`,
          type: "vessel",
          title: v.name,
          detail: `Arriving ${settings.vessel_today_only ? "today" : "soon"} at ${etaTime} — ${v.terminal}`,
          urgency: "info",
          href: "/dashboard/vessels",
        })
      }
    }

    const { data: waitEvents } = await supabase
      .from("waiting_time_events")
      .select(
        "id, load_id, event_name, start_time, end_time, duration_minutes, free_time_minutes, charge_amount, loads(id, reference_number, driver_id, drivers(name))",
      )
      .eq("event_name", "delivery_wait")
      .is("end_time", null)
      .not("start_time", "is", null)
      .limit(50)

    if (waitEvents) {
      for (const evt of waitEvents) {
        const freeMinutes = Number(evt.free_time_minutes) || 60
        const startMs = new Date(evt.start_time as string).getTime()
        const elapsedMinutes = Math.floor((Date.now() - startMs) / 60000)
        const billableMinutes = Math.max(0, elapsedMinutes - freeMinutes)
        if (billableMinutes <= 0) continue

        const loadRef =
          (evt.loads as { reference_number?: string } | null)?.reference_number || "Load"
        const driverName =
          (evt.loads as { drivers?: { name?: string } | null } | null)?.drivers?.name || null

        newAlerts.push({
          id: `wait-${evt.id}`,
          type: "waiting_time",
          title: loadRef,
          detail: driverName
            ? `${driverName} — ${billableMinutes} min billable at delivery`
            : `${billableMinutes} min billable wait at delivery`,
          urgency: billableMinutes >= 30 ? "critical" : "warning",
          href: "/dashboard/dispatcher",
        })
      }
    }

    const urgencyOrder = { critical: 0, warning: 1, info: 2 }
    newAlerts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
    setAlerts(newAlerts)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isStaff) return
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAlerts, isStaff])

  useEffect(() => {
    if (!isStaff) return
    const supabase = createClient()
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let channel = supabase.channel(`notifications-bell:${Date.now()}`)

    const subscribe = () => {
      channel = channel
        .on("postgres_changes", { event: "*", schema: "public", table: "loads" }, fetchAlerts)
        .on("postgres_changes", { event: "*", schema: "public", table: "containers" }, fetchAlerts)
        .on("postgres_changes", { event: "*", schema: "public", table: "vessels" }, fetchAlerts)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "waiting_time_events" },
          fetchAlerts,
        )
        .subscribe((status) => {
          const healthy = status === "SUBSCRIBED"
          setRealtimeHealthy(healthy)
          if (!healthy && (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")) {
            if (reconnectTimer) clearTimeout(reconnectTimer)
            reconnectTimer = setTimeout(() => {
              supabase.removeChannel(channel)
              channel = supabase.channel(`notifications-bell:${Date.now()}`)
              subscribe()
            }, 2000)
          }
        })
    }

    subscribe()
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      supabase.removeChannel(channel)
    }
  }, [fetchAlerts, isStaff])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (roleLoading || !isStaff) return null

  const visibleAlerts = alerts.filter((a) => !dismissedIds.has(a.id))
  const criticalCount = visibleAlerts.filter((a) => a.urgency === "critical").length
  const totalCount = visibleAlerts.length

  const handleDismiss = (e: React.MouseEvent, alertId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDismissedIds((prev) => new Set(prev).add(alertId))
  }

  const handleClearAll = () => {
    setDismissedIds(new Set(alerts.map((a) => a.id)))
  }

  const urgencyStyles = {
    critical: {
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      dot: "bg-red-400",
      text: "text-red-400",
    },
    warning: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      dot: "bg-amber-400",
      text: "text-amber-400",
    },
    info: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      dot: "bg-blue-400",
      text: "text-blue-400",
    },
  }

  const typeIcons: Record<string, string> = {
    demurrage: "⏰",
    unassigned: "🚛",
    vessel: "🚢",
    waiting_time: "⏳",
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {/* Badge */}
        {totalCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1 ${
              criticalCount > 0 ? "bg-red-500 animate-pulse" : "bg-[#E8700A]"
            }`}
          >
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#1A2332] border border-white/10 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Alerts</h3>
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400">
                  {criticalCount} critical
                </span>
              )}
            </div>
            {totalCount > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Alerts list */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center">
                <div className="inline-block w-5 h-5 border-2 border-gray-600 border-t-[#E8700A] rounded-full animate-spin" />
              </div>
            ) : visibleAlerts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500">All clear — no alerts</p>
              </div>
            ) : (
              visibleAlerts.map((alert) => {
                const style = urgencyStyles[alert.urgency]
                return (
                  <div
                    key={alert.id}
                    className="flex items-start border-b border-white/5 hover:bg-white/[0.03] transition-colors group"
                  >
                    <a
                      href={alert.href}
                      onClick={() => setOpen(false)}
                      className="flex-1 flex items-start gap-3 px-4 py-3 min-w-0"
                    >
                      {/* Icon */}
                      <span className="text-base flex-shrink-0 mt-0.5">
                        {typeIcons[alert.type]}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200 truncate">
                            {alert.title}
                          </span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot} ${
                              alert.urgency === "critical" ? "animate-pulse" : ""
                            }`}
                          />
                        </div>
                        <p className={`text-xs mt-0.5 ${style.text}`}>
                          {alert.detail}
                        </p>
                      </div>
                    </a>

                    {/* Dismiss button */}
                    <button
                      onClick={(e) => handleDismiss(e, alert.id)}
                      className="flex-shrink-0 p-2 mr-1 mt-2 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all"
                      title="Dismiss"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/5 bg-white/[0.02] space-y-2">
            <p className="text-[10px] text-gray-500 text-center uppercase tracking-wide">
              {realtimeHealthy ? "Realtime active" : "Realtime reconnecting (fallback: polling)"}
            </p>
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-[11px] text-[#E8700A] hover:text-[#FF8C21] transition-colors"
            >
              Open notification center
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
