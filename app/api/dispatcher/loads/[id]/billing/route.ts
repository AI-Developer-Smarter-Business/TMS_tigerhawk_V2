// app/api/dispatcher/loads/[id]/billing/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { createBillingSchema, updateBillingSchema } from "@/lib/validations/schemas"
import { validateBody } from "@/lib/validations/validate"

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

    // Verify load exists
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id")
      .eq("id", id)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Fetch billing charges
    const { data: charges, error: chargesError } = await supabase
      .from("load_billing")
      .select("*")
      .eq("load_id", id)
      .order("created_at", { ascending: false })

    if (chargesError) {
      console.error("Charges fetch error:", chargesError)
      return NextResponse.json(
        { error: chargesError.message || "Failed to fetch billing charges" },
        { status: 500 }
      )
    }

    // Calculate totals
    const totalCharges = charges.reduce((sum, charge) => sum + (charge.amount || 0), 0)

    return NextResponse.json({
      data: charges,
      summary: {
        totalCharges,
        chargeCount: charges.length,
      },
    })
  } catch (error) {
    console.error("Error fetching billing charges:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

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

    // Check permission - staff only
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify load exists
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id, reference_number")
      .eq("id", id)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    const body = await request.json()

    const result = validateBody(body, createBillingSchema)
    if (!result.success) return result.response
    const { charge_type, amount, description } = result.data

    // Create billing charge record
    const { data: charge, error: insertError } = await supabase
      .from("load_billing")
      .insert({
        load_id: id,
        charge_type,
        description: description || null,
        amount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("Billing insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to add billing charge" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "load_billing",
      entity_id: charge.id,
      action: "created",
      user_id: user.id,
      details: {
        load_id: id,
        load_reference: load.reference_number,
        charge_type,
        amount,
        created_by: user.email,
      },
    })

    return NextResponse.json(charge, { status: 201 })
  } catch (error) {
    console.error("Error adding billing charge:", error)
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

    // Check permission - staff only
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    const result = validateBody(body, updateBillingSchema)
    if (!result.success) return result.response
    const { charge_id, charge_type, amount, description } = result.data

    // Verify charge exists
    const { data: charge, error: chargeError } = await supabase
      .from("load_billing")
      .select("id, load_id")
      .eq("id", charge_id)
      .single()

    if (chargeError || !charge) {
      return NextResponse.json({ error: "Billing charge not found" }, { status: 404 })
    }

    // Verify load exists
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id, reference_number")
      .eq("id", id)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Build updates
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (charge_type !== undefined) updates.charge_type = charge_type
    if (description !== undefined) updates.description = description
    if (amount !== undefined) updates.amount = amount

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Update charge
    const { data: updatedCharge, error: updateError } = await supabase
      .from("load_billing")
      .update(updates)
      .eq("id", charge_id)
      .select()
      .single()

    if (updateError || !updatedCharge) {
      console.error("Billing update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update billing charge" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "load_billing",
      entity_id: charge_id,
      action: "updated",
      user_id: user.id,
      details: {
        load_id: id,
        load_reference: load.reference_number,
        updated_fields: Object.keys(updates).filter(k => k !== "updated_at"),
        updated_by: user.email,
      },
    })

    return NextResponse.json(updatedCharge)
  } catch (error) {
    console.error("Error updating billing charge:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
