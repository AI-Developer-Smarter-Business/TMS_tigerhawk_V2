"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { LoadWithRelations, LOAD_STATUS_COLORS, LoadStatus } from "@/types/dispatcher"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { LoadDetailPanel } from "./LoadDetailPanel"
import { DISPATCHER_COLUMNS } from "@/lib/column-config"
import { isValidContainerNumber } from "@/lib/validation"
import { emitStatusChangeEvent } from "@/hooks/useLoadStatusSubscription"
import { getActiveHoldKeys } from "@/lib/loadHolds"
import { useUserRole } from "@/lib/auth/useUserRole"
import { useClientNow } from "@/hooks/useClientNow"
import {
  daysUntil,
  formatStalePortWarning,
  formatSyncedAgo,
  hoursSince,
} from "@/lib/time/relative"
import { getDriverLastSeenLabel } from "@/lib/live-tracking/driver-location"

type Driver = {
  id: string
  name: string
  phone: string | null
  status: string
}

type Props = {
  loads: LoadWithRelations[]
  availableDrivers: Driver[]
  visibleColumns: string[]
  isColumnVisible: (key: string) => boolean
  showColumnFilters: boolean
}

// Event pill color mapping
const eventColors: Record<string, { bg: string; text: string }> = {
  "Pick Up Container": { bg: "bg-emerald-500/20 border-emerald-500/30", text: "text-emerald-400" },
  "Deliver Container": { bg: "bg-blue-500/20 border-blue-500/30", text: "text-blue-400" },
  "Drop Container": { bg: "bg-gray-500/20 border-gray-500/30", text: "text-gray-400" },
  "Return Container": { bg: "bg-purple-500/20 border-purple-500/30", text: "text-purple-400" },
}

function getEventLabel(load: LoadWithRelations, eventNum: 1 | 2 | 3): { label: string; location: string | null } | null {
  if (eventNum === 1) {
    return { label: "Pick Up Container", location: load.pickup_location }
  } else if (eventNum === 2) {
    return { label: "Deliver Container", location: load.delivery_location }
  } else {
    const label = load.load_type === "Export" ? "Drop Container" : "Return Container"
    return { label, location: load.return_location || null }
  }
}

function EventCell({ event }: { event: { label: string; location: string | null } | null }) {
  if (!event) return <td className="px-2 py-2.5 text-xs text-gray-600">—</td>
  const colors = eventColors[event.label] || eventColors["Drop Container"]
  return (
    <td className="px-2 py-2.5">
      <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors.bg} ${colors.text}`}>
        {event.label}
      </div>
      {event.location && (
        <p className="mt-0.5 text-[10px] text-gray-500 truncate max-w-[140px]">{event.location}</p>
      )}
    </td>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })
  } catch { return "—" }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    return d.toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true })
  } catch { return "—" }
}

// ── Driver Assign Button (searchable dropdown for unassigned loads) ──
function DriverAssignButton({
  load,
  availableDrivers,
  onAssigned,
}: {
  load: LoadWithRelations
  availableDrivers: Driver[]
  onAssigned: (driver: Driver) => void
}) {
  const { role, loading: roleLoading } = useUserRole()
  const loadId = load.id
  const assignBlockedByHolds =
    getActiveHoldKeys({
      freight_hold: load.freight_hold,
      customs_hold: load.customs_hold,
      terminal_hold: load.terminal_hold,
      fees_hold: load.fees_hold,
      other_hold: load.other_hold,
      carrier_hold: load.carrier_hold,
    }).length > 0 && !roleLoading && role !== "admin"

  const [open, setOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [search, setSearch] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const handleAssign = async (driver: Driver) => {
    setAssigning(true)
    setAssignError(null)
    try {
      const res = await fetch(`/api/dispatcher/loads/${loadId}/assign-driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driver.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg =
          err.code === "ACTIVE_HOLDS" && Array.isArray(err.activeHolds)
            ? `${err.error || "Hold active"} (${err.activeHolds.join(", ")})`
            : err.error || "Assign failed"
        setAssignError(msg)
        console.error("[DriverAssign] Failed:", err)
        return
      }
      onAssigned(driver)
      setOpen(false)
      setSearch("")
    } catch (err) {
      console.error("[DriverAssign] Error:", err)
      setAssignError("Network error")
    } finally {
      setAssigning(false)
    }
  }

  const activeDrivers = availableDrivers
  const filteredDrivers = search
    ? activeDrivers.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.phone && d.phone.includes(search))
      )
    : activeDrivers

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (assignBlockedByHolds) return
          setAssignError(null)
          setOpen(!open)
        }}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-dashed transition-colors ${
          assignBlockedByHolds
            ? "border-white/10 text-gray-500 cursor-not-allowed opacity-60"
            : "border-white/20 text-gray-400 hover:border-[#E8700A]/40 hover:text-[#E8700A]"
        }`}
        disabled={assigning || assignBlockedByHolds}
        title={
          assignBlockedByHolds
            ? "Release active holds before assigning a driver (admins may still assign)."
            : undefined
        }
      >
        {assigning ? (
          <span className="animate-pulse">Assigning…</span>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Assign
          </>
        )}
      </button>
      {assignError && (
        <p className="absolute left-0 top-full mt-0.5 text-[9px] text-red-400 max-w-[140px] z-10">
          {assignError}
        </p>
      )}

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-56 bg-[#1a2236] border border-white/10 rounded-lg shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="px-2 py-1.5 border-b border-white/5">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drivers…"
              className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#E8700A]/40"
              onKeyDown={(e) => {
                if (e.key === "Escape") { setOpen(false); setSearch("") }
                if (e.key === "Enter" && filteredDrivers.length === 1) {
                  handleAssign(filteredDrivers[0])
                }
              }}
            />
          </div>
          {filteredDrivers.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500">
              {activeDrivers.length === 0 ? "No available drivers" : "No matches"}
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {filteredDrivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => handleAssign(driver)}
                  className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/5 flex items-center gap-2 transition-colors"
                  disabled={assigning}
                >
                  <div className="w-5 h-5 rounded-full bg-[#E8700A]/20 border border-[#E8700A]/40 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-[#E8700A]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-gray-200">{driver.name}</div>
                    {driver.phone && <div className="text-[10px] text-gray-500">{driver.phone}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function isLFDWarning(lfd: string | null, nowMs: number | null): boolean {
  if (!lfd || nowMs === null) return false
  return daysUntil(lfd, nowMs) <= 2
}

// Extract the display value for a column key from a load (used for filtering)
function getColumnValue(key: string, load: LoadWithRelations, nowMs: number | null): string {
  switch (key) {
    case "reference_number": return load.reference_number || ""
    case "status": return load.status || ""
    case "driver": return load.drivers?.name || ""
    case "driver_last_seen": return getDriverLastSeenLabel(load, nowMs) || ""
    case "load_type": return load.load_type || ""
    case "container_number": return load.containers?.container_number || ""
    case "ref_number": return load.house_bol || load.mbol || ""
    case "container_size": return load.container_size || load.containers?.size || ""
    case "container_type": return load.container_type || load.containers?.type || ""
    case "customer": return load.customers?.name || ""
    case "ssl": return load.ssl || ""
    case "pickup_location": return load.pickup_location || ""
    case "delivery_location": return load.delivery_location || ""
    case "return_location": return load.return_location || ""
    case "chassis_number": return load.chassis_number || ""
    case "vessel_name": return load.vessel_name || ""
    case "route_template": return load.route_template || ""
    case "mbol": return load.mbol || ""
    case "house_bol": return load.house_bol || ""
    case "csr": return load.csr || ""
    case "seal_number": return load.seal_number || ""
    case "genset_number": return load.genset_number || ""
    case "voyage": return load.voyage || ""
    case "purchase_order": return load.purchase_order || ""
    case "shipment_number": return load.shipment_number || ""
    case "pickup_number": return load.pickup_number || ""
    case "return_number": return load.return_number || ""
    case "appointment_number": return load.appointment_number || ""
    case "reservation_number": return load.reservation_number || ""
    case "warning": return getWarningCategory(load, nowMs)
    case "ref_container": return load.containers?.container_number || ""
    case "delivery_city_state": return load.delivery_location || ""
    case "change_status": return load.status || ""
    case "event1": return "Pick Up Container"
    case "event2": return "Deliver Container"
    case "event3": return load.load_type === "Export" ? "Drop Container" : "Return Container"
    case "next_address": {
      if (["Created", "Available", "Pending", "Assigned"].includes(load.status)) return load.pickup_location || ""
      if (["Dispatched", "In Transit", "Arrived At Pickup"].includes(load.status)) return load.delivery_location || ""
      if (["Delivered", "Arrived At Delivery"].includes(load.status)) return load.return_location || ""
      return ""
    }
    // Date columns — use same formatting as rendered cells
    case "pickup_apt_from": return load.pickup_apt_from ? formatDateTime(load.pickup_apt_from) : ""
    case "delivery_apt_from": return load.delivery_apt_from ? formatDateTime(load.delivery_apt_from) : ""
    case "cut_off": return load.outgate_date ? formatDateTime(load.outgate_date) : ""
    case "vessel_eta": return load.vessel_eta ? formatDate(load.vessel_eta) : ""
    case "per_diem_free_day": return load.per_diem_free_day ? formatDate(load.per_diem_free_day) : ""
    case "lfd_erd": {
      const lfdVal = load.containers?.last_free_day || load.per_diem_free_day
      return lfdVal ? formatDate(lfdVal) : ""
    }
    default: return ""
  }
}

// Columns that do NOT support filtering
const NON_FILTERABLE_COLUMNS = new Set([
  "checkbox", "rowNumber", "reset_routing",
  "seal_number", "pickup_number", "vessel_name", "voyage", "purchase_order",
])

// Compute a filterable warning category for a load
// Note: Holds are displayed in the Load Status column, not the warning column
function getWarningCategory(load: LoadWithRelations, nowMs: number | null): string {
  const hasContainer = !!load.containers?.container_number

  if (hasContainer && load.containers?.last_free_day && nowMs !== null) {
    const daysLeft = daysUntil(load.containers.last_free_day, nowMs)
    if (daysLeft <= 0) return "LFD Expired"
    if (daysLeft <= 1) return "LFD Tomorrow"
  }
  if (hasContainer && !load.containers?.ph_synced_at) return "Unsynced"
  if (hasContainer && load.containers?.ph_synced_at && nowMs !== null) {
    if (hoursSince(load.containers.ph_synced_at, nowMs) > 6) return "Stale"
    return "Synced"
  }
  return ""
}

export function LoadsTable({ loads: serverLoads, availableDrivers, visibleColumns, isColumnVisible, showColumnFilters }: Props) {
  const router = useRouter()
  const clientNow = useClientNow()
  // Maintain local copy of loads that merges in save responses so reopening shows fresh data
  const [loadOverrides, setLoadOverrides] = useState<Record<string, LoadWithRelations>>({})
  const loads = useMemo(() =>
    serverLoads.map(l => loadOverrides[l.id] || l),
    [serverLoads, loadOverrides]
  )

  const [selectedLoads, setSelectedLoads] = useState<Set<string>>(new Set())
  const [selectedLoad, setSelectedLoad] = useState<LoadWithRelations | null>(null)
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

  const getValue = useMemo(() => ({
    customerName: (row: LoadWithRelations) => row.customers?.name ?? "",
    driverName: (row: LoadWithRelations) => row.drivers?.name ?? "",
    containerNumber: (row: LoadWithRelations) => row.containers?.container_number ?? "",
    lfd_erd: (row: LoadWithRelations) => row.containers?.last_free_day || row.per_diem_free_day || "",
    last_seen_at: (row: LoadWithRelations) => row.last_seen_at ?? "",
  }), [])

  const { sortedData, sortConfig, requestSort } = useTableSort(loads, null, getValue)

  // Apply column filters
  const filteredData = useMemo(() => {
    const activeFilters = Object.entries(columnFilters).filter(([, v]) => v !== "")
    if (activeFilters.length === 0) return sortedData
    return sortedData.filter((load) =>
      activeFilters.every(([key, filterVal]) => getColumnValue(key, load, clientNow) === filterVal)
    )
  }, [sortedData, columnFilters, clientNow])

  // Build unique values for each filterable column (from ALL loads, not just filtered)
  const columnOptions = useMemo(() => {
    const options: Record<string, string[]> = {}
    const allKeys = DISPATCHER_COLUMNS.map((c) => c.key).filter((k) => !NON_FILTERABLE_COLUMNS.has(k))
    for (const key of allKeys) {
      const vals = new Set<string>()
      for (const load of loads) {
        const v = getColumnValue(key, load, clientNow)
        if (v) vals.add(v)
      }
      options[key] = Array.from(vals).sort((a, b) => a.localeCompare(b))
    }
    return options
  }, [loads, clientNow])

  const setFilter = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const activeFilterCount = Object.values(columnFilters).filter((v) => v !== "").length

  const clearAllFilters = useCallback(() => {
    setColumnFilters({})
  }, [])

  // Clear column filters when filter row is hidden
  useEffect(() => {
    if (!showColumnFilters) setColumnFilters({})
  }, [showColumnFilters])

  const handleSelectAll = () => {
    if (selectedLoads.size === filteredData.length) {
      setSelectedLoads(new Set())
    } else {
      setSelectedLoads(new Set(filteredData.map(l => l.id)))
    }
  }

  const handleSelectLoad = (loadId: string) => {
    const s = new Set(selectedLoads)
    if (s.has(loadId)) s.delete(loadId)
    else s.add(loadId)
    setSelectedLoads(s)
  }

  // Track a container at Port Houston from the warning column
  const [trackingLoadId, setTrackingLoadId] = useState<string | null>(null)
  const handleTrackFromWarning = async (load: LoadWithRelations) => {
    if (!load.containers?.container_number || !isValidContainerNumber(load.containers.container_number) || trackingLoadId) return
    setTrackingLoadId(load.id)
    try {
      const trackRes = await fetch("/api/dispatcher/containers/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          container_number: load.containers.container_number,
          container_id: load.containers.id || null,
          load_id: load.id,
        }),
      })
      if (trackRes.ok) {
        // Re-fetch the updated load to get fresh container + load data
        const loadRes = await fetch(`/api/dispatcher/loads/${load.id}`)
        if (loadRes.ok) {
          const updated = await loadRes.json()
          setLoadOverrides(prev => ({ ...prev, [load.id]: updated }))
        }
      }
    } catch {
      // Silently fail — icon will remain clickable
    } finally {
      setTrackingLoadId(null)
    }
  }

  const getWarningIcon = (load: LoadWithRelations) => {
    const warnings: string[] = []
    let portSynced = false

    // Port data connection/staleness warning
    if (load.containers?.container_number) {
      if (!load.containers.ph_synced_at) {
        warnings.push("Port data: never synced — click to track")
      } else if (clientNow === null) {
        // Stable placeholder until after hydration (no "Xh ago" in title)
        return (
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <title>Port data</title>
            <circle cx="12" cy="12" r="10" opacity="0.35" />
          </svg>
        )
      } else {
        const hoursSinceSync = hoursSince(load.containers.ph_synced_at, clientNow)
        if (hoursSinceSync > 6) {
          warnings.push(formatStalePortWarning(load.containers.ph_synced_at, clientNow))
        } else {
          portSynced = true
        }
      }
    }

    // LFD warning (1 day or less)
    if (load.containers?.last_free_day && clientNow !== null) {
      const daysLeft = daysUntil(load.containers.last_free_day, clientNow)
      if (daysLeft <= 1) {
        warnings.push(`LFD: ${daysLeft <= 0 ? "EXPIRED" : "tomorrow"}`)
      }
    }

    // Note: Hold warnings now displayed in Load Status column

    // Good state: container has fresh port data and no warnings
    if (portSynced && warnings.length === 0) {
      const syncedAgo = load.containers?.ph_synced_at
        ? formatSyncedAgo(load.containers.ph_synced_at, clientNow)
        : ""
      const transitLabel = load.containers?.transit_state
        ? ({ S10_ADVISED: "Advised", S20_INBOUND: "Inbound", S30_ECIN: "Gate In", S40_YARD: "In Yard", S50_ECOUT: "Gate Out", S60_LOADED: "Loaded", S70_DEPARTED: "Departed" } as Record<string, string>)[load.containers.transit_state] || load.containers.transit_state
        : ""
      const titleParts = [
        syncedAgo ? `Port data: synced ${syncedAgo}` : "Port data: synced",
      ]
      if (transitLabel) titleParts.push(`Status: ${transitLabel}`)
      if (load.containers?.shipping_line) titleParts.push(`SSL: ${load.containers.shipping_line}`)
      return (
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <title>{titleParts.join("\n")}</title>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }

    if (warnings.length === 0) return null

    // Pick the most severe icon color
    const hasConnectionIssue = warnings.some(w => w.startsWith("Port data:"))
    const hasLFD = warnings.some(w => w.startsWith("LFD:"))

    // Red = LFD expired or connection issue, Orange = LFD approaching
    const iconColor = (hasLFD && load.containers?.last_free_day && clientNow !== null && daysUntil(load.containers.last_free_day, clientNow) <= 0)
      ? "text-red-400"
      : hasConnectionIssue
        ? "text-red-400"
        : hasLFD
          ? "text-orange-400"
          : "text-amber-400"

    const title = warnings.join("\n")

    if (hasConnectionIssue && !hasLFD) {
      // Connection/staleness icon — clickable to trigger tracking
      const isTracking = trackingLoadId === load.id
      return (
        <button
          onClick={(e) => { e.stopPropagation(); handleTrackFromWarning(load) }}
          disabled={isTracking}
          className="cursor-pointer hover:opacity-80 disabled:opacity-50"
          title={isTracking ? "Tracking..." : title}
        >
          {isTracking ? (
            <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className={`w-4 h-4 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
              <title>{title}</title>
              <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
              <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
        </button>
      )
    }

    // LFD warning (exclamation circle)
    return (
      <svg className={`w-4 h-4 ${iconColor}`} fill="currentColor" viewBox="0 0 24 24">
        <title>{title}</title>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    )
  }

  // Shared header props helper
  const hp = (label: string, sortKey: string) => ({
    label,
    sortKey,
    currentSortKey: sortConfig?.key as string | null,
    currentDirection: sortConfig?.direction ?? null,
    onSort: requestSort,
  })

  // Get the ordered visible column defs
  const orderedColumns = useMemo(() => {
    return DISPATCHER_COLUMNS.filter(c => isColumnVisible(c.key))
  }, [isColumnVisible])

  // Render a header cell for a given column key
  const renderHeader = (key: string) => {
    const col = DISPATCHER_COLUMNS.find(c => c.key === key)
    if (!col) return null

    switch (key) {
      case "checkbox":
        return (
          <th key={key} className="px-2 py-2 w-8 sticky left-0 bg-[#111827] z-10">
            <input
              type="checkbox"
              checked={selectedLoads.size === filteredData.length && filteredData.length > 0}
              onChange={handleSelectAll}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/5"
            />
          </th>
        )
      case "rowNumber":
        return <th key={key} className="px-2 py-2 text-left text-[10px] font-bold text-gray-400 uppercase w-6">#</th>
      case "warning":
        return <th key={key} className="px-2 py-2 w-6"><span className="text-[10px] font-bold text-gray-400">⚠</span></th>
      case "driver":
        return <th key={key} className="px-2 py-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Driver</span></th>
      case "next_address":
        return <th key={key} className="px-2 py-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Next Address</span></th>
      case "cut_off":
        return <th key={key} className="px-2 py-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Cut Off</span></th>
      case "ref_container":
        return <th key={key} className="px-2 py-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Ref Container #</span></th>
      case "delivery_city_state":
        return <th key={key} className="px-2 py-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Delivery City/State</span></th>
      case "container_return":
        return <th key={key} className="px-2 py-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Container Return</span></th>
      case "reset_routing":
        return <th key={key} className="px-2 py-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Reset Routing</span></th>
      case "change_status":
        return <th key={key} className="px-2 py-2"><span className="text-[10px] font-bold text-gray-400 uppercase">Change Status</span></th>
      default:
        // Use SortableHeader for sortable columns
        if (col.sortKey) {
          return <SortableHeader key={key} {...hp(col.label, col.sortKey)} />
        }
        return (
          <th key={key} className="px-2 py-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase">{col.label}</span>
          </th>
        )
    }
  }

  // Render a cell for a given column key and load
  const renderCell = (key: string, load: LoadWithRelations, idx: number) => {
    const sc = LOAD_STATUS_COLORS[load.status as LoadStatus] || { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" }
    const lfd = load.containers?.last_free_day || load.per_diem_free_day
    const lfdWarn = isLFDWarning(lfd || null, clientNow)

    // Derive next address based on status
    let nextAddress = "—"
    if (["Created", "Available", "Pending", "Assigned"].includes(load.status)) {
      nextAddress = load.pickup_location || "—"
    } else if (["Dispatched", "In Transit", "Arrived At Pickup"].includes(load.status)) {
      nextAddress = load.delivery_location || "—"
    } else if (["Delivered", "Arrived At Delivery"].includes(load.status)) {
      nextAddress = load.return_location || "—"
    }

    switch (key) {
      case "checkbox":
        return (
          <td key={key} className="px-2 py-2 w-8 sticky left-0 bg-[#111827] z-10">
            <input
              type="checkbox"
              checked={selectedLoads.has(load.id)}
              onChange={() => handleSelectLoad(load.id)}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/5"
            />
          </td>
        )
      case "rowNumber":
        return <td key={key} className="px-2 py-2.5 text-gray-500 w-6">{idx + 1}</td>
      case "reference_number":
        return (
          <td key={key} className="px-2 py-2.5">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedLoad(load) }}
              className="text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap"
            >
              {load.reference_number}
            </button>
          </td>
        )
      case "warning":
        return <td key={key} className="px-2 py-2.5 w-6 text-center">{getWarningIcon(load)}</td>
      case "status": {
        // Show active holds (only "hold" state, not "released" — released means cleared)
        const hasActiveHolds = load.customs_hold === "hold" || load.freight_hold === "hold"
        return (
          <td key={key} className="px-2 py-2.5">
            <div className="flex flex-col gap-0.5">
              {/* Always show the actual load status */}
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${sc.bg} ${sc.text} ${sc.border} whitespace-nowrap`}>
                {load.status}
              </span>
              {/* Show hold badges only when actively on hold */}
              {hasActiveHolds && (
                <div className="flex gap-1">
                  {load.customs_hold === "hold" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-red-500/10 text-red-400 border-red-500/20 whitespace-nowrap">
                      C: Hold
                    </span>
                  )}
                  {load.freight_hold === "hold" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border bg-red-500/10 text-red-400 border-red-500/20 whitespace-nowrap">
                      F: Hold
                    </span>
                  )}
                </div>
              )}
            </div>
          </td>
        )
      }
      case "driver_last_seen": {
        const lastSeenLabel = getDriverLastSeenLabel(load, clientNow)
        return (
          <td key={key} className="px-2 py-2.5 whitespace-nowrap">
            {lastSeenLabel ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedLoad(load)
                }}
                className="text-blue-400 hover:text-blue-300 text-[11px] font-medium"
                title="Open load detail — live map"
              >
                {lastSeenLabel}
              </button>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </td>
        )
      }
      case "driver":
        return (
          <td key={key} className="px-2 py-2.5">
            {load.drivers ? (
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-[#E8700A]/20 border border-[#E8700A]/40 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-[#E8700A]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <span className="text-gray-300 truncate max-w-[80px]">{load.drivers.name}</span>
              </div>
            ) : (
              <DriverAssignButton
                load={load}
                availableDrivers={availableDrivers}
                onAssigned={(driver) => {
                  // Optimistic update with driver info and Assigned status
                  const oldStatus = load.status
                  setLoadOverrides(prev => ({
                    ...prev,
                    [load.id]: { ...load, status: "Assigned", driver_id: driver.id, drivers: driver },
                  }))
                  // Emit toast for the status change
                  if (oldStatus !== "Assigned") {
                    emitStatusChangeEvent({
                      loadId: load.id,
                      referenceNumber: load.reference_number || "",
                      driverName: driver.name,
                      oldStatus,
                      newStatus: "Assigned",
                    })
                  }
                  // Re-fetch from server to get the canonical state
                  fetch(`/api/dispatcher/loads/${load.id}`)
                    .then(r => r.ok ? r.json() : null)
                    .then(updated => {
                      if (updated) {
                        setLoadOverrides(prev => ({ ...prev, [updated.id]: updated }))
                      }
                    })
                    .catch(() => {/* ignore, optimistic update already applied */})
                  // Trigger server-side data refresh for pipeline counts, etc.
                  router.refresh()
                }}
              />
            )}
          </td>
        )
      case "event1":
        return <EventCell key={key} event={getEventLabel(load, 1)} />
      case "event2":
        return <EventCell key={key} event={getEventLabel(load, 2)} />
      case "event3":
        return <EventCell key={key} event={getEventLabel(load, 3)} />
      case "container_number":
        return <td key={key} className="px-2 py-2.5 text-gray-300 font-mono whitespace-nowrap">{load.containers?.container_number || "—"}</td>
      case "ref_number":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.house_bol || load.mbol || "—"}</td>
      case "load_type":
        return <td key={key} className="px-2 py-2.5 text-gray-300 whitespace-nowrap">{load.load_type || "—"}</td>
      case "next_address":
        return <td key={key} className="px-2 py-2.5 text-gray-400 truncate max-w-[120px]">{nextAddress}</td>
      case "container_size": {
        const sizeVal = load.container_size || load.containers?.size || ""
        return <td key={key} className="px-2 py-2.5 text-gray-300 whitespace-nowrap">{sizeVal ? `${sizeVal}'` : "—"}</td>
      }
      case "pickup_apt_from":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(load.pickup_apt_from)}</td>
      case "lfd_erd":
        return (
          <td key={key} className={`px-2 py-2.5 whitespace-nowrap font-medium ${lfdWarn ? "text-orange-400 bg-orange-500/10" : "text-gray-400"}`}>
            {formatDate(lfd || null)}
          </td>
        )
      case "vessel_eta":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(load.vessel_eta)}</td>
      case "delivery_apt_from":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(load.delivery_apt_from)}</td>
      case "cut_off":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(load.outgate_date)}</td>
      case "per_diem_free_day":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{formatDate(load.per_diem_free_day)}</td>
      case "container_type":
        return <td key={key} className="px-2 py-2.5 text-gray-300 whitespace-nowrap">{load.container_type || load.containers?.type || "—"}</td>
      case "shipment_number":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.shipment_number || "—"}</td>
      case "customer":
        return <td key={key} className="px-2 py-2.5 text-gray-300 truncate max-w-[100px]">{load.customers?.name || "—"}</td>
      case "ssl":
        return <td key={key} className="px-2 py-2.5 text-gray-300 whitespace-nowrap">{load.ssl || "—"}</td>
      case "mbol":
        return <td key={key} className="px-2 py-2.5 text-gray-400 font-mono whitespace-nowrap">{load.mbol || "—"}</td>
      case "ref_container":
        return <td key={key} className="px-2 py-2.5 text-gray-400 font-mono whitespace-nowrap">{load.containers?.container_number || "—"}</td>
      case "chassis_number":
        return <td key={key} className="px-2 py-2.5 text-gray-300 font-mono whitespace-nowrap">{load.chassis_number || "—"}</td>
      case "total_weight":
        return <td key={key} className="px-2 py-2.5 text-gray-300 whitespace-nowrap">{load.total_weight ? Number(load.total_weight).toLocaleString() : "—"}</td>
      case "delivery_location":
        return (
          <td key={key} className="px-2 py-2.5">
            <div className="text-gray-300 truncate max-w-[120px]">{load.delivery_location || "—"}</div>
            {load.delivery_apt_from && (
              <div className="text-[10px] text-gray-500">{formatDateTime(load.delivery_apt_from)}</div>
            )}
          </td>
        )
      case "pickup_location":
        return (
          <td key={key} className="px-2 py-2.5">
            <div className="text-gray-300 truncate max-w-[120px]">{load.pickup_location || "—"}</div>
            {load.pickup_apt_from && (
              <div className="text-[10px] text-gray-500">{formatDateTime(load.pickup_apt_from)}</div>
            )}
          </td>
        )
      case "delivery_city_state":
        return <td key={key} className="px-2 py-2.5 text-gray-400 truncate max-w-[100px]">{load.delivery_location || "—"}</td>
      case "return_location":
        return <td key={key} className="px-2 py-2.5 text-gray-400 truncate max-w-[120px]">{load.return_location || "—"}</td>
      case "container_return":
        return <td key={key} className="px-2 py-2.5 text-gray-500">—</td>
      case "vessel_name":
        return <td key={key} className="px-2 py-2.5 text-gray-300 whitespace-nowrap truncate max-w-[120px]">{load.vessel_name || "—"}</td>
      case "route_template":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.route_template || "—"}</td>
      case "seal_number":
        return <td key={key} className="px-2 py-2.5 text-gray-400 font-mono whitespace-nowrap">{load.seal_number || "—"}</td>
      case "return_apt_from":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(load.return_apt_from)}</td>
      case "pickup_number":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.pickup_number || "—"}</td>
      case "return_number":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.return_number || "—"}</td>
      case "reset_routing":
        return (
          <td key={key} className="px-2 py-2.5 text-center">
            <button onClick={(e) => e.stopPropagation()} className="text-gray-500 hover:text-gray-300 text-[10px]">
              ↻ Reset<span className="text-red-500 ml-0.5 text-xs" title="Feature not yet implemented">*</span>
            </button>
          </td>
        )
      case "change_status":
        return <td key={key} className="px-2 py-2.5 text-gray-300 whitespace-nowrap uppercase text-[10px] font-medium">{load.status}</td>
      case "last_tracked":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{formatDateTime(load.last_tracked)}</td>
      case "genset_number":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.genset_number || "—"}</td>
      case "distance":
        return <td key={key} className="px-2 py-2.5 text-gray-300 whitespace-nowrap">{load.distance ? Number(load.distance).toFixed(2) : "—"}</td>
      case "csr":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.csr || "—"}</td>
      case "house_bol":
        return <td key={key} className="px-2 py-2.5 text-gray-400 font-mono whitespace-nowrap">{load.house_bol || "—"}</td>
      case "voyage":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.voyage || "—"}</td>
      case "purchase_order":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.purchase_order || "—"}</td>
      case "appointment_number":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.appointment_number || "—"}</td>
      case "reservation_number":
        return <td key={key} className="px-2 py-2.5 text-gray-400 whitespace-nowrap">{load.reservation_number || "—"}</td>
      default:
        return <td key={key} className="px-2 py-2.5 text-gray-500">—</td>
    }
  }

  // Render a filter cell for a column
  const renderFilterCell = (key: string) => {
    if (NON_FILTERABLE_COLUMNS.has(key)) {
      if (key === "checkbox") {
        return (
          <th key={`filter-${key}`} className="px-1 py-1 sticky left-0 bg-[#111827] z-10">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-[9px] text-[#E8700A] hover:text-[#FF8C21] whitespace-nowrap"
                title="Clear all filters"
              >
                ✕
              </button>
            )}
          </th>
        )
      }
      return <th key={`filter-${key}`} className="px-1 py-1" />
    }

    const options = columnOptions[key] || []
    const currentVal = columnFilters[key] || ""

    // Skip filter if column has no distinct values
    if (options.length === 0) {
      return <th key={`filter-${key}`} className="px-1 py-1" />
    }

    return (
      <th key={`filter-${key}`} className="px-1 py-1">
        <select
          value={currentVal}
          onChange={(e) => setFilter(key, e.target.value)}
          className={`w-full px-1 py-0.5 bg-white/5 border rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40 max-w-[130px] ${
            currentVal ? "border-[#E8700A]/40 text-[#FF8C21]" : "border-white/10 text-gray-400"
          }`}
        >
          <option value="">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </th>
    )
  }

  return (
    <>
      <div className="h-full">
        <table className="min-w-max text-xs">
          <thead className="sticky top-0 z-20 bg-[#111827]">
            <tr className="border-b border-white/10 bg-white/2">
              {orderedColumns.map(col => renderHeader(col.key))}
            </tr>
            {showColumnFilters && (
              <tr className="border-b border-white/5 bg-[#111827]">
                {orderedColumns.map(col => renderFilterCell(col.key))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={orderedColumns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                  {activeFilterCount > 0 ? `No loads match the active filters` : "No loads found"}
                </td>
              </tr>
            ) : (
              filteredData.map((load, idx) => (
                <tr
                  key={load.id}
                  className="hover:bg-white/3 transition-colors cursor-pointer"
                  onClick={() => setSelectedLoad(load)}
                >
                  {orderedColumns.map(col => renderCell(col.key, load, idx))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load Detail Panel (modal overlay) */}
      {selectedLoad && (
        <LoadDetailPanel
          load={selectedLoad}
          loads={loads}
          onClose={() => setSelectedLoad(null)}
          onUpdate={(updated) => {
            setSelectedLoad(updated)
            setLoadOverrides(prev => ({ ...prev, [updated.id]: updated }))
            // Trigger server refresh for pipeline counts and other derived data
            router.refresh()
          }}
          onNavigate={(load) => setSelectedLoad(load)}
        />
      )}
    </>
  )
}
