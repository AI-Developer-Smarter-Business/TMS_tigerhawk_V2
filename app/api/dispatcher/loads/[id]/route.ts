// app/api/dispatcher/loads/[id]/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { updateLoadSchema } from "@/lib/validations/schemas"
import { validateBody } from "@/lib/validations/validate"

// Full container join (requires migration 20260220_add_container_tracking_columns)
const FULL_CONTAINERS_JOIN = `containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, seal_number, time_in, time_out, stopped_road, stopped_vessel, stopped_rail, impediment_road, equipment_type, ph_synced_at, vessel_id, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) )`

// Minimal container join (safe fallback if tracking columns not yet migrated)
const SAFE_CONTAINERS_JOIN = `containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, seal_number, vessel_id, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) )`

const LOAD_SELECT_BASE = `*, customers ( id, name, email, phone, address, city, state, zip_code ), drivers ( id, name, phone, status )`

/**
 * Try full select first, fall back to safe select if columns don't exist yet.
 */
async function selectLoad(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  // Try full join first
  const { data, error } = await supabase
    .from("loads")
    .select(`${LOAD_SELECT_BASE}, ${FULL_CONTAINERS_JOIN}`)
    .eq("id", id)
    .single()

  if (!error) return { data, error: null }

  // If error mentions a column not existing, fall back to safe join
  if (error.message?.includes("column") || error.code === "PGRST204" || error.code === "42703") {
    console.warn("[Load Select] Full container join failed, falling back to safe join:", error.message)
    return supabase
      .from("loads")
      .select(`${LOAD_SELECT_BASE}, ${SAFE_CONTAINERS_JOIN}`)
      .eq("id", id)
      .single()
  }

  return { data, error }
}

async function selectLoadAfterUpdate(supabase: Awaited<ReturnType<typeof createClient>>, id: string, updates: Record<string, unknown>) {
  // Try full join first
  const { data, error } = await supabase
    .from("loads")
    .update(updates)
    .eq("id", id)
    .select(`${LOAD_SELECT_BASE}, ${FULL_CONTAINERS_JOIN}`)
    .single()

  if (!error) return { data, error: null }

  if (error.message?.includes("column") || error.code === "PGRST204" || error.code === "42703") {
    console.warn("[Load Update+Select] Full container join failed, falling back:", error.message)
    // Do the update separately, then select with safe join
    await supabase.from("loads").update(updates).eq("id", id)
    return supabase
      .from("loads")
      .select(`${LOAD_SELECT_BASE}, ${SAFE_CONTAINERS_JOIN}`)
      .eq("id", id)
      .single()
  }

  return { data, error }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch load with all relations (graceful fallback if tracking columns not migrated)
    const { data: load, error: fetchError } = await selectLoad(supabase, id)

    if (fetchError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    return NextResponse.json(load)
  } catch (error) {
    console.error("Error fetching load:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current load to check permissions
    const { data: currentLoad, error: fetchError } = await supabase
      .from("loads")
      .select("id, status, driver_id, container_id")
      .eq("id", id)
      .single()

    if (fetchError || !currentLoad) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Check permissions
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isStaff = profile && ["admin", "dispatcher"].includes(profile.role)
    const isAssignedDriver = profile?.role === "driver" && currentLoad.driver_id === user.id

    if (!isStaff && !isAssignedDriver) {
      return NextResponse.json(
        { error: "You don't have permission to edit this load" },
        { status: 403 }
      )
    }

    const body = await request.json()

    const result = validateBody(body, updateLoadSchema)
    if (!result.success) return result.response

    // Build allowed updates
    const allowedUpdates: Record<string, unknown> = {}

    // Staff-only fields
    if (isStaff) {
      if (body.customer_id !== undefined) allowedUpdates.customer_id = body.customer_id
      if (body.container_id !== undefined) allowedUpdates.container_id = body.container_id
      if (body.driver_id !== undefined) allowedUpdates.driver_id = body.driver_id
      if (body.load_type !== undefined) allowedUpdates.load_type = body.load_type
      if (body.route_type !== undefined) allowedUpdates.route_type = body.route_type
    }

    // Editable by both staff and driver
    if (body.pickup_location !== undefined) allowedUpdates.pickup_location = body.pickup_location
    if (body.delivery_location !== undefined) allowedUpdates.delivery_location = body.delivery_location
    if (body.return_location !== undefined) allowedUpdates.return_location = body.return_location
    if (body.scheduled_pickup !== undefined) allowedUpdates.scheduled_pickup = body.scheduled_pickup
    if (body.chassis_number !== undefined) allowedUpdates.chassis_number = body.chassis_number
    if (body.rate !== undefined) allowedUpdates.rate = body.rate
    if (body.distance !== undefined) allowedUpdates.distance = body.distance
    if (body.notes !== undefined) allowedUpdates.notes = body.notes
    if (body.pickup_apt_from !== undefined) allowedUpdates.pickup_apt_from = body.pickup_apt_from
    if (body.pickup_apt_to !== undefined) allowedUpdates.pickup_apt_to = body.pickup_apt_to
    if (body.delivery_apt_from !== undefined) allowedUpdates.delivery_apt_from = body.delivery_apt_from
    if (body.delivery_apt_to !== undefined) allowedUpdates.delivery_apt_to = body.delivery_apt_to
    if (body.return_apt_from !== undefined) allowedUpdates.return_apt_from = body.return_apt_from
    if (body.return_apt_to !== undefined) allowedUpdates.return_apt_to = body.return_apt_to
    if (body.ssl !== undefined) allowedUpdates.ssl = body.ssl
    if (body.mbol !== undefined) allowedUpdates.mbol = body.mbol
    if (body.house_bol !== undefined) allowedUpdates.house_bol = body.house_bol
    if (body.is_hazmat !== undefined) allowedUpdates.is_hazmat = body.is_hazmat
    if (body.is_hot !== undefined) allowedUpdates.is_hot = body.is_hot
    if (body.is_overweight !== undefined) allowedUpdates.is_overweight = body.is_overweight
    if (body.is_oog !== undefined) allowedUpdates.is_oog = body.is_oog
    if (body.is_street_turn !== undefined) allowedUpdates.is_street_turn = body.is_street_turn
    if (body.is_tanker !== undefined) allowedUpdates.is_tanker = body.is_tanker
    if (body.is_bonded !== undefined) allowedUpdates.is_bonded = body.is_bonded
    if (body.is_liquor !== undefined) allowedUpdates.is_liquor = body.is_liquor
    if (body.is_ev !== undefined) allowedUpdates.is_ev = body.is_ev
    if (body.is_double !== undefined) allowedUpdates.is_double = body.is_double
    if (body.is_genset !== undefined) allowedUpdates.is_genset = body.is_genset
    if (body.is_scale !== undefined) allowedUpdates.is_scale = body.is_scale
    if (body.is_overheight !== undefined) allowedUpdates.is_overheight = body.is_overheight
    // Key Dates
    if (body.vessel_eta !== undefined) allowedUpdates.vessel_eta = body.vessel_eta
    if (body.discharge_date !== undefined) allowedUpdates.discharge_date = body.discharge_date
    if (body.outgate_date !== undefined) allowedUpdates.outgate_date = body.outgate_date
    if (body.delivered_to_user_date !== undefined) allowedUpdates.delivered_to_user_date = body.delivered_to_user_date
    if (body.empty_date !== undefined) allowedUpdates.empty_date = body.empty_date
    if (body.per_diem_free_day !== undefined) allowedUpdates.per_diem_free_day = body.per_diem_free_day
    if (body.ingate_date !== undefined) allowedUpdates.ingate_date = body.ingate_date
    if (body.ready_to_return_date !== undefined) allowedUpdates.ready_to_return_date = body.ready_to_return_date
    if (body.completed_date !== undefined) allowedUpdates.completed_date = body.completed_date
    if (body.chassis_pickup_date !== undefined) allowedUpdates.chassis_pickup_date = body.chassis_pickup_date
    if (body.chassis_termination_date !== undefined) allowedUpdates.chassis_termination_date = body.chassis_termination_date
    // Equipment fields
    if (body.container_number !== undefined) allowedUpdates.container_number = body.container_number
    if (body.container_size !== undefined) allowedUpdates.container_size = body.container_size
    if (body.container_type !== undefined) allowedUpdates.container_type = body.container_type
    if (body.chassis_size !== undefined) allowedUpdates.chassis_size = body.chassis_size
    if (body.chassis_type !== undefined) allowedUpdates.chassis_type = body.chassis_type
    if (body.chassis_owner !== undefined) allowedUpdates.chassis_owner = body.chassis_owner
    if (body.genset_number !== undefined) allowedUpdates.genset_number = body.genset_number
    if (body.temperature !== undefined) allowedUpdates.temperature = body.temperature
    if (body.route_template !== undefined) allowedUpdates.route_template = body.route_template
    if (body.hook_chassis_location !== undefined) allowedUpdates.hook_chassis_location = body.hook_chassis_location
    if (body.terminate_chassis_location !== undefined) allowedUpdates.terminate_chassis_location = body.terminate_chassis_location
    if (body.scac !== undefined) allowedUpdates.scac = body.scac
    if (body.carrier_hold !== undefined) allowedUpdates.carrier_hold = body.carrier_hold
    if (body.carrier_hold_note !== undefined) allowedUpdates.carrier_hold_note = body.carrier_hold_note
    // Container visibility / holds
    if (body.freight_hold !== undefined) allowedUpdates.freight_hold = body.freight_hold
    if (body.freight_hold_note !== undefined) allowedUpdates.freight_hold_note = body.freight_hold_note
    if (body.customs_hold !== undefined) allowedUpdates.customs_hold = body.customs_hold
    if (body.customs_hold_note !== undefined) allowedUpdates.customs_hold_note = body.customs_hold_note
    if (body.terminal_hold !== undefined) allowedUpdates.terminal_hold = body.terminal_hold
    if (body.terminal_hold_note !== undefined) allowedUpdates.terminal_hold_note = body.terminal_hold_note
    if (body.fees_hold !== undefined) allowedUpdates.fees_hold = body.fees_hold
    if (body.fees_hold_note !== undefined) allowedUpdates.fees_hold_note = body.fees_hold_note
    if (body.other_hold !== undefined) allowedUpdates.other_hold = body.other_hold
    if (body.other_hold_note !== undefined) allowedUpdates.other_hold_note = body.other_hold_note
    // Reference / shipping fields
    if (body.reference_number !== undefined) allowedUpdates.reference_number = body.reference_number
    if (body.vessel_name !== undefined) allowedUpdates.vessel_name = body.vessel_name
    if (body.voyage !== undefined) allowedUpdates.voyage = body.voyage
    if (body.purchase_order !== undefined) allowedUpdates.purchase_order = body.purchase_order
    if (body.shipment_number !== undefined) allowedUpdates.shipment_number = body.shipment_number
    if (body.pickup_number !== undefined) allowedUpdates.pickup_number = body.pickup_number
    if (body.appointment_number !== undefined) allowedUpdates.appointment_number = body.appointment_number
    if (body.return_number !== undefined) allowedUpdates.return_number = body.return_number
    if (body.reservation_number !== undefined) allowedUpdates.reservation_number = body.reservation_number
    if (body.seal_number !== undefined) allowedUpdates.seal_number = body.seal_number
    // Container-level fields (will be redirected to containers table)
    if (body.last_free_day !== undefined) allowedUpdates.last_free_day = body.last_free_day

    // ── Handle container-level fields separately ──
    // These fields live on the `containers` table, not `loads`
    const containerUpdates: Record<string, unknown> = {}
    if (allowedUpdates.container_number !== undefined) {
      containerUpdates.container_number = allowedUpdates.container_number
      delete allowedUpdates.container_number
    }
    if (allowedUpdates.last_free_day !== undefined) {
      containerUpdates.last_free_day = allowedUpdates.last_free_day
      delete allowedUpdates.last_free_day
    }

    // Update container record if we have container-level changes
    if (Object.keys(containerUpdates).length > 0) {
      const adminSupabase = createAdminClient()

      if (currentLoad.container_id) {
        // Container exists — update it
        const { error: containerError } = await adminSupabase
          .from("containers")
          .update(containerUpdates)
          .eq("id", currentLoad.container_id)

        if (containerError) {
          console.error("Container update error:", containerError)
          return NextResponse.json(
            { error: `Container update failed: ${containerError.message}` },
            { status: 500 }
          )
        }
      } else {
        // No container linked — create one and link it to the load
        // First, check what columns the containers table actually requires
        const newContainer: Record<string, unknown> = {
          container_number: (containerUpdates.container_number as string) || "PENDING",
          status: "Available",
        }
        // Only add last_free_day if it was provided
        if (containerUpdates.last_free_day !== undefined) {
          newContainer.last_free_day = containerUpdates.last_free_day
        }

        const { data: created, error: createError } = await adminSupabase
          .from("containers")
          .insert(newContainer)
          .select("id")
          .single()

        if (createError || !created) {
          console.error("Container create error:", JSON.stringify(createError))
          return NextResponse.json(
            { error: `Container create failed: ${createError?.message || "unknown"}` },
            { status: 500 }
          )
        }

        // Link new container to this load
        const { error: linkError } = await adminSupabase
          .from("loads")
          .update({ container_id: created.id, updated_at: new Date().toISOString() })
          .eq("id", id)

        if (linkError) {
          console.error("Container link error:", linkError)
          return NextResponse.json(
            { error: `Container link failed: ${linkError.message}` },
            { status: 500 }
          )
        }
        console.log("Created and linked new container:", created.id)
      }
    }

    // Note: Port Houston tracking is now triggered client-side from LoadInfoTab
    // after a container_number save, giving the user visual feedback (spinner + result).
    // The periodic sync (fullSync) also updates containers in the background.

    if (Object.keys(allowedUpdates).length === 0 && Object.keys(containerUpdates).length > 0) {
      // Only container fields were changed — still return the updated load
      const { data: load, error: fetchError } = await selectLoad(supabase, id)

      if (fetchError || !load) {
        console.error("Fetch after container update error:", fetchError)
        return NextResponse.json({ error: "Failed to fetch updated load" }, { status: 500 })
      }

      // Log activity for staff updates
      if (isStaff) {
        const adminSupabase2 = createAdminClient()
        await adminSupabase2.from("activity_log").insert({
          entity_type: "load",
          entity_id: id,
          action: "updated",
          user_id: user.id,
          details: {
            reference_number: load.reference_number,
            updated_fields: Object.keys(containerUpdates),
            updated_by: user.email,
          },
        })
      }

      return NextResponse.json(load)
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // Add updated_at timestamp
    allowedUpdates.updated_at = new Date().toISOString()

    // Update load (with graceful fallback on select)
    const { data: load, error: updateError } = await selectLoadAfterUpdate(supabase, id, allowedUpdates)

    if (updateError || !load) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update load" },
        { status: 500 }
      )
    }

    // Log activity for staff updates
    if (isStaff) {
      const adminSupabase = createAdminClient()
      await adminSupabase.from("activity_log").insert({
        entity_type: "load",
        entity_id: id,
        action: "updated",
        user_id: user.id,
        details: {
          reference_number: load.reference_number,
          updated_fields: Object.keys(allowedUpdates),
          updated_by: user.email,
        },
      })
    }

    return NextResponse.json(load)
  } catch (error) {
    console.error("Error updating load:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions — only admin/dispatcher can delete
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json(
        { error: "You don't have permission to delete loads" },
        { status: 403 }
      )
    }

    // Fetch the load first for the audit log
    const { data: load, error: fetchError } = await supabase
      .from("loads")
      .select("id, reference_number, status")
      .eq("id", id)
      .single()

    if (fetchError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Delete the load — use admin client to bypass RLS and ensure deletion succeeds
    const adminSupabaseForDelete = createAdminClient()
    const { data: deleteResult, error: deleteError } = await adminSupabaseForDelete
      .from("loads")
      .delete()
      .eq("id", id)
      .select("id")

    if (deleteError) {
      console.error("Delete error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete load" },
        { status: 500 }
      )
    }

    // Verify the row was actually deleted (RLS may silently block)
    if (!deleteResult || deleteResult.length === 0) {
      console.error("Delete returned 0 affected rows for load:", id)
      return NextResponse.json(
        { error: "Load could not be deleted — permission denied or not found" },
        { status: 403 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    const { error: auditError } = await adminSupabase.from("activity_log").insert({
      entity_type: "load",
      entity_id: id,
      action: "deleted",
      user_id: user.id,
      details: {
        reference_number: load.reference_number,
        deleted_by: user.email,
      },
    })
    if (auditError) console.error("Audit log insert error (delete):", auditError)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting load:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
