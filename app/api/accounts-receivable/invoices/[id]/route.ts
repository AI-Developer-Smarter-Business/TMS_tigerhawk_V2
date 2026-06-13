import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

    // Fetch invoice with related data
    const { data: invoice, error } = await supabase
      .from("ar_invoices")
      .select(`
        id,
        invoice_number,
        customer_id,
        load_id,
        invoice_date,
        due_date,
        amount,
        amount_paid,
        billing_status,
        created_at,
        updated_at,
        customers!inner(id, name, email),
        loads(id, reference_number, status)
      `)
      .eq("id", id)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Fetch related payments
    const { data: payments, error: paymentsError } = await supabase
      .from("ar_payment_applications")
      .select(`
        id,
        payment_id,
        invoice_id,
        applied_amount,
        created_at,
        ar_payments(id, payment_date, total_amount, payment_method)
      `)
      .eq("invoice_id", id)
      .order("created_at", { ascending: false })

    if (paymentsError) {
      console.error("Payments fetch error:", paymentsError)
    }

    return NextResponse.json({
      data: invoice,
      payments: payments || [],
      outstanding_amount: Math.max(0, (invoice.amount || 0) - (invoice.amount_paid || 0)),
    })
  } catch (error) {
    console.error("Error fetching invoice:", error)
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

    // Check permission - accounting staff only
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "accounting"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    // Verify invoice exists
    const { data: invoice, error: invoiceError } = await supabase
      .from("ar_invoices")
      .select("id, invoice_number, customer_id, amount, amount_paid, billing_status")
      .eq("id", id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // ─── Validation guards ──────────────────────────────────
    // Prevent direct manipulation of amount_paid (should only change via payments)
    if (body.amount_paid !== undefined) {
      return NextResponse.json(
        { error: "amount_paid cannot be updated directly — use the payments API to apply or reverse payments" },
        { status: 400 }
      )
    }

    // Validate amount if being changed
    if (body.amount !== undefined) {
      const newAmount = Number(body.amount)
      if (isNaN(newAmount) || newAmount <= 0) {
        return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 })
      }
      // Prevent reducing amount below what's already paid
      if (newAmount < (invoice.amount_paid || 0)) {
        return NextResponse.json(
          { error: `Cannot reduce amount below amount already paid ($${(invoice.amount_paid || 0).toFixed(2)})` },
          { status: 400 }
        )
      }
    }

    // Prevent editing voided invoices
    if (invoice.billing_status === "Voided" && body.billing_status !== "Voided") {
      return NextResponse.json(
        { error: "Cannot modify a voided invoice" },
        { status: 400 }
      )
    }

    // Build updates
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.billing_status !== undefined) updates.billing_status = body.billing_status
    if (body.amount !== undefined) updates.amount = Number(body.amount)
    if (body.due_date !== undefined) updates.due_date = body.due_date

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Update invoice
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("ar_invoices")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError || !updatedInvoice) {
      console.error("Invoice update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ar_invoice",
      entity_id: id,
      action: "updated",
      user_id: user.id,
      details: {
        invoice_number: invoice.invoice_number,
        updated_fields: Object.keys(updates).filter(k => k !== "updated_at"),
        updated_by: user.email,
      },
    })

    return NextResponse.json(updatedInvoice)
  } catch (error) {
    console.error("Error updating invoice:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Check permission - admin only for delete
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify invoice exists with payment info
    const { data: invoice, error: invoiceError } = await supabase
      .from("ar_invoices")
      .select("id, invoice_number, amount_paid, billing_status")
      .eq("id", id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Already voided
    if (invoice.billing_status === "Voided") {
      return NextResponse.json({ error: "Invoice is already voided" }, { status: 400 })
    }

    // ─── Guard: prevent voiding invoices with payments ──────
    if ((invoice.amount_paid || 0) > 0) {
      const { count } = await supabase
        .from("ar_payment_applications")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", id)

      if (count && count > 0) {
        return NextResponse.json(
          {
            error: `Cannot void invoice ${invoice.invoice_number} — it has ${count} payment application(s) totaling $${(invoice.amount_paid || 0).toFixed(2)}. Reverse the payments first.`,
          },
          { status: 400 }
        )
      }
    }

    // Soft delete - mark as voided
    const { error: updateError } = await supabase
      .from("ar_invoices")
      .update({
        billing_status: "Voided",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      console.error("Invoice delete error:", updateError)
      return NextResponse.json(
        { error: "Failed to delete invoice" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ar_invoice",
      entity_id: id,
      action: "voided",
      user_id: user.id,
      details: {
        invoice_number: invoice.invoice_number,
        voided_by: user.email,
      },
    })

    return NextResponse.json({ success: true, message: "Invoice voided successfully" })
  } catch (error) {
    console.error("Error deleting invoice:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
