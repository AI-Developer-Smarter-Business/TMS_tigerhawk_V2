// app/api/trucks/[id]/route.ts
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("user_profiles").select("role").eq("id", user.id).single()
    if (!profile || !["admin", "dispatcher"].includes(profile.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const allowedFields = [
      "truck_number", "truck_owner", "license_plate", "license_plate_state", "vin",
      "address", "registration_expiry", "inspection_expiry", "annual_inspection_expiry",
      "insurance_expiry", "engine_family", "has_sleeper", "use_for_pre_appointments",
      "enabled", "status", "notes",
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })

    const { data: truck, error } = await serviceSupabase
      .from("trucks").update(updates).eq("id", id).select().single()

    if (error) {
      console.error("Update truck error:", error)
      return NextResponse.json({ error: error.message || "Failed to update truck" }, { status: 500 })
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "truck",
        entity_id: id,
        action: "updated",
        user_id: user.id,
        details: {
          truck_number: truck.truck_number,
          fields_changed: Object.keys(updates),
          updated_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ truck })
  } catch (error) {
    console.error("Error updating truck:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("user_profiles").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "admin")
      return NextResponse.json({ error: "Only admins can delete trucks" }, { status: 403 })

    // Fetch truck info for audit trail before deletion
    const { data: truckRecord } = await supabase
      .from("trucks").select("truck_number").eq("id", id).single()

    const { error } = await serviceSupabase.from("trucks").delete().eq("id", id)
    if (error) {
      console.error("Delete truck error:", error)
      return NextResponse.json({ error: "Failed to delete truck" }, { status: 500 })
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "truck",
        entity_id: id,
        action: "deleted",
        user_id: user.id,
        details: {
          truck_number: truckRecord?.truck_number || "Unknown",
          deleted_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting truck:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
