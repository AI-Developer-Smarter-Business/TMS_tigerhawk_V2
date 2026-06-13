// app/api/dispatcher/loads/[id]/assign-driver/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { assignDriverSchema } from "@/lib/validations/schemas"
import { validateBody } from "@/lib/validations/validate"
import { getActiveHoldKeys, type LoadHoldSnapshot } from "@/lib/loadHolds"

export async function POST(
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

    // Check if user has permission (admin or dispatcher only)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get driver_id from request body
    const body = await request.json()

    const result = validateBody(body, assignDriverSchema)
    if (!result.success) return result.response
    const { driver_id } = result.data

    // Check if driver exists and is available
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, name, status")
      .eq("id", driver_id)
      .single()

    if (driverError || !driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 })
    }

    // Allow reassignment even if driver is "On Job" — dispatcher may need to
    // move drivers between loads. Only block if driver is truly unavailable.
    if (driver.status === "Inactive" || driver.status === "Terminated") {
      return NextResponse.json(
        { error: `Driver is currently ${driver.status} and cannot be assigned` },
        { status: 400 }
      )
    }

    // Get current load (holds needed for same policy as PATCH …/status — Tarea 5 / 14)
    const { data: currentLoad, error: fetchError } = await supabase
      .from("loads")
      .select(
        "id, status, driver_id, freight_hold, customs_hold, terminal_hold, fees_hold, other_hold, carrier_hold"
      )
      .eq("id", id)
      .single()

    if (fetchError || !currentLoad) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    const activeHolds = getActiveHoldKeys(currentLoad as LoadHoldSnapshot)
    if (activeHolds.length > 0 && profile.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Cannot assign a driver while active holds are set. Release or clear holds first.",
          code: "ACTIVE_HOLDS",
          activeHolds,
        },
        { status: 403 }
      )
    }

    // Release the old driver if load is being reassigned
    if (currentLoad.driver_id && currentLoad.driver_id !== driver_id) {
      const adminSupabaseOld = createAdminClient()
      // Only set old driver to Available if they have no other active loads
      const { count: otherActiveLoads } = await adminSupabaseOld
        .from("loads")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", currentLoad.driver_id)
        .neq("id", id)
        .in("status", ["Assigned", "Dispatched", "In Transit", "Arrived At Pickup", "Arrived At Delivery"])

      if (!otherActiveLoads || otherActiveLoads === 0) {
        await adminSupabaseOld
          .from("drivers")
          .update({ status: "Available" })
          .eq("id", currentLoad.driver_id)
      }
    }

    // Update load with driver — only change status to "Assigned" if load
    // is still in an early state. For reassignment during transit or later
    // stages, keep the current status.
    const earlyStatuses = ["Pending", "Available", "Assigned"]
    const newStatus = earlyStatuses.includes(currentLoad.status)
      ? "Assigned"
      : currentLoad.status

    const { data: load, error: loadError } = await supabase
      .from("loads")
      .update({
        driver_id,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        customers ( id, name, email, phone, address, city, state, zip_code ),
        containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state ),
        drivers ( id, name, phone, status )
      `)
      .single()

    if (loadError || !load) {
      console.error("Load update error:", loadError)
      return NextResponse.json(
        { error: "Failed to assign driver to load" },
        { status: 500 }
      )
    }

    // Update driver status to "On Job"
    const adminSupabase = createAdminClient()
    const { error: updateDriverError } = await adminSupabase
      .from("drivers")
      .update({ status: "On Job" })
      .eq("id", driver_id)

    if (updateDriverError) {
      console.error("Failed to update driver status:", updateDriverError)
    }

    // Log to both audit systems
    // 1. Global activity_log
    await adminSupabase.from("activity_log").insert({
      entity_type: "load",
      entity_id: id,
      action: "driver_assigned",
      user_id: user.id,
      details: {
        reference_number: load.reference_number,
        driver_id: driver_id,
        driver_name: driver.name,
        previous_driver_id: currentLoad.driver_id || null,
        assigned_by: user.email,
      },
    })

    // 2. Load-specific audit log (load detail AuditTab)
    // Fetch old driver name for the audit trail
    let oldDriverName = "—"
    if (currentLoad.driver_id) {
      const { data: oldDriver } = await adminSupabase
        .from("drivers")
        .select("name")
        .eq("id", currentLoad.driver_id)
        .single()
      oldDriverName = oldDriver?.name || currentLoad.driver_id
    }

    await adminSupabase.from("load_audit_log").insert({
      load_id: id,
      user_id: user.id,
      user_name: user.email,
      field_changed: "driver",
      old_value: currentLoad.driver_id ? oldDriverName : null,
      new_value: driver.name,
      changed_at: new Date().toISOString(),
    }).then(({ error: auditErr }) => {
      if (auditErr) console.error("Failed to write load_audit_log for driver assignment:", auditErr)
    })

    return NextResponse.json(load)
  } catch (error) {
    console.error("Error assigning driver:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
