// components/dispatcher/ColumnConfigModal.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { DISPATCHER_COLUMNS, getLockedColumns, getDefaultVisibleColumns } from "@/lib/column-config"

type Props = {
  open: boolean
  onClose: () => void
  visibleColumns: string[]
  onSave: (columns: string[]) => void
  onSaveGlobal: (columns: string[]) => void
  saving: boolean
}

export function ColumnConfigModal({ open, onClose, visibleColumns, onSave, onSaveGlobal, saving }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(visibleColumns))
  const [search, setSearch] = useState("")
  const panelRef = useRef<HTMLDivElement>(null)

  // Sync when opened
  useEffect(() => {
    if (open) {
      setSelected(new Set(visibleColumns))
      setSearch("")
    }
  }, [open, visibleColumns])

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

  const locked = new Set(getLockedColumns())
  const toggleable = DISPATCHER_COLUMNS.filter(c => !c.locked)
  const filtered = search
    ? toggleable.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
    : toggleable

  const handleToggle = (key: string) => {
    const next = new Set(selected)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setSelected(next)
  }

  const handleSelectAll = () => {
    const next = new Set(selected)
    for (const c of toggleable) next.add(c.key)
    setSelected(next)
  }

  const handleDeselectAll = () => {
    // Keep only locked columns
    setSelected(new Set(locked))
  }

  const handleReset = () => {
    setSelected(new Set(getDefaultVisibleColumns()))
  }

  const handleSave = () => {
    const cols = DISPATCHER_COLUMNS.filter(c => selected.has(c.key)).map(c => c.key)
    onSave(cols)
  }

  const handleSaveGlobal = () => {
    const cols = DISPATCHER_COLUMNS.filter(c => selected.has(c.key)).map(c => c.key)
    onSaveGlobal(cols)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50">
      <div
        ref={panelRef}
        className="w-full max-w-md bg-[#1A2332] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Configure Columns</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-white/5">
          <input
            type="text"
            placeholder="Search columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
          />
        </div>

        {/* Quick actions */}
        <div className="px-4 py-2 border-b border-white/5 flex gap-2">
          <button onClick={handleSelectAll} className="text-[11px] text-blue-400 hover:text-blue-300">Select All</button>
          <span className="text-gray-600">|</span>
          <button onClick={handleDeselectAll} className="text-[11px] text-blue-400 hover:text-blue-300">Deselect All</button>
          <span className="text-gray-600">|</span>
          <button onClick={handleReset} className="text-[11px] text-blue-400 hover:text-blue-300">Reset to Default</button>
        </div>

        {/* Column list */}
        <div className="max-h-72 overflow-y-auto px-2 py-1">
          {filtered.map((col) => {
            const isLocked = locked.has(col.key)
            const isChecked = selected.has(col.key)
            return (
              <label
                key={col.key}
                className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors ${
                  isLocked ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isLocked}
                  onChange={() => !isLocked && handleToggle(col.key)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5"
                />
                <span className="text-sm text-gray-300">{col.label}</span>
                {isLocked && (
                  <span className="text-[10px] text-gray-600 ml-auto">locked</span>
                )}
              </label>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No columns match</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-2">
          <button
            onClick={handleSaveGlobal}
            disabled={saving}
            className="px-3 py-1.5 text-[11px] font-medium text-gray-400 border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Save as Global Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
