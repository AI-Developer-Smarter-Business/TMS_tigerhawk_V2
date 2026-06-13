// hooks/useColumnConfig.ts
"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { getDefaultVisibleColumns, getLockedColumns } from "@/lib/column-config"

const PREF_KEY = "dispatcher_columns"

/**
 * Hook to load/save column visibility configuration from Supabase user_preferences.
 * Falls back to global profile, then to coded defaults.
 */
export function useColumnConfig() {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(getDefaultVisibleColumns())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load config on mount
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) {
          setLoading(false)
          return
        }

        // Try user-specific preference first
        const { data: userPref } = await supabase
          .from("user_preferences")
          .select("preference_value")
          .eq("user_id", user.id)
          .eq("preference_key", PREF_KEY)
          .maybeSingle()

        if (userPref?.preference_value && !cancelled) {
          const cols = userPref.preference_value as string[]
          if (Array.isArray(cols) && cols.length > 0) {
            // Always include locked columns
            const locked = getLockedColumns()
            const merged = [...new Set([...locked, ...cols])]
            setVisibleColumns(merged)
            setLoading(false)
            return
          }
        }

        // Try global default (user_id IS NULL)
        const { data: globalPref } = await supabase
          .from("user_preferences")
          .select("preference_value")
          .is("user_id", null)
          .eq("preference_key", PREF_KEY)
          .maybeSingle()

        if (globalPref?.preference_value && !cancelled) {
          const cols = globalPref.preference_value as string[]
          if (Array.isArray(cols) && cols.length > 0) {
            const locked = getLockedColumns()
            const merged = [...new Set([...locked, ...cols])]
            setVisibleColumns(merged)
          }
        }
        // Otherwise keep defaults
      } catch {
        // On error, keep defaults
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // Save config
  const saveConfig = useCallback(async (columns: string[]) => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Upsert
      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            preference_key: PREF_KEY,
            preference_value: columns,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,preference_key" }
        )

      if (!error) {
        setVisibleColumns(columns)
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setSaving(false)
    }
  }, [])

  // Save as global default
  const saveGlobalConfig = useCallback(async (columns: string[]) => {
    setSaving(true)
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: null,
            preference_key: PREF_KEY,
            preference_value: columns,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,preference_key" }
        )

      if (!error) {
        setVisibleColumns(columns)
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }, [])

  const isColumnVisible = useCallback((key: string) => {
    return visibleColumns.includes(key)
  }, [visibleColumns])

  return {
    visibleColumns,
    setVisibleColumns,
    saveConfig,
    saveGlobalConfig,
    isColumnVisible,
    loading,
    saving,
  }
}
