// app/api/drivers/[id]/route.ts
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

// Service role client bypasses RLS for admin mutations
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Check if user has permission (admin or dispatcher only)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get current driver
    const { data: currentDriver, error: fetchError } = await supabase
      .from("drivers")
      .select("id")
      .eq("id", id)
      .single()

    if (fetchError || !currentDriver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 })
    }

    // Get updates from request body
    const body = await request.json()

    // Only allow certain fields to be updated
    const allowedFields = [
      "name", "first_name", "last_name", "username", "email", "phone",
      "truck_number", "truck_owner", "plates",
      "license_number", "license_state", "license_expiry",
      "medical_expiry", "twic_expiry",
      "date_of_birth", "date_of_hire",
      "emergency_contact", "emergency_phone",
      "use_for_pre_appointments", "enabled",
      "status", "notes",
    ]

    const allowedUpdates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        allowedUpdates[field] = body[field]
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // Validate required fields if provided
    if (allowedUpdates.name === "" || allowedUpdates.phone === "") {
      return NextResponse.json(
        { error: "Name and phone cannot be empty" },
        { status: 400 }
      )
    }

    // Update driver - use service client to bypass RLS
    const { data: driver, error: updateError } = await serviceSupabase
      .from("drivers")
      .update(allowedUpdates)
      .eq("id", id)
      .select()
      .single()

    if (updateError || !driver) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update driver" },
        { status: 500 }
      )
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "driver",
        entity_id: id,
        action: "updated",
        user_id: user.id,
        details: {
          name: driver.name,
          fields_changed: Object.keys(allowedUpdates),
          updated_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ driver })
  } catch (error) {
    console.error("Error updating driver:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
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

    // Only admins can delete drivers
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete drivers" }, { status: 403 })
    }

    // Fetch driver name for audit trail before potential deletion
    const { data: driverRecord } = await supabase
      .from("drivers")
      .select("name")
      .eq("id", id)
      .single()

    // Check if driver has active shipments
    const { data: activeShipments } = await supabase
      .from("loads")
      .select("id")
      .eq("driver_id", id)
      .in("status", ["Assigned", "Dispatched", "In Transit"])

    if (activeShipments && activeShipments.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete driver with ${activeShipments.length} active shipment(s). Reassign or complete them first.` },
        { status: 400 }
      )
    }

    // Unlink completed shipments (set driver_id to null) so we don't lose shipment records
    await serviceSupabase
      .from("loads")
      .update({ driver_id: null })
      .eq("driver_id", id)

    // Delete the driver - use service client to bypass RLS
    const { error: deleteError } = await serviceSupabase
      .from("drivers")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Delete error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete driver" },
        { status: 500 }
      )
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "driver",
        entity_id: id,
        action: "deleted",
        user_id: user.id,
        details: {
          name: driverRecord?.name || "Unknown",
          deleted_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting driver:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
