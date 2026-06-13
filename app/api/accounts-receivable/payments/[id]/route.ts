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

    // Fetch payment with applications
    const { data: payment, error } = await supabase
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
        customers!inner(id, name, email),
        ar_payment_applications(
          id,
          invoice_id,
          amount,
          created_at,
          ar_invoices(id, invoice_number, amount, amount_paid)
        )
      `)
      .eq("id", id)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    return NextResponse.json({ data: payment })
  } catch (error) {
    console.error("Error fetching payment:", error)
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

    // Check permission - accounting staff only
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "accounting"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify payment exists and get its applications
    const { data: payment, error: paymentError } = await supabase
      .from("ar_payments")
      .select("id, customer_id, ar_payment_applications(id, invoice_id, amount)")
      .eq("id", id)
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // Reverse the applications - reduce amount_paid on invoices
    if (payment.ar_payment_applications && Array.isArray(payment.ar_payment_applications)) {
      for (const app of payment.ar_payment_applications) {
        // Get current invoice state
        const { data: invoice } = await supabase
          .from("ar_invoices")
          .select("amount_paid, amount")
          .eq("id", app.invoice_id)
          .single()

        if (invoice) {
          const newAmountPaid = Math.max(0, (invoice.amount_paid || 0) - (app.amount || 0))
          // When fully reversed, status should be "Invoiced" (not "Drafted")
          // since the invoice was previously sent/active before payment
          const newBillingStatus = newAmountPaid === 0 ? "Invoiced" : "Partial"

          // Update invoice
          await supabase
            .from("ar_invoices")
            .update({
              amount_paid: newAmountPaid,
              billing_status: newBillingStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", app.invoice_id)
        }

        // Delete application
        await supabase
          .from("ar_payment_applications")
          .delete()
          .eq("id", app.id)
      }
    }

    // Delete payment
    const { error: deleteError } = await supabase
      .from("ar_payments")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Payment delete error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete payment" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ar_payment",
      entity_id: id,
      action: "deleted",
      user_id: user.id,
      details: {
        customer_id: payment.customer_id,
        deleted_by: user.email,
      },
    })

    return NextResponse.json({ success: true, message: "Payment deleted and reversed successfully" })
  } catch (error) {
    console.error("Error deleting payment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
