// components/admin/StatusTransitionsView.tsx
// Admin control panel for viewing and editing load status transition rules
"use client"

import { useState, useEffect, useCallback } from "react"
import { LoadStatus, LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { LoadTypeFlowCharts } from "./LoadTypeFlowCharts"

type TransitionMap = Record<string, string[]>

type TransitionsData = {
  transitions: TransitionMap
  defaults: TransitionMap
  hasOverrides: boolean
  allStatuses: string[]
}

// ─── Status badge (reusable) ─────────────────────────────────
function StatusBadge({
  status,
  removable,
  onRemove,
}: {
  status: string
  removable?: boolean
  onRemove?: () => void
}) {
  const colors = LOAD_STATUS_COLORS[status as LoadStatus]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
        colors?.bg || "bg-gray-500/10"
      } ${colors?.text || "text-gray-400"} ${colors?.border || "border-gray-500/20"}`}
    >
      {status}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 hover:text-red-400 transition-colors"
          title={`Remove ${status}`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}

// ─── Add-transition dropdown ─────────────────────────────────
function AddTransitionDropdown({
  fromStatus,
  currentTargets,
  allStatuses,
  onAdd,
}: {
  fromStatus: string
  currentTargets: string[]
  allStatuses: string[]
  onAdd: (status: string) => void
}) {
  const [open, setOpen] = useState(false)
  const available = allStatuses.filter(
    (s) => s !== fromStatus && !currentTargets.includes(s)
  )

  if (available.length === 0) return null

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-dashed border-white/20 text-gray-500 hover:text-gray-300 hover:border-white/40 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-[#1a1f2e] border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[200px]">
            {available.map((s) => {
              const colors = LOAD_STATUS_COLORS[s as LoadStatus]
              return (
                <button
                  key={s}
                  onClick={() => {
                    onAdd(s)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors ${
                    colors?.text || "text-gray-400"
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────
export function StatusTransitionsView() {
  const [data, setData] = useState<TransitionsData | null>(null)
  const [editedTransitions, setEditedTransitions] = useState<TransitionMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [editMode, setEditMode] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/transitions")
      if (!res.ok) throw new Error("Failed to load transitions")
      const json: TransitionsData = await res.json()
      setData(json)
      setEditedTransitions(JSON.parse(JSON.stringify(json.transitions)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAddTransition = (fromStatus: string, toStatus: string) => {
    if (!editedTransitions) return
    const updated = { ...editedTransitions }
    const current = updated[fromStatus] || []
    if (!current.includes(toStatus)) {
      updated[fromStatus] = [...current, toStatus]
      setEditedTransitions(updated)
    }
  }

  const handleRemoveTransition = (fromStatus: string, toStatus: string) => {
    if (!editedTransitions) return
    const updated = { ...editedTransitions }
    updated[fromStatus] = (updated[fromStatus] || []).filter((s) => s !== toStatus)
    setEditedTransitions(updated)
  }

  const handleSave = async () => {
    if (!editedTransitions) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/transitions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transitions: editedTransitions }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Failed to save")
      }
      setSuccess("Transition rules saved successfully")
      setEditMode(false)
      // Refresh data
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/transitions", { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Failed to reset")
      }
      setSuccess("Transitions reset to system defaults")
      setEditMode(false)
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset")
    } finally {
      setResetting(false)
    }
  }

  const handleCancel = () => {
    if (data) {
      setEditedTransitions(JSON.parse(JSON.stringify(data.transitions)))
    }
    setEditMode(false)
    setError(null)
  }

  // Check if there are unsaved changes
  const hasChanges =
    editMode &&
    data &&
    editedTransitions &&
    JSON.stringify(editedTransitions) !== JSON.stringify(data.transitions)

  // Count differences from defaults
  const getDiffCount = (): number => {
    if (!data || !editedTransitions) return 0
    let count = 0
    for (const status of data.allStatuses) {
      const current = (editedTransitions[status] || []).slice().sort()
      const defaults = (data.defaults[status] || []).slice().sort()
      if (JSON.stringify(current) !== JSON.stringify(defaults)) count++
    }
    return count
  }

  // Filter statuses by search
  const filteredStatuses = data?.allStatuses.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  ) || []

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/5 rounded w-1/3" />
          <div className="h-4 bg-white/5 rounded w-2/3" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!data || !editedTransitions) {
    return (
      <div className="p-8 text-red-400">
        Failed to load transition data. The &quot;load_transition_overrides&quot; table may not exist yet.
        <br />
        <span className="text-gray-500 text-sm">
          Create it in Supabase with columns: from_status (text, PK), to_statuses (jsonb), updated_by (uuid), updated_at (timestamptz).
        </span>
      </div>
    )
  }

  const diffCount = getDiffCount()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Status Transitions</h2>
          <p className="mt-1 text-sm text-gray-400">
            Configure which status changes are allowed for loads.
            {data.hasOverrides ? (
              <span className="ml-2 text-[#FF8C21]">Custom rules active</span>
            ) : (
              <span className="ml-2 text-gray-500">Using system defaults</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-[#E8700A] hover:bg-[#FF8C21] text-white text-sm font-medium rounded-lg transition-colors"
            >
              Edit Rules
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-white/10"
              >
                Cancel
              </button>
              {data.hasOverrides && (
                <button
                  onClick={handleReset}
                  disabled={saving || resetting}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20"
                >
                  {resetting ? "Resetting..." : "Reset to Defaults"}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
          {success}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-blue-500/10 text-blue-400 border-blue-500/20 text-sm font-medium">
          <span className="text-lg font-bold">{data.allStatuses.length}</span>
          Statuses
        </span>
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-purple-500/10 text-purple-400 border-purple-500/20 text-sm font-medium">
          <span className="text-lg font-bold">
            {Object.values(editedTransitions).reduce((sum, arr) => sum + arr.length, 0)}
          </span>
          Total Rules
        </span>
        {diffCount > 0 && (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-[#E8700A]/10 text-[#FF8C21] border-[#E8700A]/20 text-sm font-medium">
            <span className="text-lg font-bold">{diffCount}</span>
            Modified from Defaults
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="text"
          placeholder="Filter statuses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]/50 focus:border-[#E8700A]/50"
        />
      </div>

      {/* Transition rules table */}
      <div className="bg-[#111827] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-48">
                  From Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Valid Next Statuses
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">
                  #
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStatuses.map((status) => {
                const targets = editedTransitions[status] || []
                const defaultTargets = data.defaults[status] || []
                const isModified = JSON.stringify(targets.slice().sort()) !== JSON.stringify(defaultTargets.slice().sort())
                const isTerminal = targets.length === 0 && defaultTargets.length === 0
                const colors = LOAD_STATUS_COLORS[status as LoadStatus]

                return (
                  <tr
                    key={status}
                    className={`border-b border-white/5 last:border-0 ${
                      isModified ? "bg-[#E8700A]/5" : ""
                    }`}
                  >
                    {/* From status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold border ${
                            colors?.bg || "bg-gray-500/10"
                          } ${colors?.text || "text-gray-400"} ${
                            colors?.border || "border-gray-500/20"
                          }`}
                        >
                          {status}
                        </span>
                        {isModified && (
                          <span className="text-[9px] text-[#FF8C21] font-medium uppercase">
                            Modified
                          </span>
                        )}
                        {isTerminal && (
                          <span className="text-[9px] text-gray-600 font-medium uppercase">
                            Terminal
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Target statuses */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {targets.length === 0 && !editMode && (
                          <span className="text-xs text-gray-600 italic">
                            No transitions (terminal state)
                          </span>
                        )}
                        {targets.map((target) => (
                          <StatusBadge
                            key={target}
                            status={target}
                            removable={editMode}
                            onRemove={() => handleRemoveTransition(status, target)}
                          />
                        ))}
                        {editMode && (
                          <AddTransitionDropdown
                            fromStatus={status}
                            currentTargets={targets}
                            allStatuses={data.allStatuses}
                            onAdd={(s) => handleAddTransition(status, s)}
                          />
                        )}
                      </div>
                    </td>

                    {/* Count */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-gray-500 font-mono">{targets.length}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          <span className="text-[#FF8C21]">Modified</span> — differs from the
          system default. <span className="text-gray-500">Terminal</span> — no
          outgoing transitions allowed.
        </p>
        <p>
          Changes affect the DriverActionPanel and status update API immediately
          after saving. The hardcoded defaults in code remain as a fallback if
          overrides are cleared.
        </p>
      </div>

      {/* Flow Charts by Load Type */}
      <LoadTypeFlowCharts />
    </div>
  )
}
