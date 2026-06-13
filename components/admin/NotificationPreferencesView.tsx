"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Bell,
  Loader2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Clock,
  AlertTriangle,
  Ship,
  Truck,
  DollarSign,
  FileText,
  Save,
} from "lucide-react"

const S = {
  panel: "bg-[#141922] border-[#1e2530]",
  panelHeader: "bg-[#0B1120] border-[#1e2530]",
  input:
    "bg-[#1a2030] border border-[#2a3444] text-white placeholder-gray-600 focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A] outline-none",
}

type NotificationSetting = {
  id: string
  setting_key: string
  enabled: boolean
  config: Record<string, unknown>
  updated_at: string
}

// User-friendly metadata for each setting
const SETTING_META: Record<
  string,
  {
    label: string
    description: string
    icon: React.ReactNode
    configFields: { key: string; label: string; type: "number" | "boolean"; unit?: string }[]
  }
> = {
  demurrage_alerts: {
    label: "Demurrage Alerts",
    description:
      "Alerts in the notification bell when containers approach or exceed their last free day.",
    icon: <AlertTriangle size={16} className="text-red-400" />,
    configFields: [
      { key: "warning_days", label: "Warning threshold", type: "number", unit: "days before LFD" },
      { key: "critical_days", label: "Critical threshold", type: "number", unit: "days before LFD" },
      { key: "poll_interval_minutes", label: "Refresh interval", type: "number", unit: "minutes" },
    ],
  },
  unassigned_load_alerts: {
    label: "Unassigned Load Alerts",
    description: "Alerts for loads in Created status with no driver assigned.",
    icon: <Truck size={16} className="text-yellow-400" />,
    configFields: [
      { key: "critical_after_hours", label: "Critical after", type: "number", unit: "hours unassigned" },
      { key: "poll_interval_minutes", label: "Refresh interval", type: "number", unit: "minutes" },
    ],
  },
  vessel_arrival_alerts: {
    label: "Vessel Arrival Alerts",
    description: "Notifications for vessels arriving today.",
    icon: <Ship size={16} className="text-blue-400" />,
    configFields: [
      { key: "show_arriving_today", label: "Show arriving today", type: "boolean" },
      { key: "poll_interval_minutes", label: "Refresh interval", type: "number", unit: "minutes" },
    ],
  },
  load_status_toasts: {
    label: "Load Status Toasts",
    description: "Real-time floating toast notifications when load statuses change.",
    icon: <Bell size={16} className="text-green-400" />,
    configFields: [
      { key: "toast_duration_seconds", label: "Toast duration", type: "number", unit: "seconds" },
      { key: "max_visible", label: "Max visible toasts", type: "number", unit: "toasts" },
    ],
  },
  settlement_notifications: {
    label: "Settlement Notifications",
    description: "Email notifications to drivers when their settlements are processed.",
    icon: <DollarSign size={16} className="text-orange-400" />,
    configFields: [
      { key: "notify_drivers_on_settlement", label: "Notify drivers", type: "boolean" },
      { key: "notify_email", label: "Send via email", type: "boolean" },
    ],
  },
  ar_aging_alerts: {
    label: "AR Aging Alerts",
    description: "Alerts for overdue accounts receivable invoices.",
    icon: <FileText size={16} className="text-purple-400" />,
    configFields: [
      { key: "overdue_threshold_days", label: "Overdue threshold", type: "number", unit: "days past due" },
      { key: "critical_threshold_days", label: "Critical threshold", type: "number", unit: "days past due" },
    ],
  },
}

export function NotificationPreferencesView() {
  const [settings, setSettings] = useState<NotificationSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  // Track local edits per setting id
  const [localEdits, setLocalEdits] = useState<
    Record<string, { enabled?: boolean; config?: Record<string, unknown> }>
  >({})

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notification-settings")
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings || [])
        setLocalEdits({})
      } else {
        const data = await res.json()
        setError(data.error || "Failed to fetch settings")
      }
    } catch (err) {
      console.error("Error fetching notification settings:", err)
      setError("Network error")
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchSettings()
      setLoading(false)
    }
    load()
  }, [fetchSettings])

  const getEffectiveValue = (setting: NotificationSetting) => {
    const edit = localEdits[setting.id]
    return {
      enabled: edit?.enabled ?? setting.enabled,
      config: { ...setting.config, ...edit?.config },
    }
  }

  const setLocalEdit = (
    settingId: string,
    field: "enabled" | "config",
    value: unknown
  ) => {
    setLocalEdits((prev) => ({
      ...prev,
      [settingId]: {
        ...prev[settingId],
        [field]: value,
      },
    }))
  }

  const setConfigField = (
    settingId: string,
    existingConfig: Record<string, unknown>,
    key: string,
    value: unknown
  ) => {
    const currentEdit = localEdits[settingId]?.config || {}
    setLocalEdit(settingId, "config", {
      ...existingConfig,
      ...currentEdit,
      [key]: value,
    })
  }

  const hasChanges = (settingId: string) => {
    const edit = localEdits[settingId]
    if (!edit) return false

    const setting = settings.find((s) => s.id === settingId)
    if (!setting) return false

    // Check if enabled actually changed
    if (edit.enabled !== undefined && edit.enabled !== setting.enabled) return true

    // Check if any config value actually changed
    if (edit.config) {
      for (const key of Object.keys(edit.config)) {
        if (edit.config[key] !== setting.config[key]) return true
      }
    }

    return false
  }

  const handleSave = async (setting: NotificationSetting) => {
    const edit = localEdits[setting.id]
    if (!edit || !hasChanges(setting.id)) return

    setSaving(setting.id)
    setError("")
    setSuccessMessage("")
    try {
      const res = await fetch("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: setting.id,
          ...(edit.enabled !== undefined ? { enabled: edit.enabled } : {}),
          ...(edit.config ? { config: { ...setting.config, ...edit.config } } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save")
        return
      }

      // Update local state with saved value
      setSettings((prev) =>
        prev.map((s) => (s.id === setting.id ? data.setting : s))
      )
      // Clear edits for this setting
      setLocalEdits((prev) => {
        const next = { ...prev }
        delete next[setting.id]
        return next
      })
      setSuccessMessage(`"${SETTING_META[setting.setting_key]?.label || setting.setting_key}" saved`)
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#E8700A] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell size={20} className="text-[#E8700A]" />
            Notification Preferences
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure alert types, thresholds, and notification behavior
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-[#1a2236] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-white/20 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Status messages */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
          {successMessage}
        </div>
      )}

      {/* Settings cards */}
      <div className="space-y-4">
        {settings.map((setting) => {
          const meta = SETTING_META[setting.setting_key]
          const effective = getEffectiveValue(setting)
          const changed = hasChanges(setting.id)

          return (
            <div
              key={setting.id}
              className={`rounded-xl border transition-colors ${
                changed ? "border-[#E8700A]/40" : "border-[#1e2530]"
              } ${S.panel}`}
            >
              {/* Setting header row */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#1a2030]">
                    {meta?.icon || <Bell size={16} className="text-gray-400" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {meta?.label || setting.setting_key}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 max-w-md">
                      {meta?.description || ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Toggle */}
                  <button
                    onClick={() =>
                      setLocalEdit(setting.id, "enabled", !effective.enabled)
                    }
                    className="flex items-center gap-2"
                  >
                    {effective.enabled ? (
                      <ToggleRight size={28} className="text-[#E8700A]" />
                    ) : (
                      <ToggleLeft size={28} className="text-gray-600" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        effective.enabled ? "text-[#E8700A]" : "text-gray-500"
                      }`}
                    >
                      {effective.enabled ? "ON" : "OFF"}
                    </span>
                  </button>

                  {/* Save button (only shows when changed) */}
                  {changed && (
                    <button
                      onClick={() => handleSave(setting)}
                      disabled={saving === setting.id}
                      className="px-3 py-1.5 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      {saving === setting.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      Save
                    </button>
                  )}
                </div>
              </div>

              {/* Config fields (only show if enabled and has configurable fields) */}
              {effective.enabled && meta?.configFields && meta.configFields.length > 0 && (
                <div className="px-5 pb-4 pt-0">
                  <div className="border-t border-[#1e2530] pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {meta.configFields.map((field) => {
                        const currentVal =
                          effective.config[field.key] ?? ""

                        if (field.type === "boolean") {
                          return (
                            <div
                              key={field.key}
                              className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#0B1120] border border-[#1e2530]"
                            >
                              <span className="text-xs text-gray-400">
                                {field.label}
                              </span>
                              <button
                                onClick={() =>
                                  setConfigField(
                                    setting.id,
                                    setting.config,
                                    field.key,
                                    !currentVal
                                  )
                                }
                              >
                                {currentVal ? (
                                  <ToggleRight size={22} className="text-[#E8700A]" />
                                ) : (
                                  <ToggleLeft size={22} className="text-gray-600" />
                                )}
                              </button>
                            </div>
                          )
                        }

                        // Number field
                        return (
                          <div key={field.key} className="space-y-1">
                            <label className="text-[10px] text-gray-500">
                              {field.label}
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={String(currentVal)}
                                onChange={(e) =>
                                  setConfigField(
                                    setting.id,
                                    setting.config,
                                    field.key,
                                    Number(e.target.value)
                                  )
                                }
                                className={`w-20 px-2 py-1.5 rounded-lg text-xs ${S.input}`}
                                min={0}
                              />
                              {field.unit && (
                                <span className="text-[10px] text-gray-500">
                                  {field.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Last updated footer */}
              <div className="px-5 py-2 border-t border-[#1e2530]/60">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                  <Clock size={10} />
                  Last updated:{" "}
                  {new Date(setting.updated_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {settings.length === 0 && !loading && (
        <div className="py-12 text-center">
          <Bell size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            No notification settings found. Run the migration to seed defaults.
          </p>
        </div>
      )}
    </div>
  )
}
