// app/api/dispatcher/loads/[id]/freight/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { auditLog } from "@/lib/auditLog"
import { updateFreightSchema } from "@/lib/validations/schemas"
import { validateBody } from "@/lib/validations/validate"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from("freight_descriptions")
      .select("*")
      .eq("load_id", id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching freight descriptions:", error)
      return NextResponse.json({ error: "Failed to fetch freight descriptions" }, { status: 500 })
    }

    return NextResponse.json({ freight: rows || [] })
  } catch (error) {
    console.error("Error in freight GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isStaff = profile && ["admin", "dispatcher"].includes(profile.role)
    if (!isStaff) {
      // Check if assigned driver
      const { data: load } = await supabase
        .from("loads")
        .select("driver_id")
        .eq("id", id)
        .single()
      if (!load || load.driver_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const body = await request.json()

    const result = validateBody(body, updateFreightSchema)
    if (!result.success) return result.response
    const rows = result.data.freight

    const adminSupabase = createAdminClient()

    // Delete existing freight descriptions for this load
    await adminSupabase
      .from("freight_descriptions")
      .delete()
      .eq("load_id", id)

    // Insert new rows (if any non-empty rows)
    const toInsert = rows
      .filter(r => r.commodity || r.description || r.pieces || r.weight_lbs || r.weight_kgs || r.pallets)
      .map(r => ({
        load_id: id,
        commodity: r.commodity || null,
        description: r.description || null,
        pieces: r.pieces || null,
        weight_lbs: r.weight_lbs || null,
        weight_kgs: r.weight_kgs || null,
        pallets: r.pallets || null,
      }))

    if (toInsert.length > 0) {
      const { error: insertError } = await adminSupabase
        .from("freight_descriptions")
        .insert(toInsert)

      if (insertError) {
        console.error("Error inserting freight descriptions:", insertError)
        return NextResponse.json({ error: "Failed to save freight descriptions" }, { status: 500 })
      }
    }

    // Fetch and return the updated rows
    const { data: updated } = await adminSupabase
      .from("freight_descriptions")
      .select("*")
      .eq("load_id", id)
      .order("created_at", { ascending: true })

    auditLog({
      entity_type: "load_freight",
      entity_id: id,
      action: "updated",
      user_id: user.id,
      details: { load_id: id, count: toInsert.length, changed_by: user.email },
    })

    return NextResponse.json({ freight: updated || [] })
  } catch (error) {
    console.error("Error in freight PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
