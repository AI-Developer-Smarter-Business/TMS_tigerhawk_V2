import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/auditLog"

// GET: Fetch settlement config
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from("settlement_config")
      .select("*")
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("Settlement config fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If no config exists, return defaults
    const config = data || {
      id: null,
      period_type: "Weekly",
      start_day: "Saturday",
      auto_settle: false,
      driver_notifications: false,
    }

    return NextResponse.json({ config })
  } catch (err) {
    console.error("Error fetching settlement config:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH: Update settlement config
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()

    // Validate period_type
    if (body.period_type !== undefined) {
      const validPeriodTypes = ["Daily", "Weekly", "Bi-Weekly", "Monthly"]
      if (!validPeriodTypes.includes(body.period_type)) {
        return NextResponse.json(
          { error: `Invalid period_type. Must be one of: ${validPeriodTypes.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Validate start_day
    if (body.start_day !== undefined) {
      const validDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      if (!validDays.includes(body.start_day)) {
        return NextResponse.json(
          { error: `Invalid start_day. Must be one of: ${validDays.join(", ")}` },
          { status: 400 }
        )
      }
    }

    const adminSupabase = createAdminClient()

    // First, try to fetch existing config
    const { data: existing, error: fetchError } = await adminSupabase
      .from("settlement_config")
      .select("id")
      .single()

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching existing config:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.period_type !== undefined) updates.period_type = body.period_type
    if (body.start_day !== undefined) updates.start_day = body.start_day
    if (body.auto_settle !== undefined) updates.auto_settle = body.auto_settle
    if (body.driver_notifications !== undefined) updates.driver_notifications = body.driver_notifications

    let data, error
    let isCreate = false

    if (existing && existing.id) {
      // Update existing row
      const result = await adminSupabase
        .from("settlement_config")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      // Insert new row
      const result = await adminSupabase
        .from("settlement_config")
        .insert({
          period_type: body.period_type || "Weekly",
          start_day: body.start_day || "Saturday",
          auto_settle: body.auto_settle ?? false,
          driver_notifications: body.driver_notifications ?? false,
        })
        .select()
        .single()
      data = result.data
      error = result.error
      isCreate = true
    }

    if (error) {
      console.error("Settlement config update error:", error)
      return NextResponse.json({ error: error.message, detail: error.details, hint: error.hint }, { status: 500 })
    }

    auditLog({
      entity_type: "settlement_config",
      entity_id: data.id,
      action: isCreate ? "created" : "updated",
      user_id: user.id,
      details: { changed_by: user.email, fields: Object.keys(updates).filter(k => k !== "updated_at") },
    })

    return NextResponse.json({ config: data })
  } catch (err) {
    console.error("Error updating settlement config:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
