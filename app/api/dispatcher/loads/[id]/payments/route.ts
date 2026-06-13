// app/api/dispatcher/loads/[id]/payments/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { createLoadPaymentSchema } from "@/lib/validations/schemas"
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

    // Fetch payments
    const { data: payments, error: paymentsError } = await supabase
      .from("load_payments")
      .select("*")
      .eq("load_id", id)
      .order("created_at", { ascending: false })

    if (paymentsError) {
      console.error("Payments fetch error:", paymentsError)
      return NextResponse.json(
        { error: paymentsError.message || "Failed to fetch payments" },
        { status: 500 }
      )
    }

    // Calculate totals
    const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)

    return NextResponse.json({
      data: payments,
      summary: {
        totalPaid,
        paymentCount: payments.length,
      },
    })
  } catch (error) {
    console.error("Error fetching payments:", error)
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

    const result = validateBody(body, createLoadPaymentSchema)
    if (!result.success) return result.response
    const { payment_type, amount, reference, paid_at } = result.data

    // Create payment record
    const { data: payment, error: insertError } = await supabase
      .from("load_payments")
      .insert({
        load_id: id,
        payment_type,
        amount,
        reference: reference || null,
        paid_at: paid_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("Payment insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to add payment" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "load_payment",
      entity_id: payment.id,
      action: "created",
      user_id: user.id,
      details: {
        load_id: id,
        load_reference: load.reference_number,
        payment_type,
        amount,
        created_by: user.email,
      },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("Error adding payment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
