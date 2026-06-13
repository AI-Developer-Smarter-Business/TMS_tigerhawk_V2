"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { LoadWithRelations, LoadDocument, LoadStatus, LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { LoadSidebarMap } from "@/components/maps/LoadSidebarMap"
import { createClient } from "@/lib/supabase/client"
import { LoadInfoTab } from "./tabs/LoadInfoTab"
import { BillingTab } from "./tabs/BillingTab"
import { DocumentsTab } from "./tabs/DocumentsTab"
import { PaymentsTab } from "./tabs/PaymentsTab"
import { RoutingTab } from "./tabs/RoutingTab"
import { DriverPayTab } from "./tabs/DriverPayTab"
import { TrackingTab } from "./tabs/TrackingTab"
import { MessagingTab } from "./tabs/MessagingTab"
import { AuditTab } from "./tabs/AuditTab"
import { NotesTab } from "./tabs/NotesTab"
import { DocumentGenerationModal } from "./DocumentGenerationModal"
import { DriverActionPanel } from "./DriverActionPanel"
import { DeliveryWaitTimerPanel } from "./DeliveryWaitTimerPanel"
import { AssignDriverModal } from "../modals/AssignDriverModal"
import { getActiveHoldKeys } from "@/lib/loadHolds"
import { useUserRole } from "@/lib/auth/useUserRole"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"
import { isDriverUploadDocument } from "@/lib/load-documents/enrich"

type TabType = "info" | "billing" | "documents" | "payments" | "routing" | "driver-pay" | "tracking" | "messaging" | "audit" | "notes"

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: "info", label: "Load Info", icon: "📋" },
  { id: "billing", label: "Billing", icon: "💰" },
  { id: "documents", label: "Documents", icon: "📄" },
  { id: "payments", label: "Payments & Credits", icon: "💳" },
  { id: "routing", label: "Routing", icon: "🗺️" },
  { id: "driver-pay", label: "Driver Pay & Expenses", icon: "👤" },
  { id: "tracking", label: "Tracking", icon: "📍" },
  { id: "messaging", label: "Messaging", icon: "💬" },
  { id: "audit", label: "Audit", icon: "📝" },
  { id: "notes", label: "Notes", icon: "📌" },
]

type LoadDetailPanelProps = {
  load: LoadWithRelations
  loads: LoadWithRelations[]
  onClose: () => void
  onUpdate: (load: LoadWithRelations) => void
  onNavigate: (load: LoadWithRelations) => void
}

type OrgAddress = {
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

export function LoadDetailPanel({ load, loads, onClose, onUpdate, onNavigate }: LoadDetailPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const waitTimeMockMode =
    searchParams.get("waitMock") === "1" ||
    process.env.NEXT_PUBLIC_WAIT_TIME_MOCK === "1"
  const { role, loading: roleLoading } = useUserRole()
  const [activeTab, setActiveTab] = useState<TabType>("info")
  const [loadData, setLoadData] = useState(load)
  const [isSaving, setIsSaving] = useState(false)
  const [sidebarDocs, setSidebarDocs] = useState<LoadDocument[]>([])
  const [orgAddresses, setOrgAddresses] = useState<Record<string, OrgAddress>>({})
  const [orgAddressesReady, setOrgAddressesReady] = useState(false)
  const [routeDistance, setRouteDistance] = useState<number | null>(null)
  const distanceSavedRef = useRef(false)
  const [showDocModal, setShowDocModal] = useState(false)
  const [sidebarFreight, setSidebarFreight] = useState<{ commodity: string; description: string; pieces: number; weight_lbs: number; pallets: number }[]>([])
  const [showAssignDriver, setShowAssignDriver] = useState(false)
  const [availableDrivers, setAvailableDrivers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    setLoadData(load)
    distanceSavedRef.current = false // Reset on load change so distance re-saves for new load
  }, [load])

  // Save OSRM-calculated distance to loads.distance for rate calculations
  const handleDistanceCalculated = useCallback(async (totalMiles: number) => {
    setRouteDistance(totalMiles)
    // Only save once per load view (avoid re-saving on every re-render)
    // Use ref instead of state to avoid changing the callback identity
    if (!distanceSavedRef.current && totalMiles > 0) {
      try {
        const res = await fetch(`/api/dispatcher/loads/${load.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ distance: totalMiles }),
        })
        if (res.ok) {
          distanceSavedRef.current = true
        }
        // If PATCH fails, leave ref false so a later recalculation can retry
      } catch {
        // Non-fatal: distance display still works, just won't be saved for rate calc
      }
    }
  }, [load.id])

  // Fetch freight descriptions for sidebar — re-fetch when loadData changes (e.g. after save)
  const fetchSidebarFreight = useCallback(async () => {
    try {
      const res = await fetch(`/api/dispatcher/loads/${load.id}/freight`)
      if (res.ok) {
        const data = await res.json()
        setSidebarFreight(
          (data.freight || []).filter((r: { commodity?: string; description?: string }) => r.commodity || r.description)
        )
      }
    } catch { /* silent */ }
  }, [load.id])

  useEffect(() => {
    fetchSidebarFreight()
  }, [fetchSidebarFreight])

  // Also re-fetch freight when user switches tabs (freight is saved inside LoadInfoTab)
  useEffect(() => {
    if (activeTab !== "info") {
      fetchSidebarFreight()
    }
  }, [activeTab, fetchSidebarFreight])

  // Resolve location names to full addresses from org tables
  const resolveOrgAddresses = useCallback(async () => {
    setOrgAddressesReady(false)
    const locationNames = [
      loadData.pickup_location,
      loadData.delivery_location,
      loadData.return_location,
    ].filter((loc): loc is string => !!loc)

    if (locationNames.length === 0) {
      setOrgAddressesReady(true)
      return
    }

    const supabase = createClient()
    const resolved: Record<string, OrgAddress> = {}

    // Search across all 4 org tables
    const tables = ["customers", "terminals", "warehouses", "yards"] as const
    for (const table of tables) {
      const { data } = await supabase
        .from(table)
        .select("name, address, city, state, zip_code")
        .in("name", locationNames)

      if (data) {
        for (const row of data) {
          if (!resolved[row.name]) {
            resolved[row.name] = row as OrgAddress
          }
        }
      }
    }

    setOrgAddresses(resolved)
    setOrgAddressesReady(true)
  }, [loadData.pickup_location, loadData.delivery_location, loadData.return_location])

  useEffect(() => {
    resolveOrgAddresses()
  }, [resolveOrgAddresses])

  const fetchSidebarDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/dispatcher/loads/${load.id}/documents`, {
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        setSidebarDocs(data.documents || [])
      }
    } catch { /* silent */ }
  }, [load.id])

  useEffect(() => {
    fetchSidebarDocs()
  }, [fetchSidebarDocs])

  useRealtimeRefresh({
    tables: ["load_documents"],
    onRefresh: () => {
      void fetchSidebarDocs()
    },
    debounceMs: 300,
  })

  // Build full address string for map geocoding
  const buildFullAddress = (locationName: string | null) => {
    if (!locationName) return null
    const org = orgAddresses[locationName]
    if (org?.address) {
      const parts = [org.address, org.city, org.state, org.zip_code].filter(Boolean)
      return parts.join(", ")
    }
    return locationName // fallback to org name for geocoding
  }

  const statusColor = LOAD_STATUS_COLORS[loadData.status as keyof typeof LOAD_STATUS_COLORS] || {
    bg: "bg-gray-500/10",
    text: "text-gray-400",
    border: "border-gray-500/20",
  }

  const sidebarActiveHolds = getActiveHoldKeys({
    freight_hold: loadData.freight_hold,
    customs_hold: loadData.customs_hold,
    terminal_hold: loadData.terminal_hold,
    fees_hold: loadData.fees_hold,
    other_hold: loadData.other_hold,
    carrier_hold: loadData.carrier_hold,
  })
  const assignBlockedByHolds =
    sidebarActiveHolds.length > 0 && !roleLoading && role !== "admin"

  // Open driver assignment modal — fetch drivers list first
  const handleOpenAssignDriver = async () => {
    if (assignBlockedByHolds) return
    try {
      const supabase = createClient()
      const { data: drivers } = await supabase
        .from("drivers")
        .select("id, name, status")
        .not("status", "in", '("Inactive","Terminated")')
        .order("name")

      setAvailableDrivers(
        (drivers || []).map((d) => ({ id: d.id, name: `${d.name}${d.status !== "Available" ? ` (${d.status})` : ""}` }))
      )
      setShowAssignDriver(true)
    } catch {
      /* silent */
    }
  }

  const handleAssignDriver = async (driverId: string) => {
    const res = await fetch(`/api/dispatcher/loads/${loadData.id}/assign-driver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_id: driverId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const msg =
        data.code === "ACTIVE_HOLDS" && Array.isArray(data.activeHolds)
          ? `${data.error || "Hold active"} (${data.activeHolds.join(", ")})`
          : data.error || "Failed to assign driver"
      throw new Error(msg)
    }
    const updated = await res.json()
    setLoadData(updated)
    onUpdate(updated)
    router.refresh()
  }

  const handleSave = async (updates: Partial<LoadWithRelations>) => {
    setIsSaving(true)
    try {
      console.log("[LoadDetailPanel] PATCH payload:", JSON.stringify(updates, null, 2))

      const doPatch = async () => {
        const response = await fetch(`/api/dispatcher/loads/${loadData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        return response
      }

      let response = await doPatch()

      // Retry once on 401 — session cookie may have been refreshed by a concurrent request
      if (response.status === 401) {
        console.log("[LoadDetailPanel] Got 401, retrying after delay...")
        await new Promise((r) => setTimeout(r, 600))
        response = await doPatch()
      }

      if (response.ok) {
        const updated = await response.json()
        console.log("[LoadDetailPanel] PATCH success, containers:", JSON.stringify(updated.containers), "container_id:", updated.container_id)
        setLoadData(updated)
        onUpdate(updated)
      } else {
        let errBody: Record<string, unknown> = {}
        try {
          errBody = await response.json()
        } catch {
          // Keep structured fallback for non-JSON bodies.
          errBody = {}
        }
        const fallbackError = response.statusText || "Request failed"
        const errorMessage =
          typeof errBody.error === "string"
            ? errBody.error
            : typeof errBody.message === "string"
              ? errBody.message
              : fallbackError
        console.error("[LoadDetailPanel] PATCH failed:", {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          details: errBody.details ?? errBody,
        })
      }
    } catch (error) {
      console.error("[LoadDetailPanel] PATCH error:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete load with confirmation
  const [confirmDelete, setConfirmDelete] = useState(false)
  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    try {
      const response = await fetch(`/api/dispatcher/loads/${loadData.id}`, { method: "DELETE" })
      if (response.ok) {
        onClose()
        // Trigger a page-level refresh so the load list updates
        router.refresh()
      } else {
        const err = await response.json()
        alert(err.error || "Failed to delete load")
      }
    } catch (error) {
      console.error("Failed to delete load:", error)
      alert("Failed to delete load")
    } finally {
      setConfirmDelete(false)
    }
  }

  // Open document generation modal
  const handlePrint = () => {
    setShowDocModal(true)
  }

  // Duplicate load
  const handleDuplicate = async () => {
    try {
      const response = await fetch("/api/dispatcher/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: loadData.customer_id,
          load_type: loadData.load_type,
          pickup_location: loadData.pickup_location,
          delivery_location: loadData.delivery_location,
          return_location: loadData.return_location,
          pickup_apt_from: loadData.pickup_apt_from,
          pickup_apt_to: loadData.pickup_apt_to,
          delivery_apt_from: loadData.delivery_apt_from,
          delivery_apt_to: loadData.delivery_apt_to,
          return_apt_from: loadData.return_apt_from,
          return_apt_to: loadData.return_apt_to,
          rate: loadData.rate,
          notes: loadData.notes,
          is_hazmat: loadData.is_hazmat,
          is_hot: loadData.is_hot,
          is_overweight: loadData.is_overweight,
          is_oog: loadData.is_oog,
          is_street_turn: loadData.is_street_turn,
          is_tanker: loadData.is_tanker,
          is_bonded: loadData.is_bonded,
          is_liquor: loadData.is_liquor,
          is_ev: loadData.is_ev,
          is_double: loadData.is_double,
          is_genset: loadData.is_genset,
          is_scale: loadData.is_scale,
        }),
      })
      if (response.ok) {
        const newLoad = await response.json()
        onNavigate(newLoad)
      }
    } catch (error) {
      console.error("Failed to duplicate load:", error)
    }
  }

  // Navigate to previous/next load (sorted alphabetically by reference_number)
  const sortedLoads = [...loads].sort((a, b) => a.reference_number.localeCompare(b.reference_number))
  const currentIndex = sortedLoads.findIndex((l) => l.id === loadData.id)
  const prevLoad = currentIndex > 0 ? sortedLoads[currentIndex - 1] : null
  const nextLoad = currentIndex < sortedLoads.length - 1 ? sortedLoads[currentIndex + 1] : null

  const renderTabContent = () => {
    const tabProps = { load: loadData, onUpdate: handleSave }

    switch (activeTab) {
      case "info":
        return <LoadInfoTab {...tabProps} />
      case "billing":
        return <BillingTab {...tabProps} />
      case "documents":
        return (
          <DocumentsTab
            load={loadData}
            onUpdate={handleSave}
            onDocumentsChange={fetchSidebarDocs}
          />
        )
      case "payments":
        return <PaymentsTab {...tabProps} />
      case "routing":
        return <RoutingTab {...tabProps} />
      case "driver-pay":
        return <DriverPayTab {...tabProps} />
      case "tracking":
        return <TrackingTab {...tabProps} />
      case "messaging":
        return <MessagingTab {...tabProps} />
      case "audit":
        return <AuditTab {...tabProps} />
      case "notes":
        return <NotesTab {...tabProps} />
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-end overflow-hidden">
      <div className="h-full w-full bg-[#0F1724] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">
              Load #: <span className="font-mono text-[#FF8C21]">{loadData.reference_number}</span>
            </h2>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
              {loadData.status}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-300 transition-colors"
              title="Print"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
            <button
              onClick={handleDuplicate}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-300 transition-colors"
              title="Duplicate Load"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              onBlur={() => setConfirmDelete(false)}
              className={`p-2 rounded-lg transition-colors ${
                confirmDelete
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 ring-1 ring-red-500/40"
                  : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-300"
              }`}
              title={confirmDelete ? "Click again to confirm deletion" : "Delete"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button
              onClick={() => prevLoad && onNavigate(prevLoad)}
              disabled={!prevLoad}
              className={`p-2 rounded-lg bg-white/5 transition-colors ${prevLoad ? "hover:bg-white/10 text-gray-400 hover:text-gray-300" : "text-gray-600 cursor-not-allowed"}`}
              title="Previous Load"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => nextLoad && onNavigate(nextLoad)}
              disabled={!nextLoad}
              className={`p-2 rounded-lg bg-white/5 transition-colors ${nextLoad ? "hover:bg-white/10 text-gray-400 hover:text-gray-300" : "text-gray-600 cursor-not-allowed"}`}
              title="Next Load"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-300 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content area with sidebar and tabs */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar */}
          <div className="w-80 border-r border-white/5 bg-[#111827] overflow-y-auto flex-shrink-0">
            <div className="p-4 space-y-5">
              {/* Customer */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Customer</h4>
                <div className="text-sm">
                  <p className="text-white font-medium">{loadData.customers?.name || "—"}</p>
                  {loadData.customers?.address && (
                    <div className="mt-1 text-[11px] text-gray-400 leading-snug">
                      <p>{loadData.customers.address}</p>
                      <p>
                        {[loadData.customers.city, loadData.customers.state].filter(Boolean).join(", ")}
                        {loadData.customers.zip_code ? ` ${loadData.customers.zip_code}` : ""}
                      </p>
                    </div>
                  )}
                  {loadData.customers?.email && (
                    <p className="text-gray-400 text-xs mt-1">{loadData.customers.email}</p>
                  )}
                  {loadData.customers?.phone && (
                    <p className="text-gray-400 text-xs mt-0.5">{loadData.customers.phone}</p>
                  )}
                </div>
              </div>

              {/* Route Map */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Route</h4>
                  {routeDistance !== null && (
                    <span className="text-xs font-medium text-gray-400">{routeDistance} mi</span>
                  )}
                </div>
                {orgAddressesReady && (loadData.pickup_location || loadData.delivery_location) ? (
                  <LoadSidebarMap
                    pickupLocation={buildFullAddress(loadData.pickup_location)}
                    deliveryLocation={buildFullAddress(loadData.delivery_location)}
                    returnLocation={buildFullAddress(loadData.return_location)}
                    onDistanceCalculated={handleDistanceCalculated}
                  />
                ) : orgAddressesReady ? (
                  <div className="h-[80px] bg-white/5 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-gray-500">No locations set</span>
                  </div>
                ) : (
                  <div className="h-[160px] bg-white/5 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-gray-500">Loading map...</span>
                  </div>
                )}
                {/* Map Legend */}
                <div className="flex items-center gap-3 mt-2">
                  {loadData.pickup_location && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Pickup
                    </span>
                  )}
                  {loadData.delivery_location && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="w-2 h-2 rounded-full bg-[#E8700A] inline-block" />Delivery
                    </span>
                  )}
                  {loadData.return_location && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />Return
                    </span>
                  )}
                </div>
              </div>

              {/* Pick Up */}
              <div className="bg-white/[0.03] rounded-lg p-3">
                <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Pick Up
                </h4>
                <p className="text-sm text-white font-medium leading-snug">{loadData.pickup_location || "—"}</p>
                {loadData.pickup_location && orgAddresses[loadData.pickup_location]?.address && (
                  <div className="mt-1 text-[11px] text-gray-400 leading-snug">
                    <p>{orgAddresses[loadData.pickup_location].address}</p>
                    <p>
                      {[orgAddresses[loadData.pickup_location].city, orgAddresses[loadData.pickup_location].state].filter(Boolean).join(", ")}
                      {orgAddresses[loadData.pickup_location].zip_code ? ` ${orgAddresses[loadData.pickup_location].zip_code}` : ""}
                    </p>
                  </div>
                )}
                {(loadData.pickup_apt_from || loadData.pickup_apt_to) && (
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    Appt: {loadData.pickup_apt_from ? new Date(loadData.pickup_apt_from).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    {" → "}
                    {loadData.pickup_apt_to ? new Date(loadData.pickup_apt_to).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                  </p>
                )}
              </div>

              {/* Delivery */}
              <div className="bg-white/[0.03] rounded-lg p-3">
                <h4 className="text-xs font-semibold text-[#FF8C21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#E8700A] inline-block" />
                  Delivery
                </h4>
                <p className="text-sm text-white font-medium leading-snug">{loadData.delivery_location || "—"}</p>
                {loadData.delivery_location && orgAddresses[loadData.delivery_location]?.address && (
                  <div className="mt-1 text-[11px] text-gray-400 leading-snug">
                    <p>{orgAddresses[loadData.delivery_location].address}</p>
                    <p>
                      {[orgAddresses[loadData.delivery_location].city, orgAddresses[loadData.delivery_location].state].filter(Boolean).join(", ")}
                      {orgAddresses[loadData.delivery_location].zip_code ? ` ${orgAddresses[loadData.delivery_location].zip_code}` : ""}
                    </p>
                  </div>
                )}
                {(loadData.delivery_apt_from || loadData.delivery_apt_to) && (
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    Appt: {loadData.delivery_apt_from ? new Date(loadData.delivery_apt_from).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    {" → "}
                    {loadData.delivery_apt_to ? new Date(loadData.delivery_apt_to).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                  </p>
                )}
              </div>

              <DeliveryWaitTimerPanel
                loadId={loadData.id}
                referenceNumber={loadData.reference_number || ""}
                currentStatus={loadData.status as LoadStatus}
                driverName={loadData.drivers?.name || null}
                deliveryLocation={loadData.delivery_location}
                actualDeliveryIso={loadData.actual_delivery}
                mockMode={waitTimeMockMode}
              />

              {/* Return */}
              <div className="bg-white/[0.03] rounded-lg p-3">
                <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                  Return
                </h4>
                <p className="text-sm text-white font-medium leading-snug">{loadData.return_location || "—"}</p>
                {loadData.return_location && orgAddresses[loadData.return_location]?.address && (
                  <div className="mt-1 text-[11px] text-gray-400 leading-snug">
                    <p>{orgAddresses[loadData.return_location].address}</p>
                    <p>
                      {[orgAddresses[loadData.return_location].city, orgAddresses[loadData.return_location].state].filter(Boolean).join(", ")}
                      {orgAddresses[loadData.return_location].zip_code ? ` ${orgAddresses[loadData.return_location].zip_code}` : ""}
                    </p>
                  </div>
                )}
                {(loadData.return_apt_from || loadData.return_apt_to) && (
                  <p className="text-[10px] text-gray-500 mt-1.5">
                    Appt: {loadData.return_apt_from ? new Date(loadData.return_apt_from).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                    {" → "}
                    {loadData.return_apt_to ? new Date(loadData.return_apt_to).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                  </p>
                )}
              </div>

              {/* Documents Quick Links */}
              <div className="border-t border-white/5 pt-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Documents
                  {sidebarDocs.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-gray-500">{sidebarDocs.length}</span>
                  )}
                </h4>
                {sidebarDocs.length === 0 ? (
                  <p className="text-xs text-gray-500">No documents uploaded</p>
                ) : (
                  <div className="space-y-1.5">
                    {sidebarDocs.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 text-xs transition-colors group rounded px-1 py-0.5 ${
                          isDriverUploadDocument(doc)
                            ? "text-[#FF8C21] bg-[#E8700A]/10 hover:bg-[#E8700A]/15"
                            : "text-gray-300 hover:text-[#FF8C21]"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#E8700A] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{doc.filename}</span>
                        <span className="ml-auto text-[10px] text-gray-500 flex-shrink-0">{doc.document_type}</span>
                      </a>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setActiveTab("documents")}
                  className="mt-2 text-[10px] text-[#E8700A] hover:text-[#FF8C21] transition-colors"
                >
                  {sidebarDocs.length > 0 ? "Manage documents →" : "Upload documents →"}
                </button>
              </div>

              {/* Load Info Summary */}
              <div className="border-t border-white/5 pt-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Load Summary</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Container #:</span>
                    <span className="text-gray-300 font-mono">{loadData.containers?.container_number || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">BOL #:</span>
                    <span className="text-gray-300 font-mono">{loadData.mbol || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chassis #:</span>
                    <span className="text-gray-300 font-mono">{loadData.chassis_number || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">SSL:</span>
                    <span className="text-gray-300 font-mono">{loadData.ssl || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Size:</span>
                    <span className="text-gray-300">{loadData.container_size || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Weight:</span>
                    <span className="text-gray-300">
                      {loadData.total_weight
                        ? `${Number(loadData.total_weight).toLocaleString()} lbs`
                        : sidebarFreight.length > 0 && sidebarFreight.some(f => f.weight_lbs > 0)
                          ? `${sidebarFreight.reduce((s, f) => s + (f.weight_lbs || 0), 0).toLocaleString()} lbs`
                          : "—"
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="text-gray-300">{loadData.load_type || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Commodity:</span>
                    <span className="text-gray-300">{loadData.commodity || (sidebarFreight.length > 0 ? sidebarFreight.map(f => f.commodity).filter(Boolean).join(", ") : "—")}</span>
                  </div>
                  {sidebarFreight.length > 0 && sidebarFreight.some(f => f.description) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Freight:</span>
                      <span className="text-gray-300 text-right text-[11px]">{sidebarFreight.map(f => f.description).filter(Boolean).join(", ") || "—"}</span>
                    </div>
                  )}
                  {sidebarFreight.length > 0 && sidebarFreight.some(f => f.pieces > 0 || f.pallets > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pcs / Plt:</span>
                      <span className="text-gray-300">
                        {sidebarFreight.reduce((s, f) => s + (f.pieces || 0), 0)} pcs / {sidebarFreight.reduce((s, f) => s + (f.pallets || 0), 0)} plt
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Driver:</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-gray-300">{loadData.drivers?.name || "—"}</span>
                      <button
                        type="button"
                        onClick={handleOpenAssignDriver}
                        disabled={assignBlockedByHolds}
                        className={`text-[10px] transition-colors px-1.5 py-0.5 rounded ${
                          assignBlockedByHolds
                            ? "text-gray-500 bg-white/5 cursor-not-allowed opacity-60"
                            : "text-[#E8700A] hover:text-[#FF8C21] bg-[#E8700A]/10 hover:bg-[#E8700A]/20"
                        }`}
                        title={
                          assignBlockedByHolds
                            ? "Release active holds before assigning or reassigning a driver (admins may still assign)."
                            : loadData.drivers
                              ? "Reassign Driver"
                              : "Assign Driver"
                        }
                      >
                        {loadData.drivers ? "Reassign" : "Assign"}
                      </button>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created:</span>
                    <span className="text-gray-300 text-[10px]">
                      {loadData.created_at ? new Date(loadData.created_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  {loadData.containers?.ph_synced_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Port Synced:</span>
                      <span className="text-gray-300 text-[10px]">
                        {new Date(loadData.containers.ph_synced_at).toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  {loadData.containers?.transit_state && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Port Status:</span>
                      <span className="text-gray-300 text-[10px]">
                        {({ S10_ADVISED: "Advised", S20_INBOUND: "Inbound", S30_ECIN: "Gate In", S40_YARD: "In Yard", S50_ECOUT: "Gate Out", S60_LOADED: "Loaded", S70_DEPARTED: "Departed" } as Record<string, string>)[loadData.containers.transit_state] || loadData.containers.transit_state}
                      </span>
                    </div>
                  )}
                  {loadData.containers?.vessels && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Vessel:</span>
                      <span className="text-gray-300 text-[10px]">
                        {loadData.containers.vessels.name}
                        {loadData.containers.vessels.eta && (
                          <span className="text-gray-500 ml-1">
                            (ETA {new Date(loadData.containers.vessels.eta).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Driver Action Panel — status transition buttons */}
              <DriverActionPanel
                loadId={loadData.id}
                referenceNumber={loadData.reference_number || ""}
                currentStatus={loadData.status as LoadStatus}
                driverName={loadData.drivers?.name || null}
                activeHolds={sidebarActiveHolds}
                onStatusChanged={() => {
                  // Re-fetch load to reflect the new status
                  fetch(`/api/dispatcher/loads/${loadData.id}`)
                    .then((r) => r.ok ? r.json() : null)
                    .then((updated) => {
                      if (updated) {
                        setLoadData(updated)
                        onUpdate(updated)
                      }
                    })
                    .catch(() => {/* ignore */})
                  // Also trigger a server-side data refresh so the table re-renders
                  router.refresh()
                }}
              />
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab navigation */}
            <div className="border-b border-white/5 bg-[#0F1724] overflow-x-auto flex-shrink-0">
              <div className="flex gap-1 px-6 py-4">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap px-4 py-2 rounded-t-lg border-b-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "border-[#E8700A] text-white bg-white/5"
                        : "border-transparent text-gray-500 hover:text-gray-400"
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto bg-[#0F1724] p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Document Generation Modal */}
      {showDocModal && (
        <DocumentGenerationModal
          load={loadData}
          orgAddresses={orgAddresses}
          onClose={() => setShowDocModal(false)}
          onSwitchToDocumentsTab={() => setActiveTab("documents")}
        />
      )}

      {/* Assign/Reassign Driver Modal */}
      <AssignDriverModal
        isOpen={showAssignDriver}
        onClose={() => setShowAssignDriver(false)}
        onAssign={handleAssignDriver}
        availableDrivers={availableDrivers}
        shipmentReference={loadData.reference_number}
      />
    </div>
  )
}
