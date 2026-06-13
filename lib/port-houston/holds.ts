// lib/port-houston/holds.ts
// Shared logic for mapping Port Houston stop flags to load hold statuses.
// Used by both the manual track endpoint and the auto-sync rotation.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { MappedContainer } from "./mappers"

type HoldStatus = "none" | "hold" | "released"

interface CurrentHolds {
  customs_hold: HoldStatus
  customs_hold_note: string | null
  freight_hold: HoldStatus
  freight_hold_note: string | null
  other_hold: HoldStatus
  other_hold_note: string | null
}

/**
 * Compute hold updates from PH container data.
 * Returns partial load update object with hold fields + notes.
 */
export function computeHoldUpdates(
  containerData: MappedContainer,
  currentHolds: CurrentHolds
): Record<string, unknown> {
  const updates: Record<string, unknown> = {}

  if (containerData.stopped_road) {
    const impediment = (containerData.impediment_road || "").toUpperCase()
    const now = formatTimestamp(new Date())

    if (impediment.includes("CUSTOM")) {
      if (currentHolds.customs_hold !== "hold") {
        updates.customs_hold = "hold"
        updates.customs_hold_note = appendNote(
          currentHolds.customs_hold_note,
          `Customs Hold detected — ${now}`
        )
      }
    }

    if (impediment.includes("FREIGHT")) {
      if (currentHolds.freight_hold !== "hold") {
        updates.freight_hold = "hold"
        updates.freight_hold_note = appendNote(
          currentHolds.freight_hold_note,
          `Freight Hold detected — ${now}`
        )
      }
    }

    if (impediment.includes("BROKER")) {
      if (currentHolds.other_hold !== "hold") {
        updates.other_hold = "hold"
        updates.other_hold_note = appendNote(
          currentHolds.other_hold_note,
          `Broker Hold detected (via Port Houston) — ${now}`
        )
      }
    }

    // If impediment doesn't match known types, default to customs
    if (
      !impediment.includes("CUSTOM") &&
      !impediment.includes("FREIGHT") &&
      !impediment.includes("BROKER")
    ) {
      if (currentHolds.customs_hold !== "hold") {
        updates.customs_hold = "hold"
        updates.customs_hold_note = appendNote(
          currentHolds.customs_hold_note,
          `Hold detected: ${containerData.impediment_road || "unknown"} — ${now}`
        )
      }
    }
  } else {
    // Road not stopped — release holds that were previously set from PH
    const now = formatTimestamp(new Date())

    if (currentHolds.customs_hold === "hold") {
      updates.customs_hold = "released"
      updates.customs_hold_note = appendNote(
        currentHolds.customs_hold_note,
        `Customs Released (via Port Houston) — ${now}`
      )
    }

    if (currentHolds.freight_hold === "hold") {
      updates.freight_hold = "released"
      updates.freight_hold_note = appendNote(
        currentHolds.freight_hold_note,
        `Freight Released (via Port Houston) — ${now}`
      )
    }
  }

  return updates
}

/**
 * Full flow: fetch current holds, compute updates, write to DB.
 * Returns the hold update fields (empty object if no changes).
 */
export async function applyHoldUpdates(
  supabase: SupabaseClient,
  loadId: string,
  containerData: MappedContainer
): Promise<Record<string, unknown>> {
  // Fetch current hold values from the load
  const { data: load, error } = await supabase
    .from("loads")
    .select(
      "customs_hold, customs_hold_note, freight_hold, freight_hold_note, other_hold, other_hold_note"
    )
    .eq("id", loadId)
    .single()

  if (error || !load) {
    console.error(`[Holds] Failed to fetch load ${loadId}:`, error?.message)
    return {}
  }

  const currentHolds: CurrentHolds = {
    customs_hold: (load.customs_hold as HoldStatus) || "none",
    customs_hold_note: load.customs_hold_note || null,
    freight_hold: (load.freight_hold as HoldStatus) || "none",
    freight_hold_note: load.freight_hold_note || null,
    other_hold: (load.other_hold as HoldStatus) || "none",
    other_hold_note: load.other_hold_note || null,
  }

  return computeHoldUpdates(containerData, currentHolds)
}

// ─── Helpers ──────────────────────────────────────────────

function appendNote(
  existing: string | null,
  newEntry: string
): string {
  if (!existing || existing.trim() === "") return newEntry
  return `${existing}\n${newEntry}`
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}
