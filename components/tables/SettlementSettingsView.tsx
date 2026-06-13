"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Search, Plus, X, Loader2, Users,
  Settings2, Trash2, ToggleLeft, ToggleRight, Calendar,
  DollarSign, AlertCircle, Check, Copy,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────
type Driver = {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  phone: string
  email: string | null
  truck_owner: string | null
  truck_number: string | null
  enabled: boolean
  status: string
  driver_pay: number | null
  driver_pay_notes: string | null
}

type DeductionTemplate = {
  id: string
  name: string
  description: string | null
  deduction_type: string
  math_operation: string
  frequency: string
  default_amount: number
  sort_order: number
  enabled: boolean
  created_at: string
  updated_at: string
}

type DriverDeductionSetting = {
  id: string
  driver_id: string
  template_id: string
  amount: number
  enabled: boolean
  limit_total: number | null
  limit_per_period: number | null
  total_deducted: number | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type DriverGroup = {
  id: string
  name: string
  pay_type: string
}

type DriverGroupAssignment = {
  driver_id: string
  driver_group_id: string
}

interface SettlementSettingsViewProps {
  drivers: Driver[]
}

// ─── Shared Styles ──────────────────────────────────────────────
const S = {
  panel: "bg-[#1e2330] border-[#2a3040]",
  panelHeader: "bg-[#242938] border-[#2a3040]",
  input: "bg-[#2a3040] border-[#363f52] text-white placeholder-gray-500 focus:border-[#E8700A] focus:outline-none",
  btn: "transition-colors text-xs font-medium rounded-lg",
  divider: "border-[#2a3040]",
}

// ─── Helpers ────────────────────────────────────────────────────
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

function getColorForInitials(name: string): string {
  const colors = [
    "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500",
    "bg-green-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500",
    "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-purple-500",
    "bg-pink-500", "bg-rose-500",
  ]
  const hashCode = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hashCode % colors.length]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

function getSettlementPeriod(periodType: string = "Weekly", startDay: string = "Saturday"): { startDate: Date; endDate: Date } {
  const today = new Date()
  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  }
  const targetDay = dayMap[startDay] ?? 6

  if (periodType === "Daily") {
    const startDate = new Date(today)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setHours(23, 59, 59, 999)
    return { startDate, endDate }
  }

  if (periodType === "Monthly") {
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    endDate.setHours(23, 59, 59, 999)
    return { startDate, endDate }
  }

  // Weekly or Bi-Weekly
  const currentDay = today.getDay()
  let diff = currentDay - targetDay
  if (diff < 0) diff += 7
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - diff)
  startDate.setHours(0, 0, 0, 0)

  const periodDays = periodType === "Bi-Weekly" ? 13 : 6
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + periodDays)
  endDate.setHours(23, 59, 59, 999)

  return { startDate, endDate }
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const year = String(date.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
}

// ─── Template Management Modal ─────────────────────────────────
function TemplateModal({
  templates,
  onClose,
  onSave,
}: {
  templates: DeductionTemplate[]
  onClose: () => void
  onSave: () => void
}) {
  const [localTemplates, setLocalTemplates] = useState<DeductionTemplate[]>(templates)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("Fixed")
  const [newFreq, setNewFreq] = useState("Weekly")
  const [newDefault, setNewDefault] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editField, setEditField] = useState<{ field: string; value: string }>({ field: "", value: "" })

  const handleAddTemplate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/drivers/settlement-settings/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          deduction_type: newType,
          frequency: newFreq,
          default_amount: parseFloat(newDefault) || 0,
          sort_order: localTemplates.length + 1,
        }),
      })
      if (res.ok) {
        const { template } = await res.json()
        setLocalTemplates((prev) => [...prev, template])
        setNewName("")
        setNewDefault("")
        onSave()
      }
    } catch (err) {
      console.error("Error adding template:", err)
    }
    setSaving(false)
  }

  const handleToggleEnabled = async (tmpl: DeductionTemplate) => {
    try {
      const res = await fetch("/api/drivers/settlement-settings/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tmpl.id, enabled: !tmpl.enabled }),
      })
      if (res.ok) {
        setLocalTemplates((prev) =>
          prev.map((t) => (t.id === tmpl.id ? { ...t, enabled: !t.enabled } : t))
        )
        onSave()
      }
    } catch (err) {
      console.error("Error toggling template:", err)
    }
  }

  const handleDeleteTemplate = async (tmpl: DeductionTemplate) => {
    try {
      const res = await fetch(`/api/drivers/settlement-settings/templates?id=${tmpl.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setLocalTemplates((prev) => prev.filter((t) => t.id !== tmpl.id))
        onSave()
      }
    } catch (err) {
      console.error("Error deleting template:", err)
    }
  }

  const handleInlineEdit = async (tmpl: DeductionTemplate, field: string, value: string) => {
    const body: Record<string, unknown> = { id: tmpl.id }
    if (field === "name") body.name = value
    else if (field === "default_amount") body.default_amount = parseFloat(value) || 0
    else if (field === "frequency") body.frequency = value
    else if (field === "deduction_type") body.deduction_type = value

    try {
      const res = await fetch("/api/drivers/settlement-settings/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const { template } = await res.json()
        setLocalTemplates((prev) => prev.map((t) => (t.id === tmpl.id ? template : t)))
        onSave()
      }
    } catch (err) {
      console.error("Error updating template:", err)
    }
    setEditingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-3xl ${S.panel} border rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-96px)]`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${S.panelHeader}`}>
          <div className="flex items-center gap-2">
            <Settings2 size={18} className="text-[#E8700A]" />
            <h2 className="text-lg font-bold text-white">Manage Deduction Templates</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4">
          {/* Existing templates */}
          <div className="space-y-1">
            {localTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${S.divider} ${
                  tmpl.enabled ? "bg-[#242938]" : "bg-[#1a1f2e] opacity-60"
                }`}
              >
                <button
                  onClick={() => handleToggleEnabled(tmpl)}
                  className="flex-shrink-0"
                  title={tmpl.enabled ? "Disable" : "Enable"}
                >
                  {tmpl.enabled ? (
                    <ToggleRight size={20} className="text-green-400" />
                  ) : (
                    <ToggleLeft size={20} className="text-gray-500" />
                  )}
                </button>

                {/* Name */}
                {editingId === tmpl.id && editField.field === "name" ? (
                  <input
                    autoFocus
                    className={`text-sm rounded px-2 py-1 w-40 border ${S.input}`}
                    value={editField.value}
                    onChange={(e) => setEditField({ ...editField, value: e.target.value })}
                    onBlur={() => handleInlineEdit(tmpl, "name", editField.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineEdit(tmpl, "name", editField.value)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                  />
                ) : (
                  <span
                    className="text-sm text-white font-medium w-40 truncate cursor-pointer hover:text-[#E8700A]"
                    onClick={() => { setEditingId(tmpl.id); setEditField({ field: "name", value: tmpl.name }) }}
                  >
                    {tmpl.name}
                  </span>
                )}

                {/* Type badge */}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex-shrink-0">
                  {tmpl.deduction_type}
                </span>

                {/* Frequency badge */}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 flex-shrink-0">
                  {tmpl.frequency}
                </span>

                {/* Default amount */}
                {editingId === tmpl.id && editField.field === "default_amount" ? (
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    className={`text-sm rounded px-2 py-1 w-24 border ${S.input}`}
                    value={editField.value}
                    onChange={(e) => setEditField({ ...editField, value: e.target.value })}
                    onBlur={() => handleInlineEdit(tmpl, "default_amount", editField.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleInlineEdit(tmpl, "default_amount", editField.value)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                  />
                ) : (
                  <span
                    className="text-sm text-gray-300 w-24 text-right cursor-pointer hover:text-[#E8700A]"
                    onClick={() => { setEditingId(tmpl.id); setEditField({ field: "default_amount", value: String(tmpl.default_amount) }) }}
                  >
                    {formatCurrency(tmpl.default_amount)}
                  </span>
                )}

                <div className="flex-1" />

                <button
                  onClick={() => handleDeleteTemplate(tmpl)}
                  className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors"
                  title="Delete template"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add new template */}
          <div className={`flex items-center gap-2 p-3 rounded-lg border border-dashed ${S.divider}`}>
            <Plus size={14} className="text-gray-500 flex-shrink-0" />
            <input
              placeholder="New deduction name..."
              className={`text-sm rounded px-2 py-1 flex-1 border ${S.input}`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddTemplate() }}
            />
            <select
              className={`text-xs rounded px-2 py-1.5 border ${S.input}`}
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            >
              <option value="Fixed">Fixed</option>
              <option value="Percentage">Percentage</option>
              <option value="Per Mile">Per Mile</option>
            </select>
            <select
              className={`text-xs rounded px-2 py-1.5 border ${S.input}`}
              value={newFreq}
              onChange={(e) => setNewFreq(e.target.value)}
            >
              <option value="Weekly">Weekly</option>
              <option value="Biweekly">Biweekly</option>
              <option value="Monthly">Monthly</option>
            </select>
            <input
              placeholder="Default $"
              type="number"
              step="0.01"
              className={`text-sm rounded px-2 py-1 w-24 border ${S.input}`}
              value={newDefault}
              onChange={(e) => setNewDefault(e.target.value)}
            />
            <button
              onClick={handleAddTemplate}
              disabled={!newName.trim() || saving}
              className={`px-3 py-1.5 ${S.btn} bg-[#E8700A] hover:bg-[#d4630a] text-white disabled:opacity-40`}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : "Add"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end px-6 py-3 border-t ${S.divider}`}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Driver Detail Panel ────────────────────────────────────────
function DriverDetailPanel({
  driver,
  templates,
  settings,
  onClose,
  onSettingChange,
  periodType = "Weekly",
  startDay = "Saturday",
}: {
  driver: Driver
  templates: DeductionTemplate[]
  settings: DriverDeductionSetting[]
  onClose: () => void
  onSettingChange: (driverId: string, templateId: string, updates: Partial<DriverDeductionSetting>) => void
  periodType?: string
  startDay?: string
}) {
  const driverSettings = settings.filter((s) => s.driver_id === driver.id)
  const enabledTemplates = templates.filter((t) => t.enabled)

  const totalScheduled = enabledTemplates.reduce((sum, tmpl) => {
    const ds = driverSettings.find((s) => s.template_id === tmpl.id)
    if (ds && ds.enabled) return sum + ds.amount
    return sum
  }, 0)

  const { startDate, endDate } = getSettlementPeriod(periodType, startDay)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-2xl ${S.panel} border rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-64px)]`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${S.panelHeader}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${getColorForInitials(driver.name)} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white font-semibold text-sm">{getInitials(driver.name)}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{driver.name}</h2>
              <p className="text-xs text-gray-400">
                {formatDate(startDate)} – {formatDate(endDate)}
                <span className="ml-3 text-[#E8700A] font-medium">
                  Projected: {formatCurrency(-totalScheduled)}
                </span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#242938] border border-[#2a3040] rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Truck</p>
              <p className="text-sm font-semibold text-white mt-0.5">{driver.truck_number || "—"}</p>
            </div>
            <div className="bg-[#242938] border border-[#2a3040] rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Fleet Owner</p>
              <p className="text-sm font-semibold text-white mt-0.5">{driver.truck_owner || "Company"}</p>
            </div>
            <div className="bg-[#242938] border border-[#2a3040] rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Active Deductions</p>
              <p className="text-sm font-semibold text-green-400 mt-0.5">
                {driverSettings.filter((s) => s.enabled).length} of {enabledTemplates.length}
              </p>
            </div>
          </div>

          {/* Per-deduction detail rows */}
          <div className="space-y-1">
            {enabledTemplates.map((tmpl) => {
              const ds = driverSettings.find((s) => s.template_id === tmpl.id)
              const amount = ds?.amount ?? tmpl.default_amount
              const isEnabled = ds?.enabled ?? false

              return (
                <div
                  key={tmpl.id}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg border ${S.divider} ${
                    isEnabled ? "bg-[#242938]" : "bg-[#1a1f2e] opacity-60"
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => onSettingChange(driver.id, tmpl.id, { enabled: !isEnabled })}
                    className="flex-shrink-0"
                  >
                    {isEnabled ? (
                      <ToggleRight size={20} className="text-green-400" />
                    ) : (
                      <ToggleLeft size={20} className="text-gray-500" />
                    )}
                  </button>

                  {/* Name */}
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm text-white font-medium">{tmpl.name}</p>
                    <p className="text-[10px] text-gray-500">{tmpl.deduction_type} · {tmpl.frequency}</p>
                  </div>

                  {/* Amount input */}
                  <div className="flex items-center gap-1 w-28">
                    <DollarSign size={12} className="text-gray-500" />
                    <input
                      type="number"
                      step="0.01"
                      className={`text-sm rounded px-2 py-1 w-full border ${S.input}`}
                      value={amount}
                      onChange={(e) => onSettingChange(driver.id, tmpl.id, { amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  {/* Limit */}
                  <div className="flex items-center gap-1 w-28">
                    <span className="text-[10px] text-gray-500">Limit:</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="None"
                      className={`text-sm rounded px-2 py-1 w-full border ${S.input}`}
                      value={ds?.limit_total ?? ""}
                      onChange={(e) => onSettingChange(driver.id, tmpl.id, {
                        limit_total: e.target.value ? parseFloat(e.target.value) : null,
                      })}
                    />
                  </div>

                  {/* Start/End dates */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Calendar size={10} className="text-gray-500" />
                    <input
                      type="date"
                      className={`text-[10px] rounded px-1 py-0.5 border ${S.input} w-[100px]`}
                      value={ds?.start_date || ""}
                      onChange={(e) => onSettingChange(driver.id, tmpl.id, { start_date: e.target.value || null })}
                    />
                    <span className="text-gray-600 text-[10px]">–</span>
                    <input
                      type="date"
                      className={`text-[10px] rounded px-1 py-0.5 border ${S.input} w-[100px]`}
                      value={ds?.end_date || ""}
                      onChange={(e) => onSettingChange(driver.id, tmpl.id, { end_date: e.target.value || null })}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end px-6 py-3 border-t ${S.divider}`}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Batch Apply Modal ──────────────────────────────────────────
function BatchApplyModal({
  templates,
  drivers,
  groups,
  groupAssignments,
  onClose,
  onApply,
}: {
  templates: DeductionTemplate[]
  drivers: Driver[]
  groups: DriverGroup[]
  groupAssignments: DriverGroupAssignment[]
  onClose: () => void
  onApply: (driverIds: string[], templateId: string, amount: number) => void
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || "")
  const [amount, setAmount] = useState("")
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState<"all" | "group" | "manual">("all")
  const [selectedGroupId, setSelectedGroupId] = useState("")

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  useEffect(() => {
    if (selectedTemplate) setAmount(String(selectedTemplate.default_amount))
  }, [selectedTemplateId, selectedTemplate])

  // Update selectedDriverIds based on selectMode + selectedGroupId
  useEffect(() => {
    if (selectMode === "all") {
      setSelectedDriverIds(new Set(drivers.filter((d) => d.enabled).map((d) => d.id)))
    } else if (selectMode === "group") {
      if (selectedGroupId) {
        const memberIds = groupAssignments
          .filter((a) => a.driver_group_id === selectedGroupId)
          .map((a) => a.driver_id)
        setSelectedDriverIds(new Set(memberIds))
      } else {
        setSelectedDriverIds(new Set())
      }
    }
    // "manual" mode: don't reset, user picks individually
  }, [selectMode, drivers, selectedGroupId, groupAssignments])

  const handleApply = () => {
    if (!selectedTemplateId || selectedDriverIds.size === 0) return
    onApply(Array.from(selectedDriverIds), selectedTemplateId, parseFloat(amount) || 0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg ${S.panel} border rounded-2xl shadow-2xl flex flex-col`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${S.panelHeader}`}>
          <div className="flex items-center gap-2">
            <Copy size={16} className="text-[#E8700A]" />
            <h2 className="text-base font-bold text-white">Batch Apply Deduction</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Template selector */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deduction Template</label>
            <select
              className={`text-sm rounded-lg px-3 py-2 w-full border ${S.input}`}
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
            >
              {templates.filter((t) => t.enabled).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="number"
                step="0.01"
                className={`text-sm rounded-lg pl-8 pr-3 py-2 w-full border ${S.input}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Driver selection mode */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Apply To</label>
            <div className="flex gap-2">
              {(["all", "group", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectMode(mode)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    selectMode === mode
                      ? "bg-[#E8700A]/20 border-[#E8700A]/40 text-[#E8700A]"
                      : "bg-[#2a3040] border-[#363f52] text-gray-400 hover:text-white"
                  }`}
                >
                  {mode === "all" ? "All Enabled Drivers" : mode === "group" ? "By Group" : "Select Manually"}
                </button>
              ))}
            </div>
          </div>

          {selectMode === "group" && (
            <select
              className={`text-sm rounded-lg px-3 py-2 w-full border ${S.input}`}
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
            >
              <option value="">Select a group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}

          {selectMode === "manual" && (
            <div className="max-h-40 overflow-y-auto border border-[#363f52] rounded-lg">
              {drivers.filter((d) => d.enabled).map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#2a3040] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDriverIds.has(d.id)}
                    onChange={(e) => {
                      const next = new Set(selectedDriverIds)
                      if (e.target.checked) next.add(d.id)
                      else next.delete(d.id)
                      setSelectedDriverIds(next)
                    }}
                    className="w-3.5 h-3.5 accent-[#E8700A]"
                  />
                  <span className="text-xs text-gray-300">{d.name}</span>
                </label>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Will apply <span className="text-white font-medium">{selectedTemplate?.name || "—"}</span> at{" "}
            <span className="text-[#E8700A] font-medium">{formatCurrency(parseFloat(amount) || 0)}</span>{" "}
            to <span className="text-white font-medium">
              {`${selectedDriverIds.size} driver${selectedDriverIds.size !== 1 ? "s" : ""}`}{selectMode === "group" && selectedGroupId ? ` (${groups.find((g) => g.id === selectedGroupId)?.name || "group"})` : ""}
            </span>
          </p>
        </div>

        <div className={`flex items-center justify-end gap-2 px-6 py-3 border-t ${S.divider}`}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedTemplateId || selectedDriverIds.size === 0}
            className={`px-4 py-2 ${S.btn} bg-[#E8700A] hover:bg-[#d4630a] text-white disabled:opacity-40`}
          >
            Apply to {selectedDriverIds.size} Driver{selectedDriverIds.size !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inline Editable Cell ───────────────────────────────────────
function AmountCell({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(String(value)) }, [value])

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select()
  }, [editing])

  if (disabled) {
    return <span className="text-[11px] text-gray-600 px-1">—</span>
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        className="bg-[#2a3040] border border-[#E8700A]/40 text-[11px] text-white rounded px-1 py-0.5 outline-none w-full"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          const parsed = parseFloat(draft)
          if (!isNaN(parsed) && parsed !== value) onChange(parsed)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false)
            const parsed = parseFloat(draft)
            if (!isNaN(parsed) && parsed !== value) onChange(parsed)
          }
          if (e.key === "Escape") { setEditing(false); setDraft(String(value)) }
        }}
      />
    )
  }

  return (
    <span
      className="text-[11px] text-gray-300 cursor-pointer hover:text-[#E8700A] hover:bg-[#2a3040] rounded px-1 py-0.5 block truncate"
      onClick={() => setEditing(true)}
    >
      {value > 0 ? formatCurrency(value) : "$0.00"}
    </span>
  )
}

// ─── Main Component ─────────────────────────────────────────────
export default function SettlementSettingsView({ drivers }: SettlementSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<"driver-deductions" | "settlement-periods">("driver-deductions")
  const [searchQuery, setSearchQuery] = useState("")
  const [showEnabled, setShowEnabled] = useState(true)
  const [showDisabled, setShowDisabled] = useState(false)
  const [loading, setLoading] = useState(true)

  // Data state
  const [templates, setTemplates] = useState<DeductionTemplate[]>([])
  const [settings, setSettings] = useState<DriverDeductionSetting[]>([])
  const [groups, setGroups] = useState<DriverGroup[]>([])
  const [groupAssignments, setGroupAssignments] = useState<DriverGroupAssignment[]>([])

  // Group toggle UI
  const [showGroupToggle, setShowGroupToggle] = useState(false)
  const [groupToggleId, setGroupToggleId] = useState("")
  const [groupToggling, setGroupToggling] = useState(false)
  const groupToggleRef = useRef<HTMLDivElement>(null)

  // UI state
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null)
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")

  // Settlement config state
  const [periodType, setPeriodType] = useState("Weekly")
  const [startDay, setStartDay] = useState("Saturday")
  const [autoSettle, setAutoSettle] = useState(false)
  const [driverNotifications, setDriverNotifications] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)

  // ─── Data Fetching ──────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/drivers/settlement-settings/templates")
      if (res.ok) {
        const { templates: data } = await res.json()
        setTemplates(data || [])
      }
    } catch (err) {
      console.error("Error fetching templates:", err)
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/drivers/settlement-settings/driver-settings")
      if (res.ok) {
        const { settings: data } = await res.json()
        setSettings(data || [])
      }
    } catch (err) {
      console.error("Error fetching settings:", err)
    }
  }, [])

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/drivers/pay-rates/groups")
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups || [])
      }
    } catch (err) {
      console.error("Error fetching groups:", err)
    }
  }, [])

  const fetchGroupAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/drivers/pay-rates/assignments")
      if (res.ok) {
        const data = await res.json()
        setGroupAssignments(
          (data.assignments || []).map((a: { driver_id: string; driver_group_id: string }) => ({
            driver_id: a.driver_id,
            driver_group_id: a.driver_group_id,
          }))
        )
      }
    } catch (err) {
      console.error("Error fetching group assignments:", err)
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/drivers/settlement-settings/config")
      if (res.ok) {
        const { config } = await res.json()
        if (config) {
          setPeriodType(config.period_type)
          setStartDay(config.start_day)
          setAutoSettle(config.auto_settle)
          setDriverNotifications(config.driver_notifications)
        }
      }
    } catch (err) {
      console.error("Error fetching config:", err)
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchTemplates(), fetchSettings(), fetchGroups(), fetchGroupAssignments(), fetchConfig()])
      setLoading(false)
    }
    load()
  }, [fetchTemplates, fetchSettings, fetchGroups, fetchGroupAssignments, fetchConfig])

  // Close group toggle dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (groupToggleRef.current && !groupToggleRef.current.contains(e.target as Node)) {
        setShowGroupToggle(false)
      }
    }
    if (showGroupToggle) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showGroupToggle])

  // ─── Computed ───────────────────────────────────────────────
  const enabledTemplates = useMemo(
    () => templates.filter((t) => t.enabled),
    [templates]
  )

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const matchesSearch =
        !searchQuery ||
        driver.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = (driver.enabled && showEnabled) || (!driver.enabled && showDisabled)
      return matchesSearch && matchesStatus
    })
  }, [drivers, searchQuery, showEnabled, showDisabled])

  const enabledCount = drivers.filter((d) => d.enabled).length
  const disabledCount = drivers.filter((d) => !d.enabled).length

  // Build a lookup map: `${driver_id}::${template_id}` → DriverDeductionSetting
  const settingsMap = useMemo(() => {
    const map = new Map<string, DriverDeductionSetting>()
    settings.forEach((s) => map.set(`${s.driver_id}::${s.template_id}`, s))
    return map
  }, [settings])

  const getDriverTotal = useCallback(
    (driverId: string) => {
      return enabledTemplates.reduce((sum, tmpl) => {
        const ds = settingsMap.get(`${driverId}::${tmpl.id}`)
        if (ds && ds.enabled) return sum + ds.amount
        return sum
      }, 0)
    },
    [enabledTemplates, settingsMap]
  )

  const { startDate, endDate } = useMemo(() => getSettlementPeriod(periodType, startDay), [periodType, startDay])

  const saveConfig = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/drivers/settlement-settings/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error("Failed to save settlement config:", res.status, body.error || "Unknown error")
        // If the table doesn't exist yet, show a helpful message
        if (body.error?.includes("does not exist") || body.error?.includes("relation")) {
          console.error("The settlement_config table may not exist yet. Run the migration: supabase/migrations/20260226_settlement_config.sql")
        }
      }
    } catch (err) {
      console.error("Error saving config:", err)
    }
  }

  // ─── Cell Actions ─────────────────────────────────────────────
  const handleCellAmountChange = async (driverId: string, templateId: string, amount: number) => {
    const key = `${driverId}::${templateId}`
    setSavingCells((prev) => new Set(prev).add(key))
    setError("")

    // Optimistic update
    setSettings((prev) => {
      const existing = prev.find((s) => s.driver_id === driverId && s.template_id === templateId)
      if (existing) {
        return prev.map((s) =>
          s.driver_id === driverId && s.template_id === templateId
            ? { ...s, amount, updated_at: new Date().toISOString() }
            : s
        )
      } else {
        return [
          ...prev,
          {
            id: `temp-${key}`,
            driver_id: driverId,
            template_id: templateId,
            amount,
            enabled: true,
            limit_total: null,
            limit_per_period: null,
            total_deducted: null,
            start_date: null,
            end_date: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      }
    })

    try {
      const res = await fetch("/api/drivers/settlement-settings/driver-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, template_id: templateId, amount, enabled: true }),
      })
      if (res.ok) {
        const { setting } = await res.json()
        setSettings((prev) =>
          prev.map((s) =>
            s.driver_id === driverId && s.template_id === templateId ? setting : s
          )
        )
      } else {
        setError("Failed to save")
      }
    } catch (err) {
      console.error("Error saving setting:", err)
      setError("Failed to save")
    }

    setSavingCells((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }

  const handleCellToggle = async (driverId: string, templateId: string) => {
    const key = `${driverId}::${templateId}`
    const existing = settingsMap.get(key)
    const newEnabled = existing ? !existing.enabled : true
    const amount = existing?.amount ?? templates.find((t) => t.id === templateId)?.default_amount ?? 0

    // Optimistic
    setSettings((prev) => {
      const has = prev.find((s) => s.driver_id === driverId && s.template_id === templateId)
      if (has) {
        return prev.map((s) =>
          s.driver_id === driverId && s.template_id === templateId
            ? { ...s, enabled: newEnabled }
            : s
        )
      }
      return [
        ...prev,
        {
          id: `temp-${key}`,
          driver_id: driverId,
          template_id: templateId,
          amount,
          enabled: newEnabled,
          limit_total: null,
          limit_per_period: null,
          total_deducted: null,
          start_date: null,
          end_date: null,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
    })

    try {
      await fetch("/api/drivers/settlement-settings/driver-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, template_id: templateId, amount, enabled: newEnabled }),
      })
    } catch (err) {
      console.error("Error toggling setting:", err)
    }
  }

  // ─── Batch Apply ──────────────────────────────────────────────
  const handleBatchApply = async (driverIds: string[], templateId: string, amount: number) => {
    const rows = driverIds.map((driverId) => ({
      driver_id: driverId,
      template_id: templateId,
      amount,
      enabled: true,
    }))

    try {
      const res = await fetch("/api/drivers/settlement-settings/driver-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: rows }),
      })
      if (res.ok) {
        await fetchSettings() // Refresh all settings
      }
    } catch (err) {
      console.error("Error batch applying:", err)
    }
  }

  // ─── Group Toggle All Deductions ────────────────────────────────
  const handleGroupToggleAll = async (groupId: string, enableAll: boolean) => {
    if (!groupId) return
    setGroupToggling(true)

    const memberIds = groupAssignments
      .filter((a) => a.driver_group_id === groupId)
      .map((a) => a.driver_id)

    if (memberIds.length === 0) {
      setGroupToggling(false)
      return
    }

    // Build bulk upsert rows for every driver × template combination
    const rows: { driver_id: string; template_id: string; amount: number; enabled: boolean }[] = []
    for (const driverId of memberIds) {
      for (const tmpl of enabledTemplates) {
        const existing = settingsMap.get(`${driverId}::${tmpl.id}`)
        rows.push({
          driver_id: driverId,
          template_id: tmpl.id,
          amount: existing?.amount ?? tmpl.default_amount,
          enabled: enableAll,
        })
      }
    }

    // Optimistic update
    setSettings((prev) => {
      const updated = [...prev]
      for (const row of rows) {
        const idx = updated.findIndex(
          (s) => s.driver_id === row.driver_id && s.template_id === row.template_id
        )
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], enabled: row.enabled }
        } else {
          updated.push({
            id: `temp-${row.driver_id}::${row.template_id}`,
            driver_id: row.driver_id,
            template_id: row.template_id,
            amount: row.amount,
            enabled: row.enabled,
            limit_total: null,
            limit_per_period: null,
            total_deducted: null,
            start_date: null,
            end_date: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      }
      return updated
    })

    try {
      const res = await fetch("/api/drivers/settlement-settings/driver-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: rows }),
      })
      if (res.ok) {
        await fetchSettings()
      }
    } catch (err) {
      console.error("Error group toggling:", err)
    }

    setGroupToggling(false)
    setShowGroupToggle(false)
  }

  // ─── Column Toggle (all drivers for one template) ─────────────
  const handleColumnToggle = async (templateId: string) => {
    // Determine current state: if ALL filtered drivers are enabled → turn all off, else turn all on
    const allEnabled = filteredDrivers.every((d) => {
      const ds = settingsMap.get(`${d.id}::${templateId}`)
      return ds?.enabled === true
    })
    const newEnabled = !allEnabled
    const tmpl = templates.find((t) => t.id === templateId)

    const rows = filteredDrivers.map((d) => {
      const existing = settingsMap.get(`${d.id}::${templateId}`)
      return {
        driver_id: d.id,
        template_id: templateId,
        amount: existing?.amount ?? tmpl?.default_amount ?? 0,
        enabled: newEnabled,
      }
    })

    // Optimistic update
    setSettings((prev) => {
      const updated = [...prev]
      for (const row of rows) {
        const idx = updated.findIndex(
          (s) => s.driver_id === row.driver_id && s.template_id === row.template_id
        )
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], enabled: row.enabled }
        } else {
          updated.push({
            id: `temp-${row.driver_id}::${row.template_id}`,
            driver_id: row.driver_id,
            template_id: row.template_id,
            amount: row.amount,
            enabled: row.enabled,
            limit_total: null,
            limit_per_period: null,
            total_deducted: null,
            start_date: null,
            end_date: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      }
      return updated
    })

    try {
      const res = await fetch("/api/drivers/settlement-settings/driver-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: rows }),
      })
      if (res.ok) {
        await fetchSettings()
      }
    } catch (err) {
      console.error("Error column toggling:", err)
    }
  }

  // ─── Detail Panel Setting Change ──────────────────────────────
  const handleDetailSettingChange = async (
    driverId: string,
    templateId: string,
    updates: Partial<DriverDeductionSetting>
  ) => {
    const key = `${driverId}::${templateId}`
    const existing = settingsMap.get(key)
    const currentAmount = existing?.amount ?? templates.find((t) => t.id === templateId)?.default_amount ?? 0

    // Optimistic update
    setSettings((prev) => {
      const has = prev.find((s) => s.driver_id === driverId && s.template_id === templateId)
      if (has) {
        return prev.map((s) =>
          s.driver_id === driverId && s.template_id === templateId
            ? { ...s, ...updates, updated_at: new Date().toISOString() }
            : s
        )
      }
      return [
        ...prev,
        {
          id: `temp-${key}`,
          driver_id: driverId,
          template_id: templateId,
          amount: currentAmount,
          enabled: true,
          limit_total: null,
          limit_per_period: null,
          total_deducted: null,
          start_date: null,
          end_date: null,
          notes: null,
          ...updates,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as DriverDeductionSetting,
      ]
    })

    try {
      await fetch("/api/drivers/settlement-settings/driver-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverId,
          template_id: templateId,
          amount: updates.amount ?? existing?.amount ?? currentAmount,
          enabled: updates.enabled ?? existing?.enabled ?? true,
          limit_total: updates.limit_total !== undefined ? updates.limit_total : (existing?.limit_total ?? null),
          limit_per_period: updates.limit_per_period !== undefined ? updates.limit_per_period : (existing?.limit_per_period ?? null),
          start_date: updates.start_date !== undefined ? updates.start_date : (existing?.start_date ?? null),
          end_date: updates.end_date !== undefined ? updates.end_date : (existing?.end_date ?? null),
        }),
      })
    } catch (err) {
      console.error("Error updating detail setting:", err)
    }
  }

  // ─── Render ─────────────────────────────────────────────────
  const thBase = "px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
  const tdBase = "px-2 py-1.5 border-t border-[#2a3040]"

  return (
    <div className="flex flex-col">
      {/* Sub-tabs */}
      <div className="border-b border-[#2a3040] px-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("driver-deductions")}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "driver-deductions"
                ? "border-[#E8700A] text-white"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            Driver Deductions
          </button>
          <button
            onClick={() => setActiveTab("settlement-periods")}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "settlement-periods"
                ? "border-[#E8700A] text-white"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            Settlement Periods
          </button>
        </div>
      </div>

      {/* ─── Driver Deductions (Matrix) ───────────────────────── */}
      {activeTab === "driver-deductions" && (
        <div className="p-4 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search drivers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-lg pl-8 pr-3 py-1.5 text-sm border ${S.input}`}
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showEnabled}
                onChange={(e) => setShowEnabled(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#E8700A]"
              />
              <span className="text-xs text-gray-300">
                Enabled <span className="ml-0.5 px-1 py-0.5 rounded bg-white/10 text-[10px] text-gray-400">{enabledCount}</span>
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showDisabled}
                onChange={(e) => setShowDisabled(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#E8700A]"
              />
              <span className="text-xs text-gray-300">
                Disabled <span className="ml-0.5 px-1 py-0.5 rounded bg-white/10 text-[10px] text-gray-400">{disabledCount}</span>
              </span>
            </label>

            <div className="flex-1" />

            {error && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle size={12} /> {error}
              </span>
            )}

            {/* Group Toggle Dropdown */}
            <div className="relative" ref={groupToggleRef}>
              <button
                onClick={() => setShowGroupToggle(!showGroupToggle)}
                className={`flex items-center gap-1.5 px-3 py-1.5 ${S.btn} bg-[#2a3040] hover:bg-[#363f52] text-gray-300 border border-[#363f52]`}
              >
                <Users size={12} /> Group On/Off
              </button>
              {showGroupToggle && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-[#1e2330] border border-[#363f52] rounded-lg shadow-xl min-w-[260px] py-1">
                  <p className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">
                    Toggle all deductions for a group
                  </p>
                  {groups.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-gray-500">No groups found</p>
                  ) : (
                    groups.map((g) => {
                      const memberCount = groupAssignments.filter(
                        (a) => a.driver_group_id === g.id
                      ).length
                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between px-3 py-1.5 hover:bg-[#2a3040]"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs text-white truncate">{g.name}</span>
                            <span className="text-[10px] text-gray-500">{memberCount} drivers</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => { setGroupToggleId(g.id); handleGroupToggleAll(g.id, true) }}
                              disabled={groupToggling || memberCount === 0}
                              className="px-2 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-40 transition-colors"
                              title="Enable all deductions for this group"
                            >
                              {groupToggling && groupToggleId === g.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                "All On"
                              )}
                            </button>
                            <button
                              onClick={() => { setGroupToggleId(g.id); handleGroupToggleAll(g.id, false) }}
                              disabled={groupToggling || memberCount === 0}
                              className="px-2 py-0.5 text-[10px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 transition-colors"
                              title="Disable all deductions for this group"
                            >
                              {groupToggling && groupToggleId === g.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                "All Off"
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowBatchModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${S.btn} bg-[#2a3040] hover:bg-[#363f52] text-gray-300 border border-[#363f52]`}
            >
              <Copy size={12} /> Batch Apply
            </button>

            <button
              onClick={() => setShowTemplateModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 ${S.btn} bg-[#E8700A] hover:bg-[#d4630a] text-white`}
            >
              <Settings2 size={12} /> Manage Templates
            </button>
          </div>

          {/* Matrix Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-gray-500" />
              <span className="ml-2 text-sm text-gray-500">Loading deduction settings...</span>
            </div>
          ) : enabledTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Settings2 size={32} className="text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">No deduction templates configured yet.</p>
              <button
                onClick={() => setShowTemplateModal(true)}
                className={`mt-3 px-4 py-2 ${S.btn} bg-[#E8700A] hover:bg-[#d4630a] text-white`}
              >
                Create Templates
              </button>
            </div>
          ) : (
            <div className={`rounded-lg border ${S.divider} overflow-hidden`}>
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`${S.panelHeader} border-b border-[#2a3040]`}>
                      <th className={`${thBase} text-left sticky left-0 bg-[#242938] z-10 min-w-[200px]`}>
                        Driver
                      </th>
                      {enabledTemplates.map((tmpl) => {
                        const colAllEnabled = filteredDrivers.length > 0 && filteredDrivers.every((d) => {
                          const ds = settingsMap.get(`${d.id}::${tmpl.id}`)
                          return ds?.enabled === true
                        })
                        const colSomeEnabled = filteredDrivers.some((d) => {
                          const ds = settingsMap.get(`${d.id}::${tmpl.id}`)
                          return ds?.enabled === true
                        })
                        return (
                          <th key={tmpl.id} className={`${thBase} text-center min-w-[100px]`}>
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleColumnToggle(tmpl.id)}
                                  className="p-0.5 rounded hover:bg-white/10 transition-colors"
                                  title={colAllEnabled ? "Disable all drivers for this deduction" : "Enable all drivers for this deduction"}
                                >
                                  {colAllEnabled ? (
                                    <ToggleRight size={14} className="text-green-400" />
                                  ) : colSomeEnabled ? (
                                    <ToggleRight size={14} className="text-yellow-400/70" />
                                  ) : (
                                    <ToggleLeft size={14} className="text-gray-500" />
                                  )}
                                </button>
                                <span>{tmpl.name}</span>
                              </div>
                              <span className="text-[8px] text-gray-500 normal-case font-normal">
                                {tmpl.deduction_type} · {tmpl.frequency}
                              </span>
                            </div>
                          </th>
                        )
                      })}
                      <th className={`${thBase} text-right min-w-[100px]`}>
                        Weekly Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrivers.length === 0 ? (
                      <tr>
                        <td colSpan={enabledTemplates.length + 2} className="px-6 py-12 text-center text-gray-500">
                          No drivers found
                        </td>
                      </tr>
                    ) : (
                      filteredDrivers.map((driver) => {
                        const driverTotal = getDriverTotal(driver.id)
                        return (
                          <tr
                            key={driver.id}
                            className="hover:bg-white/[0.02] transition-colors group"
                          >
                            {/* Driver name — sticky */}
                            <td className={`${tdBase} sticky left-0 bg-[#1e2330] group-hover:bg-[#222838] z-10`}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-7 h-7 rounded-full ${getColorForInitials(driver.name)} flex items-center justify-center flex-shrink-0 cursor-pointer`}
                                  onClick={() => setDetailDriver(driver)}
                                >
                                  <span className="text-white font-semibold text-[9px]">{getInitials(driver.name)}</span>
                                </div>
                                <span
                                  className="text-xs text-white font-medium truncate cursor-pointer hover:text-[#E8700A]"
                                  onClick={() => setDetailDriver(driver)}
                                >
                                  {driver.name}
                                </span>
                              </div>
                            </td>

                            {/* Deduction cells */}
                            {enabledTemplates.map((tmpl) => {
                              const key = `${driver.id}::${tmpl.id}`
                              const ds = settingsMap.get(key)
                              const cellAmount = ds?.amount ?? 0
                              const isEnabled = ds?.enabled ?? false
                              const isSaving = savingCells.has(key)

                              return (
                                <td
                                  key={tmpl.id}
                                  className={`${tdBase} text-center relative ${
                                    !isEnabled ? "opacity-40" : ""
                                  }`}
                                >
                                  {isSaving && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-[#1e2330]/60 z-10">
                                      <Loader2 size={10} className="animate-spin text-[#E8700A]" />
                                    </div>
                                  )}
                                  <div className="flex items-center gap-0.5 justify-center">
                                    <button
                                      onClick={() => handleCellToggle(driver.id, tmpl.id)}
                                      className="flex-shrink-0 p-0.5"
                                      title={isEnabled ? "Disable" : "Enable"}
                                    >
                                      {isEnabled ? (
                                        <Check size={10} className="text-green-400" />
                                      ) : (
                                        <span className="w-2.5 h-2.5 rounded border border-gray-600 inline-block" />
                                      )}
                                    </button>
                                    <AmountCell
                                      value={cellAmount}
                                      onChange={(v) => handleCellAmountChange(driver.id, tmpl.id, v)}
                                      disabled={!isEnabled}
                                    />
                                  </div>
                                </td>
                              )
                            })}

                            {/* Total */}
                            <td className={`${tdBase} text-right`}>
                              <span className={`text-xs font-semibold ${driverTotal > 0 ? "text-red-400" : "text-gray-500"}`}>
                                {driverTotal > 0 ? `-${formatCurrency(driverTotal)}` : "$0.00"}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>

                  {/* Column totals footer */}
                  {filteredDrivers.length > 0 && (
                    <tfoot>
                      <tr className={`${S.panelHeader} border-t border-[#363f52]`}>
                        <td className={`${thBase} text-left sticky left-0 bg-[#242938] z-10 text-gray-300 font-bold`}>
                          Column Totals
                        </td>
                        {enabledTemplates.map((tmpl) => {
                          const colTotal = filteredDrivers.reduce((sum, d) => {
                            const ds = settingsMap.get(`${d.id}::${tmpl.id}`)
                            if (ds && ds.enabled) return sum + ds.amount
                            return sum
                          }, 0)
                          return (
                            <td key={tmpl.id} className={`${thBase} text-center text-gray-300`}>
                              {colTotal > 0 ? formatCurrency(colTotal) : "—"}
                            </td>
                          )
                        })}
                        <td className={`${thBase} text-right text-[#E8700A] font-bold`}>
                          {formatCurrency(
                            filteredDrivers.reduce((sum, d) => sum + getDriverTotal(d.id), 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Settlement Periods Tab ──────────────────────────── */}
      {activeTab === "settlement-periods" && (
        <div className="p-6 space-y-6 max-w-2xl">
          <div className={`${S.panel} border rounded-lg p-6`}>
            <h2 className="text-lg font-semibold text-white mb-6">Current Settlement Period</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Period Type</label>
                  <select
                    value={periodType}
                    onChange={(e) => {
                      setPeriodType(e.target.value)
                      saveConfig({ period_type: e.target.value })
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${S.input} border`}
                  >
                    <option value="Daily" className="bg-[#111827]">Daily</option>
                    <option value="Weekly" className="bg-[#111827]">Weekly</option>
                    <option value="Bi-Weekly" className="bg-[#111827]">Bi-Weekly</option>
                    <option value="Monthly" className="bg-[#111827]">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Start Day</label>
                  <select
                    value={startDay}
                    onChange={(e) => {
                      setStartDay(e.target.value)
                      saveConfig({ start_day: e.target.value })
                    }}
                    disabled={periodType === "Daily" || periodType === "Monthly"}
                    className={`w-full px-3 py-2 rounded-lg text-sm ${S.input} border ${
                      (periodType === "Daily" || periodType === "Monthly") ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => (
                      <option key={day} value={day} className="bg-[#111827]">{day}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-[#2a3040]">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Current Period</label>
                <div className="bg-[#242938] rounded-lg p-4 border border-[#2a3040]">
                  <p className="text-white font-semibold">{formatDate(startDate)} – {formatDate(endDate)}</p>
                  <p className="text-gray-400 text-sm mt-2">Active settlement period for all drivers</p>
                </div>
              </div>
              <div className="pt-4 border-t border-[#2a3040]">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Next Period</label>
                <div className="bg-[#242938] rounded-lg p-4 border border-[#2a3040]">
                  <p className="text-white font-semibold">
                    {(() => {
                      const nextStart = new Date(endDate.getTime() + 86400000)
                      const nextPeriod = periodType === "Daily" ? 0
                        : periodType === "Monthly" ? new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0).getDate() - 1
                        : periodType === "Bi-Weekly" ? 13 : 6
                      const nextEnd = periodType === "Monthly"
                        ? new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0)
                        : new Date(nextStart.getTime() + nextPeriod * 86400000)
                      return `${formatDate(nextStart)} – ${formatDate(nextEnd)}`
                    })()}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">Deductions processed at end of current period</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`${S.panel} border rounded-lg p-6`}>
            <h2 className="text-lg font-semibold text-white mb-6">Settlement Configuration</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#242938] rounded-lg border border-[#2a3040]">
                <div>
                  <p className="text-white font-medium">Auto Settlement</p>
                  <p className="text-gray-400 text-sm mt-1">Automatically settle deductions at period end</p>
                </div>
                <button
                  onClick={() => {
                    const newVal = !autoSettle
                    setAutoSettle(newVal)
                    saveConfig({ auto_settle: newVal })
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                    autoSettle
                      ? "bg-green-500/20 border-green-500/30"
                      : "bg-gray-700/30 border-gray-600/30"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full transition-transform ${
                    autoSettle ? "bg-green-500 translate-x-5" : "bg-gray-500 translate-x-1"
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-[#242938] rounded-lg border border-[#2a3040]">
                <div>
                  <p className="text-white font-medium">Driver Notifications</p>
                  <p className="text-gray-400 text-sm mt-1">Notify drivers when deductions are processed</p>
                </div>
                <button
                  onClick={() => {
                    const newVal = !driverNotifications
                    setDriverNotifications(newVal)
                    saveConfig({ driver_notifications: newVal })
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                    driverNotifications
                      ? "bg-[#E8700A]/20 border-[#E8700A]/30"
                      : "bg-gray-700/30 border-gray-600/30"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full transition-transform ${
                    driverNotifications ? "bg-[#E8700A] translate-x-5" : "bg-gray-500 translate-x-1"
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────────── */}
      {showTemplateModal && (
        <TemplateModal
          templates={templates}
          onClose={() => setShowTemplateModal(false)}
          onSave={fetchTemplates}
        />
      )}

      {showBatchModal && (
        <BatchApplyModal
          templates={enabledTemplates}
          drivers={drivers}
          groups={groups}
          groupAssignments={groupAssignments}
          onClose={() => setShowBatchModal(false)}
          onApply={handleBatchApply}
        />
      )}

      {detailDriver && (
        <DriverDetailPanel
          driver={detailDriver}
          templates={templates}
          settings={settings}
          onClose={() => setDetailDriver(null)}
          onSettingChange={handleDetailSettingChange}
          periodType={periodType}
          startDay={startDay}
        />
      )}
    </div>
  )
}
