"use client"

import { FilterPopover } from "./FilterPopover"
import { LoadStatus, LoadType } from "@/types/dispatcher"
import { ExportButton } from "@/components/ui/ExportButton"

type AdvancedFilters = {
  statuses: LoadStatus[]
  loadTypes: LoadType[]
  dateFrom: string
  dateTo: string
}

type Props = {
  search: string
  onSearchChange: (value: string) => void
  showAvailable: boolean
  onShowAvailableChange: (value: boolean) => void
  showPending: boolean
  onShowPendingChange: (value: boolean) => void
  availableCount: number
  pendingCount: number
  activeFilterCount: number
  onFilterClick: () => void
  filterPopoverOpen: boolean
  advancedFilters: AdvancedFilters
  onAdvancedFiltersChange: (filters: AdvancedFilters) => void
  onFilterPopoverClose: () => void
  onColumnConfigClick: () => void
  expanded: boolean
  onExpandToggle: () => void
  onQuickAdd: () => void
  quickAddOpen: boolean
  onExport?: () => void
  exportCount?: number
}

export function LoadFilters({
  search,
  onSearchChange,
  showAvailable,
  onShowAvailableChange,
  showPending,
  onShowPendingChange,
  availableCount,
  pendingCount,
  activeFilterCount,
  onFilterClick,
  filterPopoverOpen,
  advancedFilters,
  onAdvancedFiltersChange,
  onFilterPopoverClose,
  onColumnConfigClick,
  expanded,
  onExpandToggle,
  onQuickAdd,
  quickAddOpen,
  onExport,
  exportCount,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        {/* Quick Add button */}
        <button
          onClick={onQuickAdd}
          className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
            quickAddOpen
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
          }`}
        >
          + Add
        </button>

        {/* Search input */}
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search the Board..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-8 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Available checkbox */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
          <input
            type="checkbox"
            id="filter-available"
            checked={showAvailable}
            onChange={(e) => onShowAvailableChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 cursor-pointer accent-blue-500"
          />
          <label htmlFor="filter-available" className="text-sm font-medium text-gray-400 cursor-pointer">
            Available
          </label>
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 min-w-[20px]">
            {availableCount}
          </span>
        </div>

        {/* Pending checkbox */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
          <input
            type="checkbox"
            id="filter-pending"
            checked={showPending}
            onChange={(e) => onShowPendingChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 cursor-pointer accent-amber-500"
          />
          <label htmlFor="filter-pending" className="text-sm font-medium text-gray-400 cursor-pointer">
            Pending
          </label>
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 min-w-[20px]">
            {pendingCount}
          </span>
        </div>

        {/* Filter button with popover */}
        <div className="relative">
          <button
            onClick={onFilterClick}
            className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeFilterCount > 0
                ? "bg-[#E8700A]/10 border-[#E8700A]/30 text-[#FF8C21]"
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-300"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            Filter
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-[#E8700A] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <FilterPopover
            open={filterPopoverOpen}
            onClose={onFilterPopoverClose}
            filters={advancedFilters}
            onApply={onAdvancedFiltersChange}
          />
        </div>

        {/* Export */}
        {onExport && <ExportButton onClick={onExport} count={exportCount} />}

        {/* Configure Columns */}
        <button
          onClick={onColumnConfigClick}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:bg-white/10 transition-colors"
          title="Configure columns"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>

        {/* Expand Table */}
        <button
          onClick={onExpandToggle}
          className={`px-3 py-1.5 border rounded-lg transition-colors ${
            expanded
              ? "bg-[#E8700A]/10 border-[#E8700A]/30 text-[#FF8C21]"
              : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
          }`}
          title={expanded ? "Exit fullscreen" : "Expand table"}
        >
          {expanded ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
