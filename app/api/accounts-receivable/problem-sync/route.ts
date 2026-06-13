import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
    const syncType = url.searchParams.get("type") // credit_memos, payments, customers

    const issues: Record<string, unknown>[] = []

    // Check for credit memo sync issues
    if (!syncType || syncType === "credit_memos") {
      const { data: creditMemos, error: creditsError } = await supabase
        .from("ar_credit_memos")
        .select(`
          id,
          invoice_id,
          credit_number,
          amount,
          status,
          created_at,
          ar_invoices(id, invoice_number, customer_id, amount)
        `)

      if (!creditsError && creditMemos) {
        for (const memo of creditMemos) {
          // Check if memo amount exceeds invoice amount
          const inv = memo.ar_invoices as any
          if (inv && memo.amount > (inv.amount || 0)) {
            issues.push({
              type: "credit_memo",
              id: memo.id,
              issue: "Credit memo amount exceeds invoice amount",
              credit_number: memo.credit_number,
              invoice_number: inv.invoice_number,
              memo_amount: memo.amount,
              invoice_amount: inv.amount,
              status: memo.status,
            })
          }
        }
      }
    }

    // Check for payment application sync issues
    if (!syncType || syncType === "payments") {
      const { data: payments, error: paymentsError } = await supabase
        .from("ar_payments")
        .select(`
          id,
          customer_id,
          amount,
          ar_payment_applications(
            id,
            invoice_id,
            amount
          )
        `)

      if (!paymentsError && payments) {
        for (const payment of payments) {
          let totalApplied = 0
          if (payment.ar_payment_applications && Array.isArray(payment.ar_payment_applications)) {
            totalApplied = payment.ar_payment_applications.reduce(
              (sum: number, app: any) => sum + (app.amount || 0),
              0
            )
          }

          // Check if applied amount differs from payment total
          if (totalApplied !== payment.amount) {
            issues.push({
              type: "payment",
              id: payment.id,
              issue: "Payment total does not match applied amounts",
              payment_total: payment.amount,
              applied_total: totalApplied,
              difference: (payment.amount || 0) - totalApplied,
            })
          }
        }
      }
    }

    // Check for customer data sync issues
    if (!syncType || syncType === "customers") {
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select(`
          id,
          name,
          email
        `)

      if (!customersError && customers) {
        // For each customer without email, check if they have invoices
        for (const customer of customers) {
          if (!customer.email) {
            const { count } = await supabase
              .from("ar_invoices")
              .select("id", { count: "exact", head: true })
              .eq("customer_id", customer.id)
            if (count && count > 0) {
              issues.push({
                type: "customer",
                id: customer.id,
                issue: "Customer with invoices has no email address",
                name: customer.name,
                invoice_count: count,
              })
            }
          }
        }
      }
    }

    // Check for invoice aging sync issues
    if (!syncType) {
      const { data: invoices, error: invoicesError } = await supabase
        .from("ar_invoices")
        .select(`
          id,
          invoice_number,
          amount,
          amount_paid,
          billing_status,
          due_date
        `)

      if (!invoicesError && invoices) {
        const today = new Date()
        for (const invoice of invoices) {
          // Check for discrepancies
          const outstanding = (invoice.amount || 0) - (invoice.amount_paid || 0)

          // Verify billing status matches amounts
          const isPaid = Math.abs(outstanding) < 0.01
          const isPartial = outstanding > 0 && (invoice.amount_paid || 0) > 0

          if (isPaid && invoice.billing_status !== "Paid") {
            issues.push({
              type: "invoice",
              id: invoice.id,
              issue: "Invoice marked as unpaid but appears to be fully paid",
              invoice_number: invoice.invoice_number,
              expected_status: "Paid",
              actual_status: invoice.billing_status,
              outstanding: outstanding,
            })
          }

          // Check for overdue invoices
          if (invoice.due_date) {
            const dueDate = new Date(invoice.due_date)
            const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

            if (daysOverdue > 0 && outstanding > 0) {
              issues.push({
                type: "overdue_invoice",
                id: invoice.id,
                issue: "Invoice is overdue",
                invoice_number: invoice.invoice_number,
                days_overdue: daysOverdue,
                outstanding_amount: outstanding,
              })
            }
          }
        }
      }
    }

    return NextResponse.json({
      data: issues,
      summary: {
        total_issues: issues.length,
        by_type: issues.reduce((acc: Record<string, number>, issue: any) => {
          acc[issue.type] = (acc[issue.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },
    })
  } catch (error) {
    console.error("Error checking sync issues:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
