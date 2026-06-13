// components/dispatcher/DispatcherClient.tsx
"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PipelineCards } from "./PipelineCards"
import { DaySelector } from "./DaySelector"
import { RotationStatus } from "./RotationStatus"
import { LoadFilters } from "./LoadFilters"
import { LoadsTable } from "./LoadsTable"
import { ColumnConfigModal } from "./ColumnConfigModal"
import { QuickAddLoad } from "./QuickAddLoad"
import { DispatcherAlerts } from "./DispatcherAlerts"
import { FilterPopover } from "./FilterPopover"
import { useColumnConfig } from "@/hooks/useColumnConfig"
import { LoadWithRelations, PipelineCounts, LoadStatus, LoadType } from "@/types/dispatcher"
import { exportToCSV, type ExportColumn, formatDateForExport, formatDateTimeForExport } from "@/lib/exportCSV"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"

type DayFilterMode = "all" | "today" | "tomorrow" | "custom"

type AdvancedFilters = {
  statuses: LoadStatus[]
  loadTypes: LoadType[]
  dateFrom: string
  dateTo: string
}

type Driver = {
  id: string
  name: string
  phone: string | null
  status: string
}

type Props = {
  loads: LoadWithRelations[]
  pipelineCounts: PipelineCounts
  availableDrivers: Driver[]
}

export function DispatcherClient({ loads, pipelineCounts: _serverCounts, availableDrivers }: Props) {
  const router = useRouter()
  const refreshDispatcher = useCallback(() => {
    router.refresh()
  }, [router])
  useRealtimeRefresh({
    tables: ["loads", "containers", "vessels"],
    onRefresh: refreshDispatcher,
  })

  // Quick add state
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  // Day selector state
  const [dayFilterMode, setDayFilterMode] = useState<DayFilterMode>("all")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // Filter bar state
  const [search, setSearch] = useState("")
  const [showAvailable, setShowAvailable] = useState(true)
  const [showPending, setShowPending] = useState(true)

  // Advanced filter state
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    statuses: [],
    loadTypes: [],
    dateFrom: "",
    dateTo: "",
  })
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [showColumnFilters, setShowColumnFilters] = useState(false)

  // Column config
  const {
    visibleColumns,
    saveConfig,
    saveGlobalConfig,
    isColumnVisible,
    saving: columnSaving,
  } = useColumnConfig()
  const [columnModalOpen, setColumnModalOpen] = useState(false)

  // Expand table mode
  const [expanded, setExpanded] = useState(false)

  // Pipeline card filter
  const [pipelineFilter, setPipelineFilter] = useState<string | null>(null)

  // ── Filtering logic ──

  const filteredLoads = useMemo(() => {
    let result = loads

    // 1. Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.reference_number?.toLowerCase().includes(q) ||
        l.containers?.container_number?.toLowerCase().includes(q) ||
        l.customers?.name?.toLowerCase().includes(q) ||
        l.drivers?.name?.toLowerCase().includes(q) ||
        l.mbol?.toLowerCase().includes(q) ||
        l.house_bol?.toLowerCase().includes(q) ||
        l.pickup_location?.toLowerCase().includes(q) ||
        l.delivery_location?.toLowerCase().includes(q)
      )
    }

    // 2. Available / Pending checkboxes (when unchecked, exclude that status)
    if (!showAvailable) {
      result = result.filter(l => l.status !== "Available")
    }
    if (!showPending) {
      result = result.filter(l => l.status !== "Pending")
    }

    // 3. Day selector filter — match loads with ANY scheduled activity on that day
    if (dayFilterMode !== "all") {
      let targetDate: Date
      if (dayFilterMode === "today") {
        targetDate = new Date()
      } else if (dayFilterMode === "tomorrow") {
        targetDate = new Date()
        targetDate.setDate(targetDate.getDate() + 1)
      } else {
        targetDate = selectedDate
      }

      const targetStr = targetDate.toISOString().slice(0, 10) // YYYY-MM-DD

      result = result.filter(l => {
        if (!l.delivery_apt_from) return false
        try {
          return new Date(l.delivery_apt_from).toISOString().slice(0, 10) === targetStr
        } catch {
          return false
        }
      })
    }

    // 4. Advanced filters: statuses
    if (advancedFilters.statuses.length > 0) {
      result = result.filter(l => advancedFilters.statuses.includes(l.status as LoadStatus))
    }

    // 5. Advanced filters: load types
    if (advancedFilters.loadTypes.length > 0) {
      result = result.filter(l => l.load_type && advancedFilters.loadTypes.includes(l.load_type as LoadType))
    }

    // 6. Advanced filters: date range (created_at)
    if (advancedFilters.dateFrom) {
      const from = new Date(advancedFilters.dateFrom)
      from.setHours(0, 0, 0, 0)
      result = result.filter(l => new Date(l.created_at) >= from)
    }
    if (advancedFilters.dateTo) {
      const to = new Date(advancedFilters.dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(l => new Date(l.created_at) <= to)
    }

    // 7. Pipeline card filter — must match count logic above
    if (pipelineFilter) {
      const arrivingStatuses = ["Created", "Pending", "Available", "Customs Hold", "Freight Released"]
      const pickupStatuses = ["Available", "Freight Released", "Assigned", "Dispatched"]
      const deliveryStatuses = ["Arrived At Pickup", "In Transit", "At Warehouse"]
      const returnStatuses = ["Delivered", "Arrived At Delivery", "Arrived At Return Empty"]
      const droppedStatuses = ["Delivered", "Arrived At Delivery"]

      switch (pipelineFilter) {
        case "arriving":
          result = result.filter(l => arrivingStatuses.includes(l.status))
          break
        case "pickup":
          result = result.filter(l => pickupStatuses.includes(l.status) && !l.actual_pickup)
          break
        case "delivery":
          result = result.filter(l => deliveryStatuses.includes(l.status))
          break
        case "return":
          result = result.filter(l => returnStatuses.includes(l.status))
          break
        case "dropped":
          result = result.filter(l => droppedStatuses.includes(l.status))
          break
        case "finished":
          result = result.filter(l =>
            l.status === "Completed" &&
            l.completed_date &&
            new Date(l.completed_date).toDateString() === new Date().toDateString()
          )
          break
      }
    }

    return result
  }, [loads, search, showAvailable, showPending, dayFilterMode, selectedDate, advancedFilters, pipelineFilter])

  // Counts for Available/Pending badges
  const availableCount = useMemo(() => loads.filter(l => l.status === "Available").length, [loads])
  const pendingCount = useMemo(() => loads.filter(l => l.status === "Pending").length, [loads])

  const loadExportColumns: ExportColumn<LoadWithRelations>[] = useMemo(() => [
    { header: "Reference #", accessor: (l) => l.reference_number },
    { header: "Status", accessor: (l) => l.status },
    { header: "Load Type", accessor: (l) => l.load_type },
    { header: "Route Type", accessor: (l) => l.route_type },
    { header: "Customer", accessor: (l) => l.customers?.name },
    { header: "Container #", accessor: (l) => l.container_number || l.containers?.container_number },
    { header: "Driver", accessor: (l) => l.drivers?.name },
    { header: "Pickup Location", accessor: (l) => l.pickup_location },
    { header: "Delivery Location", accessor: (l) => l.delivery_location },
    { header: "Return Location", accessor: (l) => l.return_location },
    { header: "MBOL", accessor: (l) => l.mbol },
    { header: "House BOL", accessor: (l) => l.house_bol },
    { header: "SSL", accessor: (l) => l.ssl },
    { header: "Vessel", accessor: (l) => l.vessel_name },
    { header: "Voyage", accessor: (l) => l.voyage },
    { header: "Chassis #", accessor: (l) => l.chassis_number },
    { header: "Pickup Apt From", accessor: (l) => formatDateTimeForExport(l.pickup_apt_from) },
    { header: "Pickup Apt To", accessor: (l) => formatDateTimeForExport(l.pickup_apt_to) },
    { header: "Delivery Apt From", accessor: (l) => formatDateTimeForExport(l.delivery_apt_from) },
    { header: "Delivery Apt To", accessor: (l) => formatDateTimeForExport(l.delivery_apt_to) },
    { header: "Last Free Day", accessor: (l) => formatDateForExport(l.containers?.last_free_day) },
    { header: "Rate", accessor: (l) => l.rate },
    { header: "Driver Pay", accessor: (l) => l.driver_pay },
    { header: "Vessel ETA", accessor: (l) => formatDateForExport(l.vessel_eta) },
    { header: "Weight", accessor: (l) => l.total_weight },
    { header: "Commodity", accessor: (l) => l.commodity },
    { header: "Notes", accessor: (l) => l.notes },
    { header: "Created", accessor: (l) => formatDateForExport(l.created_at) },
  ], [])

  const handleExportLoads = useCallback(() => {
    exportToCSV("load-board", loadExportColumns, filteredLoads)
  }, [loadExportColumns, filteredLoads])

  // Recompute pipeline counts from day-filtered loads so cards reflect selected day
  const dayFilteredLoads = useMemo(() => {
    if (dayFilterMode === "all") return loads

    let targetDate: Date
    if (dayFilterMode === "today") {
      targetDate = new Date()
    } else if (dayFilterMode === "tomorrow") {
      targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + 1)
    } else {
      targetDate = selectedDate
    }
    const targetStr = targetDate.toISOString().slice(0, 10)

    return loads.filter(l => {
      if (!l.delivery_apt_from) return false
      try { return new Date(l.delivery_apt_from).toISOString().slice(0, 10) === targetStr } catch { return false }
    })
  }, [loads, dayFilterMode, selectedDate])

  const dynamicPipelineCounts: PipelineCounts = useMemo(() => {
    const ll = dayFilteredLoads
    const today = new Date().toDateString()

    // Arriving: loads not yet picked up (pre-pickup statuses)
    const arrivingStatuses = ["Created", "Pending", "Available", "Customs Hold", "Freight Released"]
    const arriving = ll.filter(l => arrivingStatuses.includes(l.status))

    // Need Pickup: released from holds, assigned/dispatched but not yet picked up
    const pickupStatuses = ["Available", "Freight Released", "Assigned", "Dispatched"]
    const needPickup = ll.filter(l => pickupStatuses.includes(l.status) && !l.actual_pickup)

    // Need Delivery: picked up, in transit, at terminal — not yet delivered
    const deliveryStatuses = ["Arrived At Pickup", "In Transit", "At Warehouse"]
    const needDelivery = ll.filter(l => deliveryStatuses.includes(l.status))

    // Need Return: delivered but empty container not yet returned
    const returnStatuses = ["Delivered", "Arrived At Delivery", "Arrived At Return Empty"]
    const needReturn = ll.filter(l => returnStatuses.includes(l.status))

    // Dropped: delivered and sitting at location (not yet returned or completed)
    const droppedStatuses = ["Delivered", "Arrived At Delivery"]
    const dropped = ll.filter(l => droppedStatuses.includes(l.status))

    return {
      arrivingOnVessel: arriving.length,
      arrivingOnHold: arriving.filter(l =>
        l.customs_hold === "hold" || l.freight_hold === "hold" ||
        l.terminal_hold === "hold" || l.fees_hold === "hold" ||
        l.carrier_hold === true || l.other_hold === "hold"
      ).length,
      arrivingReleased: arriving.filter(l =>
        l.customs_hold !== "hold" && l.freight_hold !== "hold" &&
        l.terminal_hold !== "hold" && l.fees_hold !== "hold" &&
        l.carrier_hold !== true && l.other_hold !== "hold"
      ).length,
      needPickup: needPickup.length,
      needPickupLFD: needPickup.filter(l =>
        l.containers?.last_free_day && new Date(l.containers.last_free_day) < new Date()
      ).length,
      needPickupApt: needPickup.filter(l => l.pickup_apt_from && l.pickup_apt_to).length,
      needDelivery: needDelivery.length,
      needDeliveryAtTerminal: needDelivery.filter(l => l.status === "At Warehouse" || l.status === "Arrived At Pickup").length,
      needDeliveryInYard: needDelivery.filter(l => l.status === "In Transit").length,
      needReturn: needReturn.length,
      needReturnReady: needReturn.filter(l => !!l.ready_to_return_date).length,
      needReturnNotReady: needReturn.filter(l => !l.ready_to_return_date).length,
      dropped: dropped.length,
      droppedInYard: dropped.filter(l => !!l.ingate_date).length,
      droppedAtCustomer: dropped.filter(l => !l.ingate_date).length,
      dispatched: ll.filter(l => l.status === "Dispatched").length,
      finishedToday: ll.filter(l =>
        l.status === "Completed" && l.completed_date &&
        new Date(l.completed_date).toDateString() === today
      ).length,
    }
  }, [dayFilteredLoads])

  // Active advanced filter count (for badge on Filter button)
  const activeFilterCount = advancedFilters.statuses.length +
    advancedFilters.loadTypes.length +
    (advancedFilters.dateFrom ? 1 : 0) +
    (advancedFilters.dateTo ? 1 : 0)

  // Day selector callbacks
  const handleDayModeChange = useCallback((mode: DayFilterMode) => {
    setDayFilterMode(mode)
    if (mode === "today") {
      setSelectedDate(new Date())
    } else if (mode === "tomorrow") {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      setSelectedDate(d)
    }
  }, [])

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date)
    setDayFilterMode("custom")
  }, [])

  return (
    <div className={`flex flex-col ${expanded ? "fixed inset-0 z-40 bg-[#0B1120]" : "h-[calc(100vh-190px)]"}`}>
      {/* Top section — locked to page width, no horizontal scroll */}
      {!expanded && (
        <div className="flex-shrink-0 space-y-4 w-full max-w-full">
          {/* Pipeline Cards + Dispatcher Alerts (right-aligned) */}
          <div className="flex items-start gap-4 relative z-20">
            <div className="flex-1 min-w-0 overflow-x-hidden">
              <PipelineCards
                counts={dynamicPipelineCounts}
                activeFilter={pipelineFilter}
                onFilterChange={setPipelineFilter}
              />
            </div>
            <div className="flex-shrink-0 pt-0.5">
              <DispatcherAlerts loads={loads} />
            </div>
          </div>

          {/* Day Selector + Rotation Status */}
          <div className="flex items-center justify-between">
            <DaySelector
              mode={dayFilterMode}
              selectedDate={selectedDate}
              onModeChange={handleDayModeChange}
              onDateChange={handleDateChange}
            />
            <RotationStatus onComplete={() => router.refresh()} />
          </div>
        </div>
      )}

      {/* Quick Add Load inline form */}
      {quickAddOpen && (
        <div className="flex-shrink-0 overflow-x-hidden w-full max-w-full mt-4">
          <QuickAddLoad
            open={quickAddOpen}
            onClose={() => setQuickAddOpen(false)}
            onCreated={() => router.refresh()}
          />
        </div>
      )}

      {/* Filters and Controls — also locked to page width */}
      <div className={`flex-shrink-0 overflow-x-hidden w-full max-w-full ${expanded ? "p-4" : "mt-4"}`}>
        <LoadFilters
          search={search}
          onSearchChange={setSearch}
          showAvailable={showAvailable}
          onShowAvailableChange={setShowAvailable}
          showPending={showPending}
          onShowPendingChange={setShowPending}
          availableCount={availableCount}
          pendingCount={pendingCount}
          activeFilterCount={activeFilterCount + (showColumnFilters ? 1 : 0)}
          onFilterClick={() => setShowColumnFilters(!showColumnFilters)}
          filterPopoverOpen={filterPopoverOpen}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
          onFilterPopoverClose={() => setFilterPopoverOpen(false)}
          onColumnConfigClick={() => setColumnModalOpen(true)}
          expanded={expanded}
          onExpandToggle={() => setExpanded(!expanded)}
          onQuickAdd={() => setQuickAddOpen(!quickAddOpen)}
          quickAddOpen={quickAddOpen}
          onExport={handleExportLoads}
          exportCount={filteredLoads.length}
        />
      </div>

      {/* Table — independently scrolls horizontally for wide content */}
      <div className={`flex-1 min-h-0 overflow-hidden ${expanded ? "" : "mt-4"}`}>
        <div className="bg-[#111827] rounded-xl border border-white/5 h-full overflow-auto">
          <LoadsTable
            loads={filteredLoads}
            availableDrivers={availableDrivers}
            visibleColumns={visibleColumns}
            isColumnVisible={isColumnVisible}
            showColumnFilters={showColumnFilters}
          />
        </div>
      </div>

      {/* Column Config Modal */}
      <ColumnConfigModal
        open={columnModalOpen}
        onClose={() => setColumnModalOpen(false)}
        visibleColumns={visibleColumns}
        onSave={(cols) => { saveConfig(cols); setColumnModalOpen(false) }}
        onSaveGlobal={(cols) => { saveGlobalConfig(cols); setColumnModalOpen(false) }}
        saving={columnSaving}
      />
    </div>
  )
}
