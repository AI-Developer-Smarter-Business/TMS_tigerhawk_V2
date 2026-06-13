import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateBody } from "@/lib/validations/validate"
import { createARPaymentSchema } from "@/lib/validations/schemas"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const url = new URL(request.url)
    const customerId = url.searchParams.get("customer_id")
    const page = parseInt(url.searchParams.get("page") || "1", 10)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from("ar_payments")
      .select(`
        id,
        payment_number,
        customer_id,
        payment_date,
        payment_method,
        check_number,
        deposit_type,
        amount,
        note,
        document_url,
        created_at,
        updated_at,
        customers!inner(id, name),
        ar_payment_applications(
          id,
          invoice_id,
          amount,
          ar_invoices(id, invoice_number, amount)
        )
      `, { count: "exact" })

    // Apply filters
    if (customerId) {
      query = query.eq("customer_id", customerId)
    }

    const { data, error, count } = await query
      .order("payment_date", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Payments fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch payments" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data, total: count, page, limit })
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

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

    // Validate request body with Zod schema
    const validation = validateBody(body, createARPaymentSchema)
    if (!validation.success) {
      return validation.response
    }

    const data = validation.data
    const paymentAmount = Number(data.amount)

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", data.customer_id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // ─── Pre-validate all invoices BEFORE creating anything ─
    const invoiceIds = data.invoice_applications.map((a) => a.invoice_id)
    const { data: invoices, error: invoicesFetchError } = await supabase
      .from("ar_invoices")
      .select("id, amount, amount_paid, billing_status")
      .in("id", invoiceIds)

    if (invoicesFetchError) {
      return NextResponse.json({ error: "Failed to fetch invoices for validation" }, { status: 500 })
    }

    const invoiceMap = new Map((invoices || []).map(inv => [inv.id, inv]))

    for (const app of data.invoice_applications) {
      const invoice = invoiceMap.get(app.invoice_id)
      if (!invoice) {
        return NextResponse.json(
          { error: `Invoice ${app.invoice_id} not found` },
          { status: 404 }
        )
      }
      if (invoice.billing_status === "Voided") {
        return NextResponse.json(
          { error: `Cannot apply payment to voided invoice ${app.invoice_id}` },
          { status: 400 }
        )
      }
      if (invoice.billing_status === "Consolidated") {
        return NextResponse.json(
          {
            error: `Cannot apply payment to consolidated line invoice ${app.invoice_id} — use the batch parent invoice instead`,
          },
          { status: 400 }
        )
      }
      if (invoice.billing_status === "Paid") {
        return NextResponse.json(
          { error: `Invoice ${app.invoice_id} is already fully paid` },
          { status: 400 }
        )
      }

      const appliedAmount = Number(app.applied_amount)
      const outstanding = (invoice.amount || 0) - (invoice.amount_paid || 0)
      // Allow small float tolerance
      if (appliedAmount > outstanding + 0.01) {
        return NextResponse.json(
          {
            error: `Applied amount $${appliedAmount.toFixed(2)} exceeds outstanding balance $${outstanding.toFixed(2)} on invoice ${app.invoice_id}`,
          },
          { status: 400 }
        )
      }
    }

    // ─── All validation passed — create payment ─────────────
    const { data: payment, error: insertError } = await supabase
      .from("ar_payments")
      .insert({
        payment_number: data.payment_number || null,
        customer_id: data.customer_id,
        payment_date: data.payment_date || new Date().toISOString(),
        amount: paymentAmount,
        payment_method: data.payment_method || "Check",
        check_number: data.check_number || null,
        deposit_type: data.deposit_type || null,
        note: data.note || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Payment insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create payment" },
        { status: 500 }
      )
    }

    // ─── Create application records ─────────────────────────
    const applicationRecords = data.invoice_applications.map((app) => ({
      payment_id: payment.id,
      invoice_id: app.invoice_id,
      amount: Number(app.applied_amount),
    }))

    const { error: appError } = await supabase
      .from("ar_payment_applications")
      .insert(applicationRecords)

    if (appError) {
      console.error("Payment applications insert error:", appError)
      // Rollback payment
      await supabase.from("ar_payments").delete().eq("id", payment.id)
      return NextResponse.json(
        { error: "Failed to apply payment to invoices" },
        { status: 500 }
      )
    }

    // ─── Update invoice amounts ─────────────────────────────
    const invoiceUpdateErrors: string[] = []
    for (const app of data.invoice_applications) {
      const invoice = invoiceMap.get(app.invoice_id)!
      const appliedAmount = Number(app.applied_amount)
      const newAmountPaid = (invoice.amount_paid || 0) + appliedAmount

      let newStatus: string
      if (newAmountPaid >= invoice.amount) {
        newStatus = "Paid"
      } else if (newAmountPaid > 0) {
        newStatus = "Partial"
      } else {
        newStatus = invoice.billing_status
      }

      const { error: updateErr } = await supabase
        .from("ar_invoices")
        .update({
          amount_paid: newAmountPaid,
          billing_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", app.invoice_id)

      if (updateErr) {
        invoiceUpdateErrors.push(app.invoice_id)
        console.error(`Failed to update invoice ${app.invoice_id}:`, updateErr)
      }
    }

    if (invoiceUpdateErrors.length > 0) {
      console.error("Some invoice updates failed after payment applied:", invoiceUpdateErrors)
      // Payment and applications exist — problem-sync will catch the discrepancy
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ar_payment",
      entity_id: payment.id,
      action: "created",
      user_id: user.id,
      details: {
        customer_id: data.customer_id,
        customer_name: customer.name,
        amount: paymentAmount,
        invoices_applied: data.invoice_applications.length,
        created_by: user.email,
      },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("Error creating payment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
