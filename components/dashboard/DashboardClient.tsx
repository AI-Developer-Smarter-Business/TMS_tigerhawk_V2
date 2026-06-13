// components/dashboard/DashboardClient.tsx
// Client component that renders configurable dashboard modules
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDashboardModules } from "@/hooks/useDashboardModules"
import { MODULE_REGISTRY, DashboardModuleId } from "@/types/dashboard-modules"
import { ModulePickerPanel } from "./ModulePickerPanel"
import { PerDiemLfdModule } from "./PerDiemLfdModule"
import { HoldsModule } from "./HoldsModule"
import { AppointmentsModule } from "./AppointmentsModule"
import { ArAgingModule } from "./ArAgingModule"
import { LoadPipelineModule } from "./LoadPipelineModule"
import { DriverSummaryModule } from "./DriverSummaryModule"
import { RecentShipmentsModule } from "./RecentShipmentsModule"
import { IncomingVesselsModule } from "./IncomingVesselsModule"
import { WarehouseSummaryModule } from "./WarehouseSummaryModule"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"

// ─── Data types passed from server ──────────────────────────
export interface DashboardData {
  role: string
  userName: string
  stats: {
    activeShipments: number
    newToday: number
    vesselCount: number
    arrivingToday: number
    availableContainers: number
    demurrageAlerts: number
  }
  // Module data
  perDiemLoads: Array<{
    id: string
    reference_number: string
    per_diem_free_day: string | null
    container_number: string | null
    container_lfd: string | null
    customer_name: string | null
    status: string
  }>
  holdLoads: Array<{
    id: string
    reference_number: string
    container_number: string | null
    customer_name: string | null
    freight_hold: string
    customs_hold: string
    terminal_hold: string
    fees_hold: string
    carrier_hold: boolean
    other_hold: string
  }>
  appointmentLoads: Array<{
    id: string
    reference_number: string
    container_number: string | null
    customer_name: string | null
    driver_name: string | null
    pickup_apt_from: string | null
    pickup_apt_to: string | null
    delivery_apt_from: string | null
    delivery_apt_to: string | null
    return_apt_from: string | null
    return_apt_to: string | null
    status: string
  }>
  arInvoices: Array<{
    id: string
    invoice_number: string
    customer_name: string | null
    amount: number
    amount_paid: number
    due_date: string | null
    billing_status: string
  }>
  statusCounts: Record<string, number>
  drivers: Array<{ id: string; name: string; status: string }>
  recentShipments: Array<{
    id: string
    reference_number: string
    status: string
    customers: { name: string } | null
    containers: { container_number: string } | null
    drivers: { name: string } | null
  }>
  vessels: Array<{
    id: string
    name: string
    terminal: string
    eta: string | null
    shipping_line: string | null
  }>
  warehouse: {
    totalPallets: number
    capacity: number
    pendingTransloads: number
    outboundToday: number
    inboundExpected: number
  }
}

interface DashboardClientProps {
  data: DashboardData
}

function StatCard({
  title,
  value,
  change,
  changeType,
  icon,
}: {
  title: string
  value: string
  change: string
  changeType: "up" | "down" | "neutral" | "warning"
  icon: React.ReactNode
}) {
  const changeColors = {
    up: "text-emerald-400 bg-emerald-400/10",
    down: "text-red-400 bg-red-400/10",
    neutral: "text-blue-400 bg-blue-400/10",
    warning: "text-amber-400 bg-amber-400/10",
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-white/5 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-400">{title}</span>
        <div className="p-2 bg-[#E8700A]/10 rounded-lg text-[#E8700A]">
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <span className="text-3xl font-bold text-white">{value}</span>
      </div>
      <div className="mt-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${changeColors[changeType]}`}
        >
          {change}
        </span>
      </div>
    </div>
  )
}

export function DashboardClient({ data }: DashboardClientProps) {
  const router = useRouter()
  const isStaff = data.role === "admin" || data.role === "dispatcher"
  const [pickerOpen, setPickerOpen] = useState(false)
  const refreshDashboard = useCallback(() => {
    router.refresh()
  }, [router])

  useRealtimeRefresh({
    tables: ["loads", "containers", "vessels", "activity_log"],
    onRefresh: refreshDashboard,
  })

  const {
    layout,
    enabledModules,
    loading: modulesLoading,
    saving,
    toggleModule,
    reorderModules,
  } = useDashboardModules(isStaff)

  // ─── Render a single module by ID ─────────────────────────
  function renderModule(id: DashboardModuleId) {
    switch (id) {
      case "per_diem_lfd":
        return <PerDiemLfdModule loads={data.perDiemLoads} />
      case "holds":
        return <HoldsModule loads={data.holdLoads} />
      case "appointments":
        return <AppointmentsModule loads={data.appointmentLoads} />
      case "ar_aging":
        return <ArAgingModule invoices={data.arInvoices} />
      case "load_pipeline":
        return <LoadPipelineModule statusCounts={data.statusCounts} />
      case "driver_summary":
        return <DriverSummaryModule drivers={data.drivers} />
      case "recent_shipments":
        return (
          <RecentShipmentsModule
            shipments={data.recentShipments}
            isDriver={data.role === "driver"}
          />
        )
      case "incoming_vessels":
        return <IncomingVesselsModule vessels={data.vessels} />
      case "warehouse_summary":
        return <WarehouseSummaryModule warehouse={data.warehouse} />
      default:
        return null
    }
  }

  // ─── Determine grid column span for a module ──────────────
  function getModuleColSpan(id: DashboardModuleId): string {
    const def = MODULE_REGISTRY.find((m) => m.id === id)
    if (!def) return ""
    if (def.size === "large") return "lg:col-span-2"
    return ""
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-400">
            Overview of your drayage operations
          </p>
        </div>
        <div className="flex gap-2">
          {isStaff && (
            <button
              onClick={() => setPickerOpen(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-2"
              aria-label="Configure dashboard modules"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
              Customize
            </button>
          )}
          {isStaff && (
            <a
              href="/dashboard/shipments/new"
              className="px-4 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors shadow-lg shadow-[#E8700A]/20"
            >
              + New Shipment
            </a>
          )}
        </div>
      </div>

      {/* Stats Grid — always visible */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Shipments"
          value={String(data.stats.activeShipments)}
          change={`+${data.stats.newToday} today`}
          changeType="up"
          icon={
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
                d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
              />
            </svg>
          }
        />
        {isStaff && (
          <StatCard
            title="Vessels This Week"
            value={String(data.stats.vesselCount)}
            change={`${data.stats.arrivingToday} arriving today`}
            changeType="neutral"
            icon={
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
                  d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21V3m0 0a3 3 0 1 0 0 6m0-6a3 3 0 1 1 0 6m0 0v12m8.716-6.747a9 9 0 0 0 .284-2.253c0-.113-.002-.225-.006-.337M3.284 14.253A9 9 0 0 1 3 12c0-.113.002-.225.006-.337"
                />
              </svg>
            }
          />
        )}
        {isStaff && (
          <StatCard
            title="Available Containers"
            value={String(data.stats.availableContainers)}
            change="Ready for pickup"
            changeType="up"
            icon={
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
                  d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
                />
              </svg>
            }
          />
        )}
        {isStaff && (
          <StatCard
            title="Demurrage Alerts"
            value={String(data.stats.demurrageAlerts)}
            change={
              data.stats.demurrageAlerts > 0 ? "Action needed" : "All clear"
            }
            changeType={data.stats.demurrageAlerts > 0 ? "warning" : "up"}
            icon={
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
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            }
          />
        )}
      </div>

      {/* Configurable modules grid */}
      {!modulesLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {enabledModules.map((mod) => (
            <div key={mod.id} className={getModuleColSpan(mod.id)}>
              {renderModule(mod.id)}
            </div>
          ))}
        </div>
      )}

      {modulesLoading && (
        <div className="text-center py-12 text-sm text-gray-500">
          Loading dashboard modules...
        </div>
      )}

      {/* Module picker panel */}
      <ModulePickerPanel
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        layout={layout}
        onToggle={toggleModule}
        onReorder={reorderModules}
        saving={saving}
      />
    </div>
  )
}
