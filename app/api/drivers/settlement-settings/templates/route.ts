import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { auditLog } from "@/lib/auditLog"

// GET: List all deduction templates
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from("deduction_templates")
      .select("*")
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("Templates fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ templates: data || [] })
  } catch (err) {
    console.error("Error fetching templates:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: Create a new deduction template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from("deduction_templates")
      .insert({
        name: body.name,
        description: body.description || null,
        deduction_type: body.deduction_type || "Fixed",
        math_operation: body.math_operation || "Subtract",
        frequency: body.frequency || "Weekly",
        default_amount: body.default_amount ?? 0,
        sort_order: body.sort_order ?? 99,
        enabled: body.enabled ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error("Template insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    auditLog({
      entity_type: "deduction_template",
      entity_id: data.id,
      action: "created",
      user_id: user.id,
      details: { name: data.name, changed_by: user.email },
    })

    return NextResponse.json({ template: data }, { status: 201 })
  } catch (err) {
    console.error("Error creating template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH: Update a template
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.deduction_type !== undefined) updates.deduction_type = body.deduction_type
    if (body.math_operation !== undefined) updates.math_operation = body.math_operation
    if (body.frequency !== undefined) updates.frequency = body.frequency
    if (body.default_amount !== undefined) updates.default_amount = body.default_amount
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order
    if (body.enabled !== undefined) updates.enabled = body.enabled

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from("deduction_templates")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single()

    if (error) {
      console.error("Template update error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    auditLog({
      entity_type: "deduction_template",
      entity_id: data.id,
      action: "updated",
      user_id: user.id,
      details: { changed_by: user.email, fields: Object.keys(updates).filter(k => k !== "updated_at") },
    })

    return NextResponse.json({ template: data })
  } catch (err) {
    console.error("Error updating template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Remove a template
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const adminSupabase = createAdminClient()
    const { error } = await adminSupabase
      .from("deduction_templates")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("Template delete error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    auditLog({
      entity_type: "deduction_template",
      entity_id: id,
      action: "deleted",
      user_id: user.id,
      details: { changed_by: user.email },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error deleting template:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
