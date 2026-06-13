// components/dispatcher/FilterPopover.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { LoadStatus, LoadType } from "@/types/dispatcher"

const ALL_STATUSES: LoadStatus[] = [
  "Available", "Pending", "Customs Hold", "Freight Released", "Created",
  "Assigned", "Dispatched", "In Transit", "Arrived At Pickup",
  "Arrived At Delivery", "Arrived At Return Empty", "At Warehouse",
  "Delivered", "Completed", "Cancelled",
]

const ALL_LOAD_TYPES: LoadType[] = ["Import", "Export", "Road", "Bill Only"]

type FilterState = {
  statuses: LoadStatus[]
  loadTypes: LoadType[]
  dateFrom: string
  dateTo: string
}

type Props = {
  open: boolean
  onClose: () => void
  filters: FilterState
  onApply: (filters: FilterState) => void
}

export function FilterPopover({ open, onClose, filters, onApply }: Props) {
  const [local, setLocal] = useState<FilterState>(filters)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setLocal(filters)
  }, [open, filters])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, onClose])

  if (!open) return null

  const toggleStatus = (s: LoadStatus) => {
    setLocal(prev => ({
      ...prev,
      statuses: prev.statuses.includes(s)
        ? prev.statuses.filter(x => x !== s)
        : [...prev.statuses, s],
    }))
  }

  const toggleLoadType = (t: LoadType) => {
    setLocal(prev => ({
      ...prev,
      loadTypes: prev.loadTypes.includes(t)
        ? prev.loadTypes.filter(x => x !== t)
        : [...prev.loadTypes, t],
    }))
  }

  const handleApply = () => {
    onApply(local)
    onClose()
  }

  const handleClear = () => {
    const cleared: FilterState = { statuses: [], loadTypes: [], dateFrom: "", dateTo: "" }
    setLocal(cleared)
    onApply(cleared)
    onClose()
  }

  const activeCount = local.statuses.length + local.loadTypes.length + (local.dateFrom ? 1 : 0) + (local.dateTo ? 1 : 0)

  return (
    <div className="absolute top-full left-0 mt-2 z-40" ref={panelRef}>
      <div className="w-80 bg-[#1A2332] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Filters {activeCount > 0 && <span className="text-[#E8700A]">({activeCount})</span>}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {/* Status section */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Load Status</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                    local.statuses.includes(s)
                      ? "border-[#E8700A] bg-[#E8700A]/10 text-[#FF8C21]"
                      : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Load Type section */}
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Load Type</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_LOAD_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => toggleLoadType(t)}
                  className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                    local.loadTypes.includes(t)
                      ? "border-[#E8700A] bg-[#E8700A]/10 text-[#FF8C21]"
                      : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Date Range</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 block mb-1">From</label>
                <input
                  type="date"
                  value={local.dateFrom}
                  onChange={(e) => setLocal(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 block mb-1">To</label>
                <input
                  type="date"
                  value={local.dateTo}
                  onChange={(e) => setLocal(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <button onClick={handleClear} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}
