// components/admin/LoadTypeFlowCharts.tsx
// Visual flow charts showing the typical status progression for each load type
// Now editable — add/remove steps, branches, and entire load types
"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { LoadStatus, LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { Plus, Trash2, X, Save, RotateCcw } from "lucide-react"

// ─── All available statuses for the picker ─────────────────
const ALL_STATUSES: LoadStatus[] = [
  "Pending",
  "Available",
  "Available At Port",
  "Customs Hold",
  "Freight Released",
  "Created",
  "Assigned",
  "Dispatched",
  "In Transit",
  "Arrived At Pickup",
  "Arrived At Delivery",
  "Arrived At Return Empty",
  "Arrived To Hook Container",
  "At Warehouse",
  "Dropped - Empty",
  "Dropped - Loaded",
  "Enroute To Drop Container",
  "Enroute To Return Empty",
  "Delivered",
  "Completed",
  "Cancelled",
]

// ─── Flow definitions per load type ───────────────────────────
type FlowStep = {
  status: LoadStatus
  note?: string
}

type FlowBranch = {
  label: string
  steps: FlowStep[]
}

type LoadTypeFlow = {
  id: string
  name: string
  icon: string
  description: string
  mainFlow: FlowStep[]
  branches?: FlowBranch[]
  optionalSteps?: LoadStatus[]
}

const DEFAULT_FLOWS: LoadTypeFlow[] = [
  {
    id: "import",
    name: "Import",
    icon: "📥",
    description:
      "Full import container: port pickup → customer delivery → empty return to port/yard.",
    mainFlow: [
      { status: "Pending" },
      { status: "Available At Port", note: "At terminal" },
      { status: "Assigned" },
      { status: "Dispatched" },
      { status: "Arrived At Pickup", note: "At port/terminal" },
      { status: "In Transit" },
      { status: "Arrived At Delivery", note: "At consignee" },
      { status: "Delivered" },
      { status: "Enroute To Return Empty" },
      { status: "Arrived At Return Empty", note: "At port/yard" },
      { status: "Completed" },
    ],
    branches: [
      {
        label: "Customs Hold Path",
        steps: [
          { status: "Available At Port" },
          { status: "Customs Hold" },
          { status: "Freight Released" },
          { status: "Assigned" },
        ],
      },
      {
        label: "Drop & Hook",
        steps: [
          { status: "Arrived At Delivery" },
          { status: "Dropped - Loaded", note: "Drop at consignee" },
          { status: "Enroute To Return Empty" },
        ],
      },
    ],
    optionalSteps: ["Customs Hold", "Freight Released", "Dropped - Loaded"],
  },
  {
    id: "export",
    name: "Export",
    icon: "📤",
    description:
      "Export container: pick up empty → load at shipper → deliver to port.",
    mainFlow: [
      { status: "Pending" },
      { status: "Available", note: "Ready for dispatch" },
      { status: "Assigned" },
      { status: "Dispatched" },
      { status: "Arrived To Hook Container", note: "Pick up empty" },
      { status: "In Transit" },
      { status: "Arrived At Delivery", note: "At shipper" },
      { status: "Delivered", note: "Loaded at shipper" },
      { status: "In Transit", note: "To port" },
      { status: "Arrived At Delivery", note: "At port" },
      { status: "Completed" },
    ],
    branches: [
      {
        label: "Drop & Pick Path",
        steps: [
          { status: "Arrived At Delivery", note: "At shipper" },
          { status: "Dropped - Empty", note: "Drop empty" },
          { status: "Arrived To Hook Container", note: "Hook loaded" },
          { status: "In Transit", note: "To port" },
        ],
      },
    ],
    optionalSteps: ["Dropped - Empty"],
  },
  {
    id: "empty-return",
    name: "Empty Return",
    icon: "📦",
    description:
      "Return an empty container to port or yard after delivery (standalone move).",
    mainFlow: [
      { status: "Pending" },
      { status: "Assigned" },
      { status: "Dispatched" },
      { status: "Arrived To Hook Container", note: "Hook empty" },
      { status: "In Transit" },
      { status: "Arrived At Return Empty", note: "At port/yard" },
      { status: "Completed" },
    ],
    branches: [
      {
        label: "From Dropped State",
        steps: [
          { status: "Dropped - Empty", note: "Already dropped" },
          { status: "Arrived To Hook Container" },
          { status: "In Transit" },
        ],
      },
    ],
    optionalSteps: [],
  },
  {
    id: "street-turn",
    name: "Street Turn",
    icon: "🔄",
    description:
      "Reuse a container: after import delivery, redirect the empty to the next export shipper instead of returning to port.",
    mainFlow: [
      { status: "Delivered", note: "Import delivered" },
      { status: "Dropped - Empty", note: "Drop at consignee" },
      { status: "Arrived To Hook Container", note: "Hook empty" },
      { status: "In Transit", note: "To next shipper" },
      { status: "Enroute To Drop Container" },
      { status: "Arrived At Delivery", note: "At export shipper" },
      { status: "Delivered", note: "Loaded for export" },
      { status: "Completed" },
    ],
    branches: [],
    optionalSteps: [],
  },
]

// ─── Status Picker Dropdown (fixed position, not clipped by overflow) ──
function StatusPicker({
  onSelect,
  onClose,
  anchorRect,
}: {
  onSelect: (status: LoadStatus, note?: string) => void
  onClose: () => void
  anchorRect: DOMRect | null
}) {
  const [search, setSearch] = useState("")
  const [note, setNote] = useState("")
  const pickerRef = useRef<HTMLDivElement>(null)
  const filtered = ALL_STATUSES.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  )

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  if (!anchorRect) return null

  // Position below the anchor, clamped to viewport
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 320)
  const left = Math.min(anchorRect.left, window.innerWidth - 272)

  return (
    <div
      ref={pickerRef}
      className="fixed z-[9999] bg-[#1a2236] border border-white/10 rounded-lg shadow-xl p-2 w-64"
      style={{ top, left }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">
          Select Status
        </span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          <X className="w-3 h-3" />
        </button>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search statuses..."
        className="w-full bg-[#0B1120] border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A] mb-1"
        autoFocus
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="w-full bg-[#0B1120] border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A] mb-2"
      />
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filtered.map((status) => {
          const colors = LOAD_STATUS_COLORS[status]
          return (
            <button
              key={status}
              onClick={() => onSelect(status, note || undefined)}
              className={`w-full text-left px-2 py-1.5 rounded text-[11px] font-medium hover:bg-white/5 transition-colors ${
                colors?.text || "text-gray-400"
              }`}
            >
              {status}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-[10px] text-gray-500 px-2 py-2">No matching statuses</p>
        )}
      </div>
    </div>
  )
}

// ─── Add Step Button ─────────────────────────────────────────
function AddStepButton({
  onAdd,
  compact,
}: {
  onAdd: (status: LoadStatus, note?: string) => void
  compact?: boolean
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleClick = () => {
    if (showPicker) {
      setShowPicker(false)
    } else {
      if (btnRef.current) {
        setAnchorRect(btnRef.current.getBoundingClientRect())
      }
      setShowPicker(true)
    }
  }

  return (
    <div className="flex items-center shrink-0">
      <button
        ref={btnRef}
        onClick={handleClick}
        className={`flex items-center justify-center border border-dashed border-white/20 rounded-lg text-gray-500 hover:text-[#E8700A] hover:border-[#E8700A]/40 transition-colors ${
          compact ? "w-6 h-6" : "w-8 h-8"
        }`}
        title="Add step"
      >
        <Plus className={compact ? "w-3 h-3" : "w-4 h-4"} />
      </button>
      {showPicker && (
        <StatusPicker
          anchorRect={anchorRect}
          onSelect={(status, note) => {
            onAdd(status, note)
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ─── Flow Node ────────────────────────────────────────────────
function FlowNode({
  status,
  note,
  isOptional,
  compact,
  onDelete,
  editable,
}: {
  status: LoadStatus
  note?: string
  isOptional?: boolean
  compact?: boolean
  onDelete?: () => void
  editable?: boolean
}) {
  const colors = LOAD_STATUS_COLORS[status]
  return (
    <div className="flex flex-col items-center gap-1 shrink-0 group/node relative">
      <div
        className={`relative px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border whitespace-nowrap ${
          colors?.bg || "bg-gray-500/10"
        } ${colors?.text || "text-gray-400"} ${
          colors?.border || "border-gray-500/20"
        } ${isOptional ? "border-dashed opacity-70" : ""} ${
          compact ? "px-2 py-1 text-[9px]" : ""
        }`}
      >
        {status}
        {isOptional && (
          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-gray-700 text-[7px] text-gray-400 flex items-center justify-center border border-gray-600">
            ?
          </span>
        )}
        {editable && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/node:opacity-100 transition-opacity hover:bg-red-500"
            title="Remove step"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
      {note && (
        <span className="text-[9px] text-gray-600 max-w-[100px] text-center leading-tight">
          {note}
        </span>
      )}
    </div>
  )
}

// ─── Arrow ────────────────────────────────────────────────────
function FlowArrow({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex items-center shrink-0 ${compact ? "px-0.5" : "px-1"}`}>
      <div className={`${compact ? "w-3" : "w-5"} h-px bg-white/20`} />
      <svg
        className={`${compact ? "w-1.5 h-1.5" : "w-2 h-2"} text-white/20 -ml-px`}
        viewBox="0 0 6 10"
        fill="currentColor"
      >
        <path d="M0 0L6 5L0 10Z" />
      </svg>
    </div>
  )
}

// ─── Single Flow Chart (Editable) ────────────────────────────
function FlowChart({
  flow,
  onUpdate,
  onDelete,
  editable,
}: {
  flow: LoadTypeFlow
  onUpdate: (updated: LoadTypeFlow) => void
  onDelete: () => void
  editable: boolean
}) {
  const [expanded, setExpanded] = useState(true)

  const addMainStep = useCallback(
    (status: LoadStatus, note?: string) => {
      onUpdate({
        ...flow,
        mainFlow: [...flow.mainFlow, { status, note }],
      })
    },
    [flow, onUpdate]
  )

  const removeMainStep = useCallback(
    (index: number) => {
      onUpdate({
        ...flow,
        mainFlow: flow.mainFlow.filter((_, i) => i !== index),
      })
    },
    [flow, onUpdate]
  )

  const addBranch = useCallback(() => {
    const label = prompt("Branch label (e.g. 'Customs Hold Path'):")
    if (!label) return
    onUpdate({
      ...flow,
      branches: [...(flow.branches || []), { label, steps: [] }],
    })
  }, [flow, onUpdate])

  const removeBranch = useCallback(
    (bIndex: number) => {
      onUpdate({
        ...flow,
        branches: (flow.branches || []).filter((_, i) => i !== bIndex),
      })
    },
    [flow, onUpdate]
  )

  const addBranchStep = useCallback(
    (bIndex: number, status: LoadStatus, note?: string) => {
      const branches = [...(flow.branches || [])]
      branches[bIndex] = {
        ...branches[bIndex],
        steps: [...branches[bIndex].steps, { status, note }],
      }
      onUpdate({ ...flow, branches })
    },
    [flow, onUpdate]
  )

  const removeBranchStep = useCallback(
    (bIndex: number, sIndex: number) => {
      const branches = [...(flow.branches || [])]
      branches[bIndex] = {
        ...branches[bIndex],
        steps: branches[bIndex].steps.filter((_, i) => i !== sIndex),
      }
      onUpdate({ ...flow, branches })
    },
    [flow, onUpdate]
  )

  return (
    <div className="bg-[#111827] rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-3 hover:bg-white/[0.02] transition-colors text-left"
        >
          <span className="text-xl">{flow.icon}</span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">{flow.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{flow.description}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {editable && (
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
              title="Delete this flow"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <svg
            onClick={() => setExpanded(!expanded)}
            className={`w-4 h-4 text-gray-500 transition-transform cursor-pointer ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          {/* Main Flow */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-[#E8700A] rounded-full" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Primary Flow
              </span>
              <span className="text-[10px] text-gray-600">
                ({flow.mainFlow.length} steps)
              </span>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex items-start gap-0 min-w-min">
                {flow.mainFlow.map((step, i) => (
                  <div key={`${step.status}-${i}`} className="flex items-center">
                    <FlowNode
                      status={step.status}
                      note={step.note}
                      isOptional={flow.optionalSteps?.includes(step.status)}
                      editable={editable}
                      onDelete={() => removeMainStep(i)}
                    />
                    {i < flow.mainFlow.length - 1 && <FlowArrow />}
                  </div>
                ))}
                {editable && (
                  <>
                    {flow.mainFlow.length > 0 && <FlowArrow />}
                    <AddStepButton onAdd={addMainStep} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Alternate Branches */}
          {((flow.branches && flow.branches.length > 0) || editable) && (
            <div className="space-y-4">
              {(flow.branches || []).map((branch, bIdx) => (
                <div key={`${branch.label}-${bIdx}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 bg-purple-500/60 rounded-full" />
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {branch.label}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      (alternate path)
                    </span>
                    {editable && (
                      <button
                        onClick={() => removeBranch(bIdx)}
                        className="ml-auto p-1 text-gray-500 hover:text-red-400 transition-colors"
                        title="Remove branch"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto pb-2 pl-3 border-l border-purple-500/20">
                    <div className="flex items-start gap-0 min-w-min">
                      {branch.steps.map((step, sIdx) => (
                        <div key={`${step.status}-${sIdx}`} className="flex items-center">
                          <FlowNode
                            status={step.status}
                            note={step.note}
                            compact
                            editable={editable}
                            onDelete={() => removeBranchStep(bIdx, sIdx)}
                          />
                          {sIdx < branch.steps.length - 1 && <FlowArrow compact />}
                        </div>
                      ))}
                      {editable && (
                        <>
                          {branch.steps.length > 0 && <FlowArrow compact />}
                          <AddStepButton
                            onAdd={(status, note) => addBranchStep(bIdx, status, note)}
                            compact
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {editable && (
                <button
                  onClick={addBranch}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-400 border border-dashed border-white/10 hover:border-purple-500/30 rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Branch
                </button>
              )}
            </div>
          )}

          {/* Legend for optional */}
          {flow.optionalSteps && flow.optionalSteps.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <div className="px-2 py-0.5 rounded border border-dashed border-white/20 text-[9px] text-gray-500 opacity-70">
                Dashed
              </div>
              <span className="text-[10px] text-gray-600">
                = optional step (may be skipped depending on the load)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add New Flow Type Modal ─────────────────────────────────
function AddFlowModal({
  onAdd,
  onClose,
}: {
  onAdd: (flow: LoadTypeFlow) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("📋")
  const [description, setDescription] = useState("")

  const handleSubmit = () => {
    if (!name.trim()) return
    onAdd({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name: name.trim(),
      icon,
      description: description.trim(),
      mainFlow: [],
      branches: [],
      optionalSteps: [],
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#111827] border border-white/10 rounded-xl p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Add Load Type Flow</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
            Icon (emoji)
          </label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={2}
            className="w-16 bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-xl text-center focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Transload"
            className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this load type flow"
            className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-1.5 text-sm bg-[#E8700A] hover:bg-[#FF9500] text-white rounded font-medium transition-colors disabled:opacity-50"
          >
            Add Flow
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────
export function LoadTypeFlowCharts() {
  const [flows, setFlows] = useState<LoadTypeFlow[]>(DEFAULT_FLOWS)
  const [editable, setEditable] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleUpdate = useCallback((index: number, updated: LoadTypeFlow) => {
    setFlows((prev) => prev.map((f, i) => (i === index ? updated : f)))
    setHasChanges(true)
  }, [])

  const handleDelete = useCallback((index: number) => {
    if (!confirm(`Delete the "${flows[index].name}" flow chart?`)) return
    setFlows((prev) => prev.filter((_, i) => i !== index))
    setHasChanges(true)
  }, [flows])

  const handleAddFlow = useCallback((flow: LoadTypeFlow) => {
    setFlows((prev) => [...prev, flow])
    setShowAddModal(false)
    setHasChanges(true)
  }, [])

  const handleReset = useCallback(() => {
    if (!confirm("Reset all flow charts to defaults? Your changes will be lost.")) return
    setFlows(DEFAULT_FLOWS)
    setHasChanges(false)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Example Flows by Load Type</h3>
          <p className="text-sm text-gray-500 mt-1">
            Typical status progression for each load type. {editable ? "Click nodes to remove, use + to add." : "Toggle edit mode to modify."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editable && hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-yellow-400 border border-white/10 rounded-lg transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            onClick={() => setEditable(!editable)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              editable
                ? "bg-[#E8700A] text-white hover:bg-[#FF9500]"
                : "text-gray-400 hover:text-gray-300 border border-white/10 hover:bg-white/5"
            }`}
          >
            {editable ? (
              <>
                <Save className="w-3 h-3" />
                Done Editing
              </>
            ) : (
              "Edit Flows"
            )}
          </button>
        </div>
      </div>

      {flows.map((flow, index) => (
        <FlowChart
          key={flow.id}
          flow={flow}
          onUpdate={(updated) => handleUpdate(index, updated)}
          onDelete={() => handleDelete(index)}
          editable={editable}
        />
      ))}

      {editable && (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 border border-dashed border-white/10 hover:border-[#E8700A]/40 rounded-xl text-gray-400 hover:text-[#E8700A] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add Load Type Flow</span>
        </button>
      )}

      {showAddModal && (
        <AddFlowModal
          onAdd={handleAddFlow}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
