// app/api/chassis/[id]/route.ts
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
      "chassis_number", "chassis_owner", "chassis_size", "chassis_type",
      "license_number", "license_state", "address", "vin",
      "registration_expiry", "inspection_expiry",
      "insurance_expiry", "enabled", "status", "notes",
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })

    const { data: chassis, error } = await serviceSupabase
      .from("chassis").update(updates).eq("id", id).select().single()

    if (error) {
      console.error("Update chassis error:", error)
      return NextResponse.json({ error: error.message || "Failed to update chassis" }, { status: 500 })
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "chassis",
        entity_id: id,
        action: "updated",
        user_id: user.id,
        details: {
          chassis_number: chassis.chassis_number,
          fields_changed: Object.keys(updates),
          updated_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ chassis })
  } catch (error) {
    console.error("Error updating chassis:", error)
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
      return NextResponse.json({ error: "Only admins can delete chassis" }, { status: 403 })

    // Fetch chassis info for audit trail before deletion
    const { data: chassisRecord } = await supabase
      .from("chassis").select("chassis_number").eq("id", id).single()

    const { error } = await serviceSupabase.from("chassis").delete().eq("id", id)
    if (error) {
      console.error("Delete chassis error:", error)
      return NextResponse.json({ error: "Failed to delete chassis" }, { status: 500 })
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "chassis",
        entity_id: id,
        action: "deleted",
        user_id: user.id,
        details: {
          chassis_number: chassisRecord?.chassis_number || "Unknown",
          deleted_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting chassis:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
