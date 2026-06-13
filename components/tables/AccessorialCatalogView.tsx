"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Search, Plus, Pencil, X, Loader2, ToggleLeft, ToggleRight } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────
type TriggerType = "load_property" | "event_threshold" | "location_type" | "container_size" | "load_type" | "manual"
type ChargeType = "fixed" | "percentage" | "tiered" | "per_hour" | "per_mile"

interface Accessorial {
  id: string
  code: string
  name: string
  description: string | null
  charge_type: ChargeType
  default_amount: number | null
  trigger_type: TriggerType | null
  trigger_config: Record<string, unknown> | null
  container_sizes: string[] | null
  load_types: string[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface DriverGroup {
  id: string
  name: string
  assignment_count: number
}

interface AccessorialGroupRule {
  id: string
  accessorial_id: string
  group_id: string
  driver_groups?: { name: string }
}

interface AccessorialCatalogViewProps {
  // No props - self-contained with own data fetching
}

// ─── Charge Type Badge ────────────────────────────────────────
function ChargeTypeBadge({ type }: { type: ChargeType }) {
  const variants: Record<ChargeType, { bg: string; text: string; label: string }> = {
    fixed: { bg: "bg-green-500/10", text: "text-green-400", label: "Fixed" },
    per_hour: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Per Hour" },
    per_mile: { bg: "bg-purple-500/10", text: "text-purple-400", label: "Per Mile" },
    percentage: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Percentage" },
    tiered: { bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Tiered" },
  }

  const variant = variants[type]

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variant.bg} ${variant.text}`}>
      {variant.label}
    </span>
  )
}

// ─── Trigger Config Display Helper ────────────────────────────
function getTriggerDisplay(trigger_type: TriggerType | null, trigger_config: Record<string, unknown> | null): string {
  if (!trigger_type || trigger_type === "manual") {
    return "Manually applied"
  }

  if (!trigger_config) return "—"

  switch (trigger_type) {
    case "load_property":
      const field = (trigger_config as any).field || ""
      const value = (trigger_config as any).value
      const fieldLabel = field.replace(/_/g, " ").replace(/is /g, "").toLowerCase()
      return value ? `When load is ${fieldLabel}` : `When load is not ${fieldLabel}`

    case "event_threshold":
      const thresholdField = (trigger_config as any).field || ""
      const operator = (trigger_config as any).operator || ">"
      const threshold = (trigger_config as any).threshold || "0"
      const thresholdLabel = thresholdField === "detention_hours" ? "detention > " : "yard storage > "
      return `When ${thresholdLabel}${threshold}`

    case "location_type":
      return `Delivery type: ${(trigger_config as any).location_type || "—"}`

    case "container_size":
      const sizes = (trigger_config as any).sizes || []
      return sizes.length > 0 ? `Container sizes: ${sizes.join(", ")}` : "—"

    case "load_type":
      const types = (trigger_config as any).types || []
      return types.length > 0 ? `Load types: ${types.join(", ")}` : "—"

    default:
      return "—"
  }
}

// ─── Format Amount ────────────────────────────────────────────
function formatAmount(amount: number | null, chargeType: ChargeType): string {
  if (amount === null || amount === undefined) return "—"

  switch (chargeType) {
    case "fixed":
      return `$${amount.toFixed(2)}`
    case "per_hour":
      return `$${amount.toFixed(2)}/hr`
    case "per_mile":
      return `$${amount.toFixed(2)}/mi`
    case "percentage":
      return `${amount.toFixed(2)}%`
    case "tiered":
      return `$${amount.toFixed(2)}`
    default:
      return `$${amount.toFixed(2)}`
  }
}

// ─── Add/Edit Accessorial Modal ────────────────────────────────
interface AddAccessorialModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Accessorial>, groups: string[]) => Promise<void>
  initialData?: Accessorial | null
  driverGroups: DriverGroup[]
  selectedGroups?: string[]
}

function AddAccessorialModal({
  open,
  onClose,
  onSave,
  initialData,
  driverGroups,
  selectedGroups = [],
}: AddAccessorialModalProps) {
  const isEdit = Boolean(initialData)
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [chargeType, setChargeType] = useState<ChargeType>("fixed")
  const [defaultAmount, setDefaultAmount] = useState("")
  const [triggerType, setTriggerType] = useState<TriggerType>("manual")
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({})
  const [containerSizes, setContainerSizes] = useState<string[]>([])
  const [loadTypes, setLoadTypes] = useState<string[]>([])
  const [groupsSelected, setGroupsSelected] = useState<string[]>(selectedGroups)

  // Initialize form from initial data
  useEffect(() => {
    if (initialData) {
      setCode(initialData.code)
      setName(initialData.name)
      setDescription(initialData.description || "")
      setChargeType(initialData.charge_type)
      setDefaultAmount(initialData.default_amount?.toString() || "")
      setTriggerType(initialData.trigger_type || "manual")
      setTriggerConfig(initialData.trigger_config || {})
      setContainerSizes(initialData.container_sizes || [])
      setLoadTypes(initialData.load_types || [])
      setGroupsSelected(selectedGroups)
    } else {
      // Reset for new entry
      setCode("")
      setName("")
      setDescription("")
      setChargeType("fixed")
      setDefaultAmount("")
      setTriggerType("manual")
      setTriggerConfig({})
      setContainerSizes([])
      setLoadTypes([])
      setGroupsSelected(driverGroups.map((g) => g.id))
    }
  }, [initialData, open, driverGroups, selectedGroups])

  if (!open) return null

  const handleSave = async () => {
    if (!code.trim() || !name.trim()) {
      alert("Code and Name are required")
      return
    }

    setLoading(true)
    try {
      const formData: Partial<Accessorial> = {
        code: code.toUpperCase(),
        name,
        description: description || null,
        charge_type: chargeType,
        default_amount: defaultAmount ? parseFloat(defaultAmount) : null,
        trigger_type: triggerType,
        trigger_config: triggerConfig || null,
        container_sizes: containerSizes.length > 0 ? containerSizes : null,
        load_types: loadTypes.length > 0 ? loadTypes : null,
      }

      if (initialData) {
        formData.id = initialData.id
      }

      await onSave(formData, groupsSelected)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleLoadPropertyChange = (field: string, value: boolean) => {
    setTriggerConfig({ field, value })
  }

  const handleEventThresholdChange = (field: string, operator: string, threshold: string) => {
    setTriggerConfig({
      field,
      operator,
      threshold: parseInt(threshold) || 0,
    })
  }

  const handleLocationTypeChange = (locationType: string) => {
    setTriggerConfig({ location_type: locationType })
  }

  const handleContainerSizeToggle = (size: string) => {
    setTriggerConfig((prev) => {
      const sizes = (prev.sizes as string[]) || []
      const newSizes = sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size]
      return { ...prev, sizes: newSizes }
    })
  }

  const handleLoadTypeToggle = (type: string) => {
    setTriggerConfig((prev) => {
      const types = (prev.types as string[]) || []
      const newTypes = types.includes(type) ? types.filter((t) => t !== type) : [...types, type]
      return { ...prev, types: newTypes }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#1e2330] border border-[#363f52] rounded-2xl shadow-2xl flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#363f52] bg-[#242938]">
          <h2 className="text-lg font-bold text-white">{isEdit ? "Edit Accessorial" : "Add New Accessorial"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#2a3040] rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-300px)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. DETENTION"
                className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Detention"
                className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Charge Type *
              </label>
              <select
                value={chargeType}
                onChange={(e) => setChargeType(e.target.value as ChargeType)}
                className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              >
                <option value="fixed">Fixed</option>
                <option value="per_hour">Per Hour</option>
                <option value="per_mile">Per Mile</option>
                <option value="percentage">Percentage</option>
                <option value="tiered">Tiered</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Default Amount
              </label>
              <input
                type="number"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Trigger Type *
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
            >
              <option value="manual">Manual Application</option>
              <option value="load_property">Load Property</option>
              <option value="event_threshold">Event Threshold</option>
              <option value="location_type">Location Type</option>
              <option value="container_size">Container Size</option>
              <option value="load_type">Load Type</option>
            </select>
          </div>

          {/* Trigger Config Sections */}
          {triggerType === "load_property" && (
            <div className="bg-[#2a3040]/50 border border-[#363f52] rounded-lg p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">LOAD PROPERTY CONFIGURATION</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Property
                  </label>
                  <select
                    value={(triggerConfig as any)?.field || ""}
                    onChange={(e) => handleLoadPropertyChange(e.target.value, (triggerConfig as any)?.value || false)}
                    className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                  >
                    <option value="">Select property</option>
                    <option value="is_hazmat">Hazmat</option>
                    <option value="is_overweight">Overweight</option>
                    <option value="is_reefer">Reefer</option>
                    <option value="is_pre_pull">Pre-Pull</option>
                    <option value="is_chassis_split">Chassis Split</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Value
                  </label>
                  <select
                    value={(triggerConfig as any)?.value ? "true" : "false"}
                    onChange={(e) => handleLoadPropertyChange((triggerConfig as any)?.field || "", e.target.value === "true")}
                    className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {triggerType === "event_threshold" && (
            <div className="bg-[#2a3040]/50 border border-[#363f52] rounded-lg p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">EVENT THRESHOLD CONFIGURATION</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Field
                  </label>
                  <select
                    value={(triggerConfig as any)?.field || ""}
                    onChange={(e) =>
                      handleEventThresholdChange(
                        e.target.value,
                        (triggerConfig as any)?.operator || ">",
                        (triggerConfig as any)?.threshold?.toString() || "0"
                      )
                    }
                    className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                  >
                    <option value="">Select field</option>
                    <option value="detention_hours">Detention Hours</option>
                    <option value="yard_storage_days">Yard Storage Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Operator
                  </label>
                  <select
                    value={(triggerConfig as any)?.operator || ">"}
                    onChange={(e) =>
                      handleEventThresholdChange(
                        (triggerConfig as any)?.field || "",
                        e.target.value,
                        (triggerConfig as any)?.threshold?.toString() || "0"
                      )
                    }
                    className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                  >
                    <option value=">">Greater Than</option>
                    <option value=">=">Greater or Equal</option>
                    <option value="=">Equal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                    Threshold
                  </label>
                  <input
                    type="number"
                    value={(triggerConfig as any)?.threshold || ""}
                    onChange={(e) =>
                      handleEventThresholdChange(
                        (triggerConfig as any)?.field || "",
                        (triggerConfig as any)?.operator || ">",
                        e.target.value
                      )
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
                  />
                </div>
              </div>
            </div>
          )}

          {triggerType === "location_type" && (
            <div className="bg-[#2a3040]/50 border border-[#363f52] rounded-lg p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">LOCATION TYPE CONFIGURATION</p>
              <select
                value={(triggerConfig as any)?.location_type || ""}
                onChange={(e) => handleLocationTypeChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              >
                <option value="">Select location type</option>
                <option value="residential">Residential</option>
                <option value="warehouse">Warehouse</option>
                <option value="port">Port</option>
              </select>
            </div>
          )}

          {triggerType === "container_size" && (
            <div className="bg-[#2a3040]/50 border border-[#363f52] rounded-lg p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">CONTAINER SIZES</p>
              <div className="flex flex-wrap gap-3">
                {["20", "40", "45"].map((size) => (
                  <label key={size} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={((triggerConfig as any)?.sizes || []).includes(size)}
                      onChange={() => handleContainerSizeToggle(size)}
                      className="w-4 h-4 rounded border-[#363f52] bg-white/5"
                    />
                    <span className="text-sm text-gray-300">{size}ft</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {triggerType === "load_type" && (
            <div className="bg-[#2a3040]/50 border border-[#363f52] rounded-lg p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">LOAD TYPES</p>
              <div className="flex flex-wrap gap-3">
                {["Import", "Export"].map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={((triggerConfig as any)?.types || []).includes(type)}
                      onChange={() => handleLoadTypeToggle(type)}
                      className="w-4 h-4 rounded border-[#363f52] bg-white/5"
                    />
                    <span className="text-sm text-gray-300">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {triggerType === "manual" && (
            <div className="bg-[#2a3040]/50 border border-[#363f52] rounded-lg p-4">
              <p className="text-sm text-gray-300">Dispatcher manually applies this charge per load</p>
            </div>
          )}

          {/* Container Sizes Restriction */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Container Size Restriction (optional)
            </label>
            <div className="flex flex-wrap gap-3">
              {["All", "20", "40", "45"].map((size) => (
                <label key={size} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={size === "All" ? containerSizes.length === 0 : containerSizes.includes(size)}
                    onChange={(e) => {
                      if (size === "All") {
                        setContainerSizes([])
                      } else {
                        const updated = containerSizes.includes(size)
                          ? containerSizes.filter((s) => s !== size)
                          : [...containerSizes, size]
                        setContainerSizes(updated)
                      }
                    }}
                    className="w-4 h-4 rounded border-[#363f52] bg-white/5"
                  />
                  <span className="text-sm text-gray-300">{size}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Load Type Restriction */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Load Type Restriction (optional)
            </label>
            <div className="flex flex-wrap gap-3">
              {["All", "Import", "Export"].map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={type === "All" ? loadTypes.length === 0 : loadTypes.includes(type)}
                    onChange={(e) => {
                      if (type === "All") {
                        setLoadTypes([])
                      } else {
                        const updated = loadTypes.includes(type)
                          ? loadTypes.filter((t) => t !== type)
                          : [...loadTypes, type]
                        setLoadTypes(updated)
                      }
                    }}
                    className="w-4 h-4 rounded border-[#363f52] bg-white/5"
                  />
                  <span className="text-sm text-gray-300">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Driver Groups */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Driver Groups
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {driverGroups.length > 0 ? (
                driverGroups.map((group) => (
                  <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupsSelected.includes(group.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setGroupsSelected([...groupsSelected, group.id])
                        } else {
                          setGroupsSelected(groupsSelected.filter((id) => id !== group.id))
                        }
                      }}
                      className="w-4 h-4 rounded border-[#363f52] bg-white/5"
                    />
                    <span className="text-sm text-gray-300">{group.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-gray-500">No driver groups available</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#363f52] bg-[#242938]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────
export function AccessorialCatalogView({}: AccessorialCatalogViewProps) {
  const [accessorials, setAccessorials] = useState<Accessorial[]>([])
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([])
  const [groupRules, setGroupRules] = useState<AccessorialGroupRule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [chargeTypeFilter, setChargeTypeFilter] = useState<"all" | ChargeType>("all")
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<"all" | TriggerType>("all")
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAccessorial, setEditingAccessorial] = useState<Accessorial | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [accessorialsRes, groupsRes] = await Promise.all([
          fetch("/api/drivers/pay-rates/accessorials?all=true"),
          fetch("/api/drivers/pay-rates/groups"),
        ])

        if (!accessorialsRes.ok || !groupsRes.ok) {
          throw new Error("Failed to fetch data")
        }

        const accessorialsData = await accessorialsRes.json()
        const groupsData = await groupsRes.json()

        setAccessorials(accessorialsData.accessorials || [])
        setGroupRules(accessorialsData.groupRules || [])
        setDriverGroups(groupsData.groups || [])
      } catch (error) {
        console.error("Error fetching data:", error)
        alert("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Helper to get group display name for an accessorial
  const getGroupDisplay = (accessorialId: string): string => {
    const rules = groupRules.filter((r) => r.accessorial_id === accessorialId)
    if (rules.length === 0) return "All groups"
    if (rules.length === driverGroups.length) return "All groups"
    return rules
      .map((r) => {
        const group = driverGroups.find((g) => g.id === r.group_id)
        return group?.name || "Unknown"
      })
      .join(", ")
  }

  // Filter accessorials
  const filteredAccessorials = useMemo(() => {
    return accessorials.filter((acc) => {
      const matchesSearch =
        acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesChargeType = chargeTypeFilter === "all" || acc.charge_type === chargeTypeFilter
      const matchesTriggerType = triggerTypeFilter === "all" || acc.trigger_type === triggerTypeFilter

      return matchesSearch && matchesChargeType && matchesTriggerType
    })
  }, [accessorials, searchQuery, chargeTypeFilter, triggerTypeFilter])

  // Handle save (create or update)
  const handleSave = useCallback(
    async (data: Partial<Accessorial>, selectedGroups: string[]) => {
      try {
        setIsSaving(true)

        const isEdit = Boolean(data.id)
        const method = isEdit ? "PATCH" : "POST"
        const url = "/api/drivers/pay-rates/accessorials"

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, group_ids: selectedGroups }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Failed to ${isEdit ? "update" : "create"} accessorial`)
        }

        const result = await response.json()

        if (isEdit) {
          setAccessorials(accessorials.map((acc) => (acc.id === data.id ? result.accessorial : acc)))
        } else {
          setAccessorials([...accessorials, result.accessorial])
        }

        // Refresh group rules
        const rulesRes = await fetch("/api/drivers/pay-rates/accessorials?all=true")
        if (rulesRes.ok) {
          const rulesData = await rulesRes.json()
          setGroupRules(rulesData.groupRules || [])
        }

        setShowAddModal(false)
        setEditingAccessorial(null)
      } catch (error) {
        console.error("Error saving accessorial:", error)
        alert(error instanceof Error ? error.message : "Failed to save accessorial")
      } finally {
        setIsSaving(false)
      }
    },
    [accessorials]
  )

  // Handle toggle active/inactive
  const handleToggleActive = useCallback(
    async (accessorial: Accessorial) => {
      try {
        const response = await fetch("/api/drivers/pay-rates/accessorials", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: accessorial.id,
            is_active: !accessorial.is_active,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to update status")
        }

        const result = await response.json()
        setAccessorials(accessorials.map((acc) => (acc.id === accessorial.id ? result.accessorial : acc)))
      } catch (error) {
        console.error("Error toggling status:", error)
        alert("Failed to update status")
      }
    },
    [accessorials]
  )

  const handleEdit = (accessorial: Accessorial) => {
    setEditingAccessorial(accessorial)
    setShowAddModal(true)
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingAccessorial(null)
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Accessorial Catalog</h1>
            <p className="text-sm text-gray-400 mt-1">{filteredAccessorials.length} Accessorials</p>
          </div>
          <button
            onClick={() => {
              setEditingAccessorial(null)
              setShowAddModal(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#E8700A] hover:bg-[#FF8C21] text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Accessorial
          </button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by code, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#2a3040] border border-[#363f52] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setChargeTypeFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                chargeTypeFilter === "all"
                  ? "bg-[#E8700A] text-white"
                  : "bg-[#2a3040] text-gray-400 hover:bg-[#363f52]"
              }`}
            >
              All Types
            </button>
            {(["fixed", "per_hour", "per_mile", "percentage"] as ChargeType[]).map((type) => (
              <button
                key={type}
                onClick={() => setChargeTypeFilter(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  chargeTypeFilter === type
                    ? "bg-[#E8700A] text-white"
                    : "bg-[#2a3040] text-gray-400 hover:bg-[#363f52]"
                }`}
              >
                {type === "fixed" ? "Fixed" : type === "per_hour" ? "Per Hour" : type === "per_mile" ? "Per Mile" : "Percentage"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#E8700A]" />
        </div>
      ) : filteredAccessorials.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-400">No accessorials found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#363f52]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#363f52] bg-[#242938]">
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Trigger</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Groups</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-400">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a3040]">
              {filteredAccessorials.map((accessorial) => (
                <tr key={accessorial.id} className="bg-[#1e2330] hover:bg-[#262c3a] transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-[#E8700A] font-bold">{accessorial.code}</span>
                  </td>
                  <td className="px-4 py-3 text-white">{accessorial.name}</td>
                  <td className="px-4 py-3">
                    <ChargeTypeBadge type={accessorial.charge_type} />
                  </td>
                  <td className="px-4 py-3 text-white">{formatAmount(accessorial.default_amount, accessorial.charge_type)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {getTriggerDisplay(accessorial.trigger_type, accessorial.trigger_config)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {getGroupDisplay(accessorial.id)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {accessorial.is_active ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <span className="text-green-400 text-xs font-medium">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-gray-500" />
                          <span className="text-gray-400 text-xs font-medium">Inactive</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(accessorial)}
                        className="p-1.5 hover:bg-[#2a3040] rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4 text-gray-400 hover:text-white" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(accessorial)}
                        className="p-1.5 hover:bg-[#2a3040] rounded transition-colors"
                        title={accessorial.is_active ? "Deactivate" : "Activate"}
                      >
                        {accessorial.is_active ? (
                          <ToggleRight className="w-4 h-4 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <AddAccessorialModal
        open={showAddModal}
        onClose={handleCloseModal}
        onSave={handleSave}
        initialData={editingAccessorial}
        driverGroups={driverGroups}
        selectedGroups={
          editingAccessorial
            ? groupRules.filter((r) => r.accessorial_id === editingAccessorial.id).map((r) => r.group_id)
            : driverGroups.map((g) => g.id)
        }
      />
    </div>
  )
}
