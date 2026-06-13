// app/api/dispatcher/containers/track/route.ts
// Query Port Houston for a container and update our DB with the latest data.
// Also backfills load-level fields (vessel_eta, ssl, seal_number, holds, etc.)

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { fetchUnits } from "@/lib/port-houston/client"
import { mapUnit } from "@/lib/port-houston/mappers"
import { UNIT_FIELDS } from "@/lib/port-houston/constants"
import { isValidContainerNumber } from "@/lib/validation"
import { applyHoldUpdates } from "@/lib/port-houston/holds"
import { auditLog } from "@/lib/auditLog"
import { trackContainerSchema } from "@/lib/validations/schemas"
import { validateBody } from "@/lib/validations/validate"

export const maxDuration = 30

export async function POST(request: Request) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate body with Zod schema
    const validation = validateBody(body, trackContainerSchema)
    if (!validation.success) return validation.response
    const { container_number, container_id, load_id } = validation.data

    // Validate PH env vars are present
    const phApiUrl = process.env.PORT_HOUSTON_API_URL
    const phAuthUrl = process.env.PORT_HOUSTON_AUTH_URL
    const phClientId = process.env.PORT_HOUSTON_CLIENT_ID
    if (!phApiUrl || !phAuthUrl || !phClientId) {
      console.error(`[Container Track] Missing PH env vars: API_URL=${!!phApiUrl}, AUTH_URL=${!!phAuthUrl}, CLIENT_ID=${!!phClientId}`)
      return NextResponse.json(
        { error: "Port Houston not configured", ph_error: "Missing environment variables", tracked: false },
        { status: 502 }
      )
    }

    console.log(`[Container Track] Looking up ${container_number} at Port Houston (container_id=${container_id}, load_id=${load_id})`)

    // Query Port Houston for this container
    let phUnits
    try {
      phUnits = await fetchUnits({
        predicate: `unitId=${container_number}`,
        fields: UNIT_FIELDS,
        size: 1,
        maxPages: 1,
        timeoutMs: 25000, // Single container lookup — allow more time than default 15s
      })
      console.log(`[Container Track] PH returned ${phUnits?.length || 0} results for ${container_number}`)
      if (phUnits && phUnits.length > 0) {
        console.log(`[Container Track] PH data: transitState=${phUnits[0].transitState}, line=${phUnits[0].line}, blNbr=${phUnits[0].blNbr}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Port Houston API error"
      console.error(`[Container Track] PH API failed for ${container_number}:`, message)
      if (err instanceof Error && err.stack) console.error(`[Container Track] Stack:`, err.stack)
      return NextResponse.json(
        {
          error: "Port Houston connection failed",
          ph_error: message,
          tracked: false,
        },
        { status: 502 }
      )
    }

    if (!phUnits || phUnits.length === 0) {
      console.log(`[Container Track] Container ${container_number} not found at Port Houston`)

      // Still mark as tracked (attempted) so we know the connection worked
      if (container_id) {
        const adminSupabase = createAdminClient()
        await adminSupabase
          .from("containers")
          .update({ ph_synced_at: new Date().toISOString() })
          .eq("id", container_id)
      }

      return NextResponse.json({
        tracked: false,
        message: `Container ${container_number} not found at Port Houston`,
        ph_synced_at: new Date().toISOString(),
      })
    }

    // Map the PH data
    const mapped = mapUnit(phUnits[0])
    const { _vessel_visit_id, ...containerData } = mapped

    const adminSupabase = createAdminClient()

    // Look up vessel FK if available
    let vesselId: string | null = null
    let vesselData: { name: string; voyage_number: string | null; eta: string | null; shipping_line: string | null } | null = null

    if (_vessel_visit_id) {
      const { data: vessel } = await adminSupabase
        .from("vessels")
        .select("id, name, voyage_number, eta, shipping_line")
        .eq("visit_id", _vessel_visit_id)
        .single()

      if (vessel) {
        vesselId = vessel.id
        vesselData = vessel
      }
    }

    // Update or create the container record
    if (container_id) {
      // Update existing container
      const { error: updateError } = await adminSupabase
        .from("containers")
        .update({
          ...containerData,
          vessel_id: vesselId,
        })
        .eq("id", container_id)

      if (updateError) {
        // Duplicate container number — another load already uses this container
        if (updateError.message?.includes("duplicate key") || updateError.message?.includes("unique constraint")) {
          console.warn(`[Container Track] Duplicate container ${container_number} — already exists for another load`)
          return NextResponse.json({
            tracked: false,
            warning: `Container ${container_number} is already assigned to another load`,
            duplicate: true,
          })
        }
        console.error(`[Container Track] Container update failed:`, updateError)
        return NextResponse.json(
          { error: `Container update failed: ${updateError.message}` },
          { status: 500 }
        )
      }
    } else {
      // Check if this container already exists (by container_number or unit_id)
      const { data: existing } = await adminSupabase
        .from("containers")
        .select("id")
        .eq("container_number", container_number)
        .maybeSingle()

      if (existing) {
        // Container already exists — link to this load instead of creating a duplicate
        if (load_id) {
          await adminSupabase
            .from("loads")
            .update({
              container_id: existing.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", load_id)
        }
        // Update the existing container with fresh PH data
        await adminSupabase
          .from("containers")
          .update({
            ...containerData,
            vessel_id: vesselId,
          })
          .eq("id", existing.id)
      } else {
        // Create new container
        const { data: created, error: createError } = await adminSupabase
          .from("containers")
          .insert({
            ...containerData,
            vessel_id: vesselId,
          })
          .select("id")
          .single()

        if (createError || !created) {
          if (createError?.message?.includes("duplicate key") || createError?.message?.includes("unique constraint")) {
            console.warn(`[Container Track] Duplicate container ${container_number} — race condition`)
            return NextResponse.json({
              tracked: false,
              warning: `Container ${container_number} is already assigned to another load`,
              duplicate: true,
            })
          }
          console.error(`[Container Track] Container create failed:`, createError)
          return NextResponse.json(
            { error: `Container create failed: ${createError?.message}` },
            { status: 500 }
          )
        }

        // Link to load if provided
        if (load_id) {
          await adminSupabase
            .from("loads")
            .update({
              container_id: created.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", load_id)
        }
      }
    }

    // Backfill load-level fields from the tracked data
    if (load_id) {
      const loadUpdates: Record<string, unknown> = {}

      // Vessel info
      if (vesselData) {
        if (vesselData.eta) loadUpdates.vessel_eta = vesselData.eta
        if (vesselData.name) loadUpdates.vessel_name = vesselData.name
        if (vesselData.voyage_number) loadUpdates.voyage = vesselData.voyage_number
      }

      // Steamship line (from container or vessel)
      if (containerData.shipping_line) {
        loadUpdates.ssl = containerData.shipping_line
      } else if (vesselData?.shipping_line) {
        loadUpdates.ssl = vesselData.shipping_line
      }

      // Seal number
      if (containerData.seal_number) {
        loadUpdates.seal_number = containerData.seal_number
      }

      // Master BOL
      if (containerData.bol_number) {
        loadUpdates.mbol = containerData.bol_number
      }

      // Container size and type
      if (containerData.size) {
        loadUpdates.container_size = containerData.size
      }
      if (containerData.equipment_type) {
        loadUpdates.container_type = containerData.equipment_type
      }

      // Gate dates
      if (containerData.time_out) {
        loadUpdates.outgate_date = containerData.time_out
      }
      if (containerData.time_in) {
        loadUpdates.ingate_date = containerData.time_in
      }

      // Holds — use shared helper to map PH stop flags → hold statuses with note logging
      const holdUpdates = await applyHoldUpdates(adminSupabase, load_id, containerData)
      Object.assign(loadUpdates, holdUpdates)

      // Last tracked timestamp
      loadUpdates.last_tracked = new Date().toISOString()
      loadUpdates.updated_at = new Date().toISOString()

      if (Object.keys(loadUpdates).length > 0) {
        const { error: loadUpdateError } = await adminSupabase
          .from("loads")
          .update(loadUpdates)
          .eq("id", load_id)

        if (loadUpdateError) {
          console.error(`[Container Track] Load backfill failed:`, loadUpdateError)
          // Non-fatal — container was still tracked successfully
        }
      }
    }

    console.log(`[Container Track] Successfully tracked ${container_number}`)

    // Fire-and-forget audit log
    auditLog({
      entity_type: "container",
      entity_id: container_id || containerData.container_number,
      action: "tracked",
      user_id: user.id,
      details: {
        container_number: containerData.container_number,
        load_id,
        transit_state: containerData.transit_state,
        vessel: vesselData?.name,
      },
    })

    return NextResponse.json({
      tracked: true,
      container_number: containerData.container_number,
      shipping_line: containerData.shipping_line,
      status: containerData.status,
      transit_state: containerData.transit_state,
      last_free_day: containerData.last_free_day,
      time_in: containerData.time_in,
      time_out: containerData.time_out,
      seal_number: containerData.seal_number,
      bol_number: containerData.bol_number,
      vessel: vesselData
        ? {
            name: vesselData.name,
            voyage: vesselData.voyage_number,
            eta: vesselData.eta,
          }
        : null,
      ph_synced_at: containerData.ph_synced_at,
    })
  } catch (error) {
    console.error("[Container Track] Unexpected error:", error)
    const message = error instanceof Error ? error.message : "Tracking failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
