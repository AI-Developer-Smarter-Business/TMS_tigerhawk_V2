// lib/port-houston/sync.ts
// Orchestrates syncing vessel and container data from Port Houston → Supabase
// Optimized for Vercel Pro 60s function timeout

import { createAdminClient } from "@/lib/supabase/admin"
import { fetchVesselVisits, fetchUnits } from "./client"
import { mapVessel, mapUnit, isValidTerminal } from "./mappers"
import type { MappedVessel, MappedContainer } from "./mappers"
import type { SyncResult } from "./types"
import { UNIT_FIELDS } from "./constants"

// Re-export for backwards compatibility
export { UNIT_FIELDS }

// Fields we request from PH for vessels
const VESSEL_FIELDS = [
  "visitId",
  "vesName",
  "vesId",
  "lineId",
  "lineName",
  "ibVyg",
  "obVyg",
  "eta",
  "etd",
  "ata",
  "atd",
  "publishedEta",
  "publishedEtd",
  "visitPhase",
  "serviceName",
  "facility",
  "timeFirstAvailability",
  "timeDischargeComplete",
  "cargoCutoff",
  "reeferCutoff",
  "hazCutoff",
  "berths",
]

// Batch size for Supabase upserts — larger = fewer round trips
const UPSERT_BATCH_SIZE = 200

// Max containers to query from PH per sync (batched by unitId predicate)
const CONTAINER_BATCH_SIZE = 25

/**
 * Upsert rows to Supabase in parallel batches.
 * Returns { upserted, errors } count.
 */
async function parallelUpsert(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn: string
): Promise<{ upserted: number; errors: string[] }> {
  if (rows.length === 0) return { upserted: 0, errors: [] }

  const supabase = createAdminClient()
  const errors: string[] = []
  let upserted = 0

  // Split into chunks
  const chunks: Record<string, unknown>[][] = []
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    chunks.push(rows.slice(i, i + UPSERT_BATCH_SIZE))
  }

  // Run all chunks in parallel
  const results = await Promise.allSettled(
    chunks.map((chunk, idx) =>
      supabase
        .from(table)
        .upsert(chunk, { onConflict: conflictColumn })
        .then(({ error }) => {
          if (error) {
            console.error(`${table} upsert error (batch ${idx}):`, error)
            errors.push(`${table} batch ${idx}: ${error.message}`)
            return 0
          }
          return chunk.length
        })
    )
  )

  for (const result of results) {
    if (result.status === "fulfilled") {
      upserted += result.value
    }
  }

  return { upserted, errors }
}

// ============================================================
// Vessel Sync
// ============================================================

export async function syncVessels(facility?: string): Promise<number> {
  const now = new Date()
  // -2 days (catch recently arrived) to +14 days (upcoming arrivals)
  const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const phVessels = await fetchVesselVisits({
    facility,
    etaFrom: from.toISOString(),
    etaTo: to.toISOString(),
    fields: VESSEL_FIELDS,
  })

  if (phVessels.length === 0) return 0

  const mapped: MappedVessel[] = phVessels
    .filter((v) => v.visitId)
    .map(mapVessel)
    .filter((v) => isValidTerminal(v.terminal))
    // Note: we sync departed vessels too so their visit_phase updates in the DB.
    // The UI filters them out from stats/display.

  console.log(
    `[PH Sync] Fetched ${phVessels.length} vessels from PH, ${mapped.length} after filtering to active container terminals`
  )

  const { upserted } = await parallelUpsert(
    "vessels",
    mapped as unknown as Record<string, unknown>[],
    "visit_id"
  )

  return upserted
}

// ============================================================
// Container Sync (targeted — only containers already in our DB)
// ============================================================

/**
 * Sync containers that already exist in our database.
 * Instead of pulling the entire PH inventory, we look up only the
 * container numbers we already track and update their status/details.
 */
export async function syncContainers(_facility?: string): Promise<number> {
  const supabase = createAdminClient()

  // Get container numbers already in our DB that haven't been picked up
  const { data: existingContainers, error: fetchError } = await supabase
    .from("containers")
    .select("container_number, unit_id")
    .not("status", "eq", "Picked Up")
    .not("container_number", "is", null)
    .limit(500) // Safety cap

  if (fetchError) {
    console.error("[PH Sync] Error fetching existing containers:", fetchError)
    throw new Error(`Failed to fetch existing containers: ${fetchError.message}`)
  }

  if (!existingContainers || existingContainers.length === 0) {
    console.log("[PH Sync] No existing containers to sync")
    return 0
  }

  // Get unique container numbers (some may not have unit_id yet)
  const containerNumbers = [
    ...new Set(
      existingContainers
        .map((c) => c.container_number || c.unit_id)
        .filter(Boolean)
    ),
  ] as string[]

  console.log(
    `[PH Sync] Looking up ${containerNumbers.length} containers from PH`
  )

  // Query PH one container at a time using unitId predicate
  // Batching with "in" may not be supported by PH — individual lookups
  // are small and fast, and we run them in parallel
  const allPhUnits = []
  const startFetch = Date.now()

  // Run all lookups in parallel (each is a single-result query)
  const batchPromises = containerNumbers.map((containerId) =>
    fetchUnits({
      predicate: `unitId=${containerId}`,
      fields: UNIT_FIELDS,
      maxPages: 1, // Single container = no pagination needed
    }).catch((err) => {
      console.error(
        `[PH Sync] Container ${containerId} fetch error:`,
        err instanceof Error ? err.message : err
      )
      return [] // Don't fail the whole sync for one container
    })
  )

  const batchResults = await Promise.all(batchPromises)
  for (const units of batchResults) {
    allPhUnits.push(...units)
  }

  console.log(
    `[PH Sync] PH container lookups done in ${Date.now() - startFetch}ms, found ${allPhUnits.length}/${containerNumbers.length}`
  )

  if (allPhUnits.length === 0) {
    console.log("[PH Sync] No matching containers found in PH")
    return 0
  }

  console.log(
    `[PH Sync] Found ${allPhUnits.length} containers in PH matching our records`
  )

  const mapped: MappedContainer[] = allPhUnits
    .filter((u) => u.unitId)
    .map(mapUnit)

  // Build vessel FK lookup
  const vesselVisitIds = [
    ...new Set(mapped.map((c) => c._vessel_visit_id).filter(Boolean)),
  ]

  let vesselLookup: Record<string, string> = {}
  if (vesselVisitIds.length > 0) {
    const lookupChunks: string[][] = []
    for (let i = 0; i < vesselVisitIds.length; i += 200) {
      lookupChunks.push(vesselVisitIds.slice(i, i + 200) as string[])
    }

    const lookupResults = await Promise.all(
      lookupChunks.map((ids) =>
        supabase.from("vessels").select("id, visit_id").in("visit_id", ids)
      )
    )

    for (const { data: vessels } of lookupResults) {
      if (vessels) {
        for (const v of vessels) {
          vesselLookup[v.visit_id] = v.id
        }
      }
    }
  }

  // Prepare rows (strip _vessel_visit_id, add vessel_id FK)
  const rows = mapped.map((c) => {
    const { _vessel_visit_id, ...row } = c
    return {
      ...row,
      vessel_id: _vessel_visit_id
        ? vesselLookup[_vessel_visit_id] || null
        : null,
    }
  })

  const { upserted } = await parallelUpsert(
    "containers",
    rows as unknown as Record<string, unknown>[],
    "unit_id"
  )

  return upserted
}

// ============================================================
// Full Sync (with deadline awareness)
// ============================================================

export async function fullSync(facility?: string): Promise<SyncResult> {
  const startTime = Date.now()
  const errors: string[] = []
  let vesselCount = 0
  let containerCount = 0

  // Sync vessels first (containers reference them)
  try {
    vesselCount = await syncVessels(facility)
    console.log(`[PH Sync] Vessels done in ${Date.now() - startTime}ms`)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vessel sync failed"
    errors.push(message)
    console.error("Vessel sync error:", err)
  }

  // Check if we have time for containers (leave 10s buffer)
  const elapsed = Date.now() - startTime
  const remainingMs = 50000 - elapsed

  if (remainingMs < 5000) {
    console.warn(
      `[PH Sync] Skipping container sync — only ${remainingMs}ms remaining`
    )
    errors.push("Container sync skipped (not enough time remaining)")
  } else {
    try {
      containerCount = await syncContainers(facility)
      console.log(
        `[PH Sync] Containers done in ${Date.now() - startTime}ms`
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Container sync failed"
      errors.push(message)
      console.error("Container sync error:", err)
    }
  }

  // Update last sync timestamp
  try {
    const supabase = createAdminClient()
    await supabase.from("port_houston_sync").upsert(
      {
        key: "last_full_sync",
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
  } catch {
    // Non-critical
  }

  return {
    vessels: vesselCount,
    containers: containerCount,
    errors,
  }
}
