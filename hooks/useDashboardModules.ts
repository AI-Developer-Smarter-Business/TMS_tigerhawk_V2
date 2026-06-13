// hooks/useDashboardModules.ts
"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  DashboardModuleLayout,
  DASHBOARD_MODULES_PREF_KEY,
  getDefaultLayout,
  MODULE_REGISTRY,
} from "@/types/dashboard-modules"

/**
 * Hook to load/save dashboard module layout from user_preferences.
 * Falls back to defaults per role.
 */
export function useDashboardModules(isStaff: boolean) {
  const [layout, setLayout] = useState<DashboardModuleLayout[]>(
    getDefaultLayout(isStaff)
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || cancelled) {
          setLoading(false)
          return
        }

        const { data: pref } = await supabase
          .from("user_preferences")
          .select("preference_value")
          .eq("user_id", user.id)
          .eq("preference_key", DASHBOARD_MODULES_PREF_KEY)
          .maybeSingle()

        if (pref?.preference_value && !cancelled) {
          const saved = pref.preference_value as DashboardModuleLayout[]
          if (Array.isArray(saved) && saved.length > 0) {
            // Merge with registry — add any new modules not in saved config
            const savedIds = new Set(saved.map((s) => s.id))
            const available = MODULE_REGISTRY.filter(
              (m) => isStaff || !m.staffOnly
            )
            const newModules: DashboardModuleLayout[] = available
              .filter((m) => !savedIds.has(m.id))
              .map((m, i) => ({
                id: m.id,
                enabled: false, // New modules default to off until user enables
                order: saved.length + i,
              }))

            // Filter out modules that no longer exist or aren't accessible
            const validIds = new Set(available.map((m) => m.id))
            const filtered = saved.filter((s) => validIds.has(s.id))

            setLayout([...filtered, ...newModules])
            setLoading(false)
            return
          }
        }
        // Keep defaults
      } catch {
        // On error, keep defaults
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isStaff])

  const saveLayout = useCallback(
    async (newLayout: DashboardModuleLayout[]) => {
      setSaving(true)
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from("user_preferences").upsert(
          {
            user_id: user.id,
            preference_key: DASHBOARD_MODULES_PREF_KEY,
            preference_value: newLayout,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,preference_key" }
        )

        if (!error) {
          setLayout(newLayout)
        }
      } catch {
        // Silently fail
      } finally {
        setSaving(false)
      }
    },
    []
  )

  const toggleModule = useCallback(
    (id: string) => {
      const updated = layout.map((m) =>
        m.id === id ? { ...m, enabled: !m.enabled } : m
      )
      setLayout(updated)
      saveLayout(updated)
    },
    [layout, saveLayout]
  )

  const reorderModules = useCallback(
    (fromIndex: number, toIndex: number) => {
      const enabledModules = layout
        .filter((m) => m.enabled)
        .sort((a, b) => a.order - b.order)
      const disabledModules = layout.filter((m) => !m.enabled)

      const [moved] = enabledModules.splice(fromIndex, 1)
      enabledModules.splice(toIndex, 0, moved)

      const reordered = [
        ...enabledModules.map((m, i) => ({ ...m, order: i })),
        ...disabledModules.map((m, i) => ({
          ...m,
          order: enabledModules.length + i,
        })),
      ]
      setLayout(reordered)
      saveLayout(reordered)
    },
    [layout, saveLayout]
  )

  const enabledModules = layout
    .filter((m) => m.enabled)
    .sort((a, b) => a.order - b.order)

  return {
    layout,
    enabledModules,
    loading,
    saving,
    toggleModule,
    reorderModules,
    saveLayout,
  }
}
