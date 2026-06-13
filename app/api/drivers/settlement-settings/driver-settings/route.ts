import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/auditLog"

// GET: Fetch all driver deduction settings (optionally filter by driver_id or template_id)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const driverId = url.searchParams.get("driver_id")
    const templateId = url.searchParams.get("template_id")

    const adminSupabase = createAdminClient()
    let query = adminSupabase
      .from("driver_deduction_settings")
      .select("*")

    if (driverId) query = query.eq("driver_id", driverId)
    if (templateId) query = query.eq("template_id", templateId)

    const { data, error } = await query.order("created_at", { ascending: true })

    if (error) {
      console.error("Driver settings fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data || [] })
  } catch (err) {
    console.error("Error fetching driver settings:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT: Upsert a single driver×template setting
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    if (!body.driver_id || !body.template_id) {
      return NextResponse.json({ error: "driver_id and template_id are required" }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const upsertData: Record<string, unknown> = {
      driver_id: body.driver_id,
      template_id: body.template_id,
      updated_at: new Date().toISOString(),
    }
    if (body.amount !== undefined) upsertData.amount = Number(body.amount)
    if (body.enabled !== undefined) upsertData.enabled = body.enabled
    if (body.limit_total !== undefined) upsertData.limit_total = body.limit_total
    if (body.limit_per_period !== undefined) upsertData.limit_per_period = body.limit_per_period
    if (body.total_deducted !== undefined) upsertData.total_deducted = body.total_deducted
    if (body.start_date !== undefined) upsertData.start_date = body.start_date
    if (body.end_date !== undefined) upsertData.end_date = body.end_date
    if (body.notes !== undefined) upsertData.notes = body.notes

    const { data, error } = await adminSupabase
      .from("driver_deduction_settings")
      .upsert(upsertData, { onConflict: "driver_id,template_id" })
      .select()
      .single()

    if (error) {
      console.error("Driver setting upsert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    auditLog({
      entity_type: "driver_deduction_setting",
      entity_id: data.id,
      action: "updated",
      user_id: user.id,
      details: { driver_id: body.driver_id, template_id: body.template_id, changed_by: user.email },
    })

    return NextResponse.json({ setting: data })
  } catch (err) {
    console.error("Error upserting driver setting:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Bulk upsert - apply a template to multiple drivers at once
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()

    // Expect: { settings: [{ driver_id, template_id, amount, enabled, ... }] }
    if (!Array.isArray(body.settings) || body.settings.length === 0) {
      return NextResponse.json({ error: "settings array is required" }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const upsertRows = body.settings.map((s: Record<string, unknown>) => ({
      driver_id: s.driver_id,
      template_id: s.template_id,
      amount: s.amount !== undefined ? Number(s.amount) : 0,
      enabled: s.enabled !== undefined ? s.enabled : true,
      limit_total: s.limit_total ?? null,
      limit_per_period: s.limit_per_period ?? null,
      start_date: s.start_date ?? null,
      end_date: s.end_date ?? null,
      notes: s.notes ?? null,
      updated_at: new Date().toISOString(),
    }))

    const { data, error } = await adminSupabase
      .from("driver_deduction_settings")
      .upsert(upsertRows, { onConflict: "driver_id,template_id" })
      .select()

    if (error) {
      console.error("Bulk upsert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (data && data.length > 0) {
      auditLog({
        entity_type: "driver_deduction_setting",
        entity_id: "bulk_upsert",
        action: "updated",
        user_id: user.id,
        details: { count: data.length, changed_by: user.email },
      })
    }

    return NextResponse.json({ settings: data || [], count: data?.length || 0 })
  } catch (err) {
    console.error("Error bulk upserting settings:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Remove a driver deduction setting
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    // Also support bulk delete by driver_id + template_id
    const driverId = url.searchParams.get("driver_id")
    const templateId = url.searchParams.get("template_id")

    const adminSupabase = createAdminClient()

    if (id) {
      const { error } = await adminSupabase
        .from("driver_deduction_settings")
        .delete()
        .eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      auditLog({
        entity_type: "driver_deduction_setting",
        entity_id: id,
        action: "deleted",
        user_id: user.id,
        details: { changed_by: user.email },
      })
    } else if (driverId && templateId) {
      const { error } = await adminSupabase
        .from("driver_deduction_settings")
        .delete()
        .eq("driver_id", driverId)
        .eq("template_id", templateId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      auditLog({
        entity_type: "driver_deduction_setting",
        entity_id: "bulk_delete",
        action: "deleted",
        user_id: user.id,
        details: { driver_id: driverId, template_id: templateId, changed_by: user.email },
      })
    } else {
      return NextResponse.json({ error: "id or (driver_id + template_id) required" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error deleting driver setting:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
