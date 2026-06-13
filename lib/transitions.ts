// lib/transitions.ts
// Loads effective load-status transitions: DB overrides take precedence over hardcoded defaults.
import { createAdminClient } from "@/lib/supabase/admin"
import { LoadStatus, VALID_LOAD_TRANSITIONS } from "@/types/dispatcher"

export type TransitionMap = Record<LoadStatus, LoadStatus[]>

/**
 * Returns the effective transition map.
 * If `load_transition_overrides` rows exist in the DB, those are used.
 * Otherwise the hardcoded VALID_LOAD_TRANSITIONS from types/dispatcher is returned.
 */
export async function getEffectiveTransitions(): Promise<TransitionMap> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("load_transition_overrides")
      .select("from_status, to_statuses")

    if (error || !data || data.length === 0) {
      // No overrides — use hardcoded defaults
      return { ...VALID_LOAD_TRANSITIONS }
    }

    // Build map from DB rows
    const map: Partial<TransitionMap> = {}
    for (const row of data) {
      map[row.from_status as LoadStatus] = (row.to_statuses as LoadStatus[]) || []
    }

    // Ensure every LoadStatus key exists, defaulting to empty if not in DB
    const allStatuses = Object.keys(VALID_LOAD_TRANSITIONS) as LoadStatus[]
    const full: TransitionMap = {} as TransitionMap
    for (const s of allStatuses) {
      full[s] = map[s] ?? []
    }

    return full
  } catch (err) {
    console.error("Failed to load transition overrides, using defaults:", err)
    return { ...VALID_LOAD_TRANSITIONS }
  }
}
