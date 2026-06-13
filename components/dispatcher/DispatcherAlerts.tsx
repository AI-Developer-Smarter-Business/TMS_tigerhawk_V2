// components/dispatcher/DispatcherAlerts.tsx
// Categorized dispatcher alerts: Critical (red), Important (yellow), FYI (blue)
// Compact pill (collapsed) that opens into a floating modal panel
"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { LoadWithRelations } from "@/types/dispatcher"

type AlertCategory = "critical" | "important" | "fyi"

type Alert = {
  id: string
  category: AlertCategory
  title: string
  detail: string
  loadRef?: string
  loadId?: string
}

type Props = {
  loads: LoadWithRelations[]
}

// ─── Alert generation from live load data ────────────────────
function generateAlerts(loads: LoadWithRelations[]): Alert[] {
  const alerts: Alert[] = []
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const tomorrowDate = new Date(now)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)
  const day2 = new Date(now)
  day2.setDate(day2.getDate() + 2)
  const day2Str = day2.toISOString().slice(0, 10)
  const day3 = new Date(now)
  day3.setDate(day3.getDate() + 3)
  const day3Str = day3.toISOString().slice(0, 10)

  for (const load of loads) {
    // Skip completed/cancelled
    if (load.status === "Completed" || load.status === "Cancelled") continue

    const lfd = load.containers?.last_free_day || load.per_diem_free_day
    if (lfd) {
      const lfdDate = lfd.slice(0, 10)

      // ── CRITICAL: LFD today or past (demurrage) ──
      if (lfdDate <= todayStr) {
        const daysOverdue = Math.floor((now.getTime() - new Date(lfd).getTime()) / (1000 * 60 * 60 * 24))
        alerts.push({
          id: `crit-lfd-${load.id}`,
          category: "critical",
          title: daysOverdue > 0
            ? `Demurrage — ${daysOverdue}d overdue`
            : "LFD Today",
          detail: `${load.reference_number} • ${load.containers?.container_number || "No container"} • ${load.customers?.name || "Unknown customer"}`,
          loadRef: load.reference_number,
          loadId: load.id,
        })
      }
      // ── CRITICAL: LFD tomorrow ──
      else if (lfdDate === tomorrowStr) {
        alerts.push({
          id: `crit-lfd-tmrw-${load.id}`,
          category: "critical",
          title: "LFD Tomorrow",
          detail: `${load.reference_number} • ${load.containers?.container_number || "No container"} • ${load.customers?.name || "Unknown customer"}`,
          loadRef: load.reference_number,
          loadId: load.id,
        })
      }
      // ── IMPORTANT: LFD in 2-3 days ──
      else if (lfdDate === day2Str || lfdDate === day3Str) {
        const daysLeft = lfdDate === day2Str ? 2 : 3
        alerts.push({
          id: `imp-lfd-${load.id}`,
          category: "important",
          title: `LFD in ${daysLeft} days`,
          detail: `${load.reference_number} • ${load.containers?.container_number || "No container"} • ${load.customers?.name || "Unknown customer"}`,
          loadRef: load.reference_number,
          loadId: load.id,
        })
      }
    }

    // ── CRITICAL: Active holds on dispatched/in-transit loads ──
    if (
      (load.customs_hold === "hold" || load.freight_hold === "hold") &&
      ["Dispatched", "In Transit", "Arrived At Pickup"].includes(load.status)
    ) {
      const holdTypes: string[] = []
      if (load.customs_hold === "hold") holdTypes.push("Customs")
      if (load.freight_hold === "hold") holdTypes.push("Freight")
      alerts.push({
        id: `crit-hold-${load.id}`,
        category: "critical",
        title: `${holdTypes.join(" & ")} Hold — ${load.status}`,
        detail: `${load.reference_number} • Driver active but load has holds`,
        loadRef: load.reference_number,
        loadId: load.id,
      })
    }

    // ── IMPORTANT: Unassigned loads that are Available/Freight Released ──
    if (
      !load.driver_id &&
      ["Available", "Freight Released", "Available At Port"].includes(load.status) &&
      lfd
    ) {
      const lfdDate = new Date(lfd)
      const daysToLFD = Math.ceil((lfdDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysToLFD <= 5 && daysToLFD > 0) {
        alerts.push({
          id: `imp-unassigned-${load.id}`,
          category: "important",
          title: `Unassigned — LFD in ${daysToLFD}d`,
          detail: `${load.reference_number} • ${load.customers?.name || "Unknown"} • Needs driver assignment`,
          loadRef: load.reference_number,
          loadId: load.id,
        })
      }
    }
  }

  // ── FYI: Vessel arrivals (loads in pre-pickup statuses with vessel_eta today or tomorrow) ──
  const vesselLoads = loads.filter(l =>
    l.vessel_eta &&
    ["Created", "Pending", "Customs Hold"].includes(l.status)
  )
  const vesselETAToday = vesselLoads.filter(l => l.vessel_eta!.slice(0, 10) === todayStr)
  const vesselETATomorrow = vesselLoads.filter(l => l.vessel_eta!.slice(0, 10) === tomorrowStr)

  if (vesselETAToday.length > 0) {
    alerts.push({
      id: "fyi-vessel-today",
      category: "fyi",
      title: `${vesselETAToday.length} vessel arrival${vesselETAToday.length > 1 ? "s" : ""} today`,
      detail: vesselETAToday.slice(0, 3).map(l => l.reference_number).join(", ") + (vesselETAToday.length > 3 ? ` +${vesselETAToday.length - 3} more` : ""),
    })
  }
  if (vesselETATomorrow.length > 0) {
    alerts.push({
      id: "fyi-vessel-tomorrow",
      category: "fyi",
      title: `${vesselETATomorrow.length} vessel arrival${vesselETATomorrow.length > 1 ? "s" : ""} tomorrow`,
      detail: vesselETATomorrow.slice(0, 3).map(l => l.reference_number).join(", ") + (vesselETATomorrow.length > 3 ? ` +${vesselETATomorrow.length - 3} more` : ""),
    })
  }

  // ── FYI: Loads dispatched but no status update in >4 hours ──
  const staleDispatched = loads.filter(l => {
    if (l.status !== "Dispatched") return false
    const updated = l.updated_at ? new Date(l.updated_at) : new Date(l.created_at)
    return (now.getTime() - updated.getTime()) > 4 * 60 * 60 * 1000
  })
  if (staleDispatched.length > 0) {
    alerts.push({
      id: "fyi-stale-dispatch",
      category: "fyi",
      title: `${staleDispatched.length} dispatched load${staleDispatched.length > 1 ? "s" : ""} with no update (4h+)`,
      detail: staleDispatched.slice(0, 3).map(l => `${l.reference_number}${l.drivers?.name ? ` (${l.drivers.name})` : ""}`).join(", ") + (staleDispatched.length > 3 ? ` +${staleDispatched.length - 3} more` : ""),
    })
  }

  return alerts
}

// ─── Category config ─────────────────────────────────────────
const CATEGORY_CONFIG: Record<AlertCategory, { label: string; bg: string; border: string; text: string; icon: string; dot: string; pillBg: string }> = {
  critical: {
    label: "Critical",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z",
    dot: "bg-red-500",
    pillBg: "bg-red-500/15",
  },
  important: {
    label: "Important",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    icon: "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z",
    dot: "bg-amber-500",
    pillBg: "bg-amber-500/15",
  },
  fyi: {
    label: "FYI",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    icon: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
    dot: "bg-blue-500",
    pillBg: "bg-blue-500/15",
  },
}

const CATEGORY_ORDER: AlertCategory[] = ["critical", "important", "fyi"]

// ─── Main component ──────────────────────────────────────────
export function DispatcherAlerts({ loads }: Props) {
  const [open, setOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<AlertCategory | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const alerts = useMemo(() => generateAlerts(loads), [loads])

  const grouped = useMemo(() => {
    const map: Record<AlertCategory, Alert[]> = { critical: [], important: [], fyi: [] }
    for (const a of alerts) {
      map[a.category].push(a)
    }
    return map
  }, [alerts])

  const totalAlerts = alerts.length
  const criticalCount = grouped.critical.length
  const importantCount = grouped.important.length
  const fyiCount = grouped.fyi.length

  // Close floating panel when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open])

  if (totalAlerts === 0) return null

  // Determine the most severe category color for the pill
  const pillColor = criticalCount > 0 ? "critical" : importantCount > 0 ? "important" : "fyi"
  const pillCfg = CATEGORY_CONFIG[pillColor]

  return (
    <div className="relative" ref={panelRef}>
      {/* ── Collapsed pill trigger ── */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:brightness-110 ${
          open
            ? "bg-white/5 border-white/10"
            : `${pillCfg.bg} ${pillCfg.border}`
        }`}
      >
        {/* Bell icon */}
        <svg className={`w-3.5 h-3.5 ${pillCfg.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>

        {/* Category count badges */}
        <div className="flex items-center gap-1">
          {CATEGORY_ORDER.map(cat => {
            const count = grouped[cat].length
            if (count === 0) return null
            const cfg = CATEGORY_CONFIG[cat]
            return (
              <span key={cat} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.pillBg} ${cfg.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cat === "critical" ? "animate-pulse" : ""}`} />
                {count}
              </span>
            )
          })}
        </div>

        <span className="text-[11px] font-medium text-gray-400">
          {totalAlerts} Alert{totalAlerts !== 1 ? "s" : ""}
        </span>

        {/* Chevron */}
        <svg className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* ── Floating modal panel ── */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[70vh] bg-[#1A2332] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-[#111827]">
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 ${pillCfg.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <span className="text-sm font-semibold text-white">Dispatcher Alerts</span>
              <span className="text-[10px] text-gray-500 font-medium">({totalAlerts})</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Alert content — scrollable */}
          <div className="max-h-[calc(70vh-52px)] overflow-y-auto divide-y divide-white/5">
            {CATEGORY_ORDER.map(cat => {
              const items = grouped[cat]
              if (items.length === 0) return null
              const cfg = CATEGORY_CONFIG[cat]
              const isExpanded = expandedCategory === cat
              const showItems = isExpanded ? items : items.slice(0, 3)
              const hasMore = items.length > 3

              return (
                <div key={cat} className="px-4 py-3">
                  {/* Category header */}
                  <div className="flex items-center gap-2 mb-2">
                    <svg className={`w-3.5 h-3.5 ${cfg.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                    </svg>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.text}`}>
                      {cfg.label} ({items.length})
                    </span>
                  </div>

                  {/* Alert items */}
                  <div className="space-y-1.5">
                    {showItems.map(alert => (
                      <div
                        key={alert.id}
                        className={`flex items-start gap-2 px-3 py-2 rounded-lg ${cfg.bg} border ${cfg.border}`}
                      >
                        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${cat === "critical" ? "animate-pulse" : ""}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-semibold ${cfg.text}`}>
                            {alert.title}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {alert.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Show more / less */}
                  {hasMore && (
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                      className={`mt-1.5 text-[10px] font-medium ${cfg.text} hover:underline`}
                    >
                      {isExpanded ? "Show less" : `+${items.length - 3} more`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
