// app/api/port-houston/rotate/route.ts
// Cron handler — rotates through active containers, querying PH for fresh data.
// Schedule: vercel.json runs this every 15 min on Vercel (legacy file in repo).
// On Netlify, configure a scheduled function or external cron calling this URL with
// Authorization: Bearer CRON_SECRET — Netlify does not read vercel.json; check the
// host's max serverless duration (may be < maxDuration below on lower tiers).
// Processes 1/4 of qualifying containers per cycle (full rotation in ~1 hour).
// Picks the stalest containers first, skips any that timeout (>1s).
// Writes progress to port_houston_sync so the UI can show live status.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchUnits } from "@/lib/port-houston/client"
import { mapUnit } from "@/lib/port-houston/mappers"
import { UNIT_FIELDS } from "@/lib/port-houston/constants"
import { applyHoldUpdates } from "@/lib/port-houston/holds"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const PER_CONTAINER_TIMEOUT_MS = 1000 // 1s — skip if slower, avg is ~200ms

interface ContainerResult {
  container_number: string
  status: "ok" | "skip" | "fail" | "not_found"
  message?: string
}

interface RotateProgress {
  state: "running" | "done" | "error"
  started_at: string
  current_container?: string
  results: ContainerResult[]
  checked: number
  updated: number
  skipped: number
  errors: number
}

async function writeProgress(
  admin: ReturnType<typeof createAdminClient>,
  progress: RotateProgress
) {
  try {
    await admin.from("port_houston_sync").upsert(
      {
        key: "rotate_status",
        value: JSON.stringify(progress),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
  } catch {
    // port_houston_sync table may not exist — non-fatal
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth: accept either cron secret OR authenticated user session
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    const hasCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!hasCronAuth) {
      // Fall back to user session auth
      console.log("[Rotate] No cron auth, checking user session...")
      try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        console.log("[Rotate] Authenticated as user:", user.email)
      } catch (authErr) {
        console.error("[Rotate] Auth check threw:", authErr)
        return NextResponse.json({ error: "Auth failed" }, { status: 401 })
      }
    }

    // Validate PH env vars early
    if (!process.env.PORT_HOUSTON_API_URL || !process.env.PORT_HOUSTON_CLIENT_ID) {
      return NextResponse.json(
        { error: "Port Houston env vars not configured" },
        { status: 500 }
      )
    }

    console.log("[Rotate] Creating admin client...")
    const admin = createAdminClient()
    console.log("[Rotate] Admin client created OK")

    const progress: RotateProgress = {
      state: "running",
      started_at: new Date().toISOString(),
      results: [],
      checked: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    }

    console.log("[Rotate] Writing initial progress...")
    await writeProgress(admin, progress)
    console.log("[Rotate] Initial progress written OK")

    // Only scan containers whose load is still pre-pickup (container still at port).
    // Step 1: Find loads in pre-pickup statuses that have a container linked.
    const PRE_PICKUP_STATUSES = [
      "Available", "Pending", "Customs Hold", "Freight Released",
      "Created", "Assigned", "Dispatched",
    ]

    console.log("[Rotate] Step 1: Querying active loads in pre-pickup statuses...")

    // Only select fields we need here — hold fields are fetched later by applyHoldUpdates
    const { data: activeLoads, error: loadsError } = await admin
      .from("loads")
      .select("id, container_id, status")
      .not("container_id", "is", null)
      .in("status", PRE_PICKUP_STATUSES)

    if (loadsError) {
      console.warn("[Rotate] Loads query failed (will retry next cycle):", loadsError.message)
      progress.state = "done"
      await writeProgress(admin, progress)
      return NextResponse.json({ checked: 0, updated: 0, skipped: 0, errors: [loadsError.message] })
    }

    const activeContainerIds = new Set(
      (activeLoads || [])
        .map(l => l.container_id)
        .filter((id): id is string => !!id)
    )

    // Dynamic batch: process 1/4 of qualifying containers each cycle
    // At every-15-min intervals, full rotation completes in ~1 hour
    const batchSize = Math.max(1, Math.ceil(activeContainerIds.size / 4))

    console.log(`[Rotate] Found ${activeContainerIds.size} qualifying containers → batch size ${batchSize} (1/4)`)

    if (activeContainerIds.size === 0) {
      progress.state = "done"
      await writeProgress(admin, progress)
      return NextResponse.json({ checked: 0, updated: 0, skipped: 0, errors: [] })
    }

    // Step 2: Get the stalest containers.
    // Can't use .in() with 500+ UUIDs (URL too long → fetch fails).
    // Instead, query all containers ordered by staleness and pick the first
    // batchSize that are in our active set.
    console.log("[Rotate] Step 2: Querying stalest containers...")
    // Fetch more candidates than batchSize to account for non-active containers in the staleness order
    const FETCH_LIMIT = Math.min(Math.max(batchSize * 4, 200), 1000)
    const { data: candidateContainers, error: queryError } = await admin
      .from("containers")
      .select("id, container_number, unit_id, transit_state, ph_synced_at")
      .not("container_number", "is", null)
      .order("ph_synced_at", { ascending: true, nullsFirst: true })
      .limit(FETCH_LIMIT)

    if (queryError) {
      console.warn("[Rotate] Container query failed (will retry next cycle):", queryError.message)
      progress.state = "done"
      await writeProgress(admin, progress)
      return NextResponse.json({ checked: 0, updated: 0, skipped: 0, errors: [queryError.message] })
    }

    // Filter client-side to only containers linked to active (pre-pickup) loads
    const staleContainers = (candidateContainers || [])
      .filter(c => activeContainerIds.has(c.id))
      .slice(0, batchSize)

    console.log(`[Rotate] Fetched ${candidateContainers?.length || 0} candidates, ${staleContainers.length} match active loads`)

    if (!staleContainers || staleContainers.length === 0) {
      console.log("[Rotate] No stale containers to check")
      progress.state = "done"
      await writeProgress(admin, progress)
      return NextResponse.json({ checked: 0, updated: 0, skipped: 0, errors: [] })
    }

    console.log(`[Rotate] Will check ${staleContainers.length} containers: ${staleContainers.map(c => c.container_number).join(", ")}`)

    // Build lookup: container_id → load
    const loadByContainerId: Record<string, (typeof activeLoads)[number]> = {}
    for (const load of activeLoads || []) {
      if (load.container_id) loadByContainerId[load.container_id] = load
    }

    for (const container of staleContainers) {
      if (!container.container_number) continue
      progress.checked++
      progress.current_container = container.container_number
      await writeProgress(admin, progress)

      try {
        // Query PH with strict 10s timeout — skip if too slow
        // Use same predicate syntax as the working track endpoint
        const units = await fetchUnits({
          predicate: `unitId=${container.container_number}`,
          fields: UNIT_FIELDS,
          size: 1,
          maxPages: 1,
          timeoutMs: PER_CONTAINER_TIMEOUT_MS,
        })

        if (!units || units.length === 0) {
          // Still bump ph_synced_at so this container moves to the back of the queue
          await admin
            .from("containers")
            .update({ ph_synced_at: new Date().toISOString() })
            .eq("id", container.id)

          progress.results.push({
            container_number: container.container_number,
            status: "not_found",
          })
          await writeProgress(admin, progress)
          continue
        }

        const mapped = mapUnit(units[0])

        // Update the existing container record by its known id
        // (not upsert by unit_id, which may be null for manually-created containers)
        const { _vessel_visit_id, ...containerRow } = mapped
        let vesselId: string | null = null

        if (_vessel_visit_id) {
          const { data: vessel } = await admin
            .from("vessels")
            .select("id")
            .eq("visit_id", _vessel_visit_id)
            .single()
          vesselId = vessel?.id || null
        }

        // Remove fields that shouldn't overwrite an existing record's primary key
        const { unit_id: _uid, container_number: _cn, ...updateFields } = containerRow

        // Explicitly set ph_synced_at to NOW to ensure staleness ordering advances
        const phSyncedAt = new Date().toISOString()

        const { error: updateErr } = await admin
          .from("containers")
          .update({
            ...updateFields,
            unit_id: mapped.unit_id, // ensure unit_id is set for future syncs
            vessel_id: vesselId,
            ph_synced_at: phSyncedAt,
          })
          .eq("id", container.id)

        if (updateErr) {
          console.error(`[Rotate] Container update failed for ${container.container_number}:`, updateErr.message)
          progress.results.push({
            container_number: container.container_number,
            status: "fail",
            message: updateErr.message,
          })
          progress.errors++
          await writeProgress(admin, progress)
          continue
        }

        console.log(`[Rotate] Updated container ${container.container_number} (ph_synced_at=${phSyncedAt})`)

        // Find the linked load for this container
        const linkedLoad = loadByContainerId[container.id]
        console.log(`[Rotate] Linked load for ${container.container_number}: ${linkedLoad ? linkedLoad.id : "NOT FOUND"}`)

        if (linkedLoad) {
          try {
            // Apply hold updates to the load (with note logging)
            const holdUpdates = await applyHoldUpdates(admin, linkedLoad.id, mapped)

            // Also backfill basic load fields
            const loadUpdates: Record<string, unknown> = {
              ...holdUpdates,
              last_tracked: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

            if (mapped.shipping_line) loadUpdates.ssl = mapped.shipping_line
            if (mapped.seal_number) loadUpdates.seal_number = mapped.seal_number
            if (mapped.bol_number) loadUpdates.mbol = mapped.bol_number
            if (mapped.time_out) loadUpdates.outgate_date = mapped.time_out
            if (mapped.time_in) loadUpdates.ingate_date = mapped.time_in
            if (mapped.size) loadUpdates.container_size = mapped.size
            if (mapped.equipment_type) loadUpdates.container_type = mapped.equipment_type

            const { error: loadErr } = await admin
              .from("loads")
              .update(loadUpdates)
              .eq("id", linkedLoad.id)

            if (loadErr) {
              console.error(`[Rotate] Load update failed for ${container.container_number}:`, loadErr.message)
              // If last_tracked column doesn't exist, retry without it
              if (loadErr.message?.includes("last_tracked")) {
                const { last_tracked: _lt, ...fallbackUpdates } = loadUpdates
                await admin.from("loads").update(fallbackUpdates).eq("id", linkedLoad.id)
                console.log(`[Rotate] Load update retried without last_tracked for ${container.container_number}`)
              }
            } else {
              console.log(`[Rotate] Load ${linkedLoad.id} updated (last_tracked + holds) for ${container.container_number}`)
            }
          } catch (loadUpdateErr) {
            // Non-fatal — container was still updated successfully
            console.error(`[Rotate] Load update threw for ${container.container_number}:`, loadUpdateErr)
          }
        }

        progress.results.push({
          container_number: container.container_number,
          status: "ok",
        })
        progress.updated++

        await writeProgress(admin, progress)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown"
        const isTimeout =
          (err instanceof DOMException && err.name === "AbortError") ||
          msg.includes("timeout")
        const isNetwork =
          err instanceof TypeError && /fetch failed|network|ECONNR/i.test(msg)

        if (isTimeout || isNetwork) {
          progress.results.push({
            container_number: container.container_number,
            status: "skip",
            message: isTimeout ? "timeout" : "network error",
          })
          progress.skipped++
          console.log(
            `[Rotate] Skipped ${container.container_number} (${isTimeout ? "timeout" : "network error"})`
          )
        } else {
          progress.results.push({
            container_number: container.container_number,
            status: "fail",
            message: msg,
          })
          progress.errors++
        }
        await writeProgress(admin, progress)
      }
    }

    // Mark done
    progress.state = "done"
    progress.current_container = undefined
    await writeProgress(admin, progress)

    console.log(
      `[Rotate] Done: checked=${progress.checked} updated=${progress.updated} skipped=${progress.skipped} errors=${progress.errors}`
    )

    return NextResponse.json({
      checked: progress.checked,
      updated: progress.updated,
      skipped: progress.skipped,
      errors: progress.results.filter((r) => r.status === "fail").map((r) => r.message),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Rotate failed"
    console.warn("[Rotate] Error (will retry next cycle):", msg)
    return NextResponse.json({
      checked: 0,
      updated: 0,
      skipped: 0,
      errors: [msg],
    })
  }
}
