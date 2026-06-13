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
    const customerId = url.searchParams.get("customer_id")

    // Build query - get unpaid or partially paid invoices
    let query = supabase
      .from("ar_invoices")
      .select(`
        id,
        invoice_number,
        customer_id,
        invoice_date,
        amount,
        amount_paid,
        billing_status,
        customers!inner(id, name)
      `)
      .not("billing_status", "in", '("Paid","Voided","Consolidated")')

    // Apply customer filter if provided
    if (customerId) {
      query = query.eq("customer_id", customerId)
    }

    const { data: invoices, error } = await query.order("invoice_date", { ascending: true })

    if (error) {
      console.error("Invoices fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch invoices" },
        { status: 500 }
      )
    }

    // Calculate aging buckets
    const today = new Date()
    const agingReport: Record<string, any> = {}

    // Initialize aging structure
    const agingBuckets = {
      "0-30": { count: 0, amount: 0 },
      "31-60": { count: 0, amount: 0 },
      "61-90": { count: 0, amount: 0 },
      "91-120": { count: 0, amount: 0 },
      "120+": { count: 0, amount: 0 },
    }

    // Process each invoice
    invoices?.forEach((invoice) => {
      const customerId = invoice.customer_id
      const customerName = (invoice.customers as any)?.name || "Unknown"

      // Initialize customer if not exists
      if (!agingReport[customerId]) {
        agingReport[customerId] = {
          customer_name: customerName,
          total_amount: 0,
          total_paid: 0,
          outstanding: 0,
          aging: { ...agingBuckets },
        }
      }

      // Calculate days since invoice
      const invoiceDate = new Date(invoice.invoice_date)
      const daysSinceInvoice = Math.floor(
        (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Calculate outstanding amount for this invoice
      const outstanding = Math.max(0, (invoice.amount || 0) - (invoice.amount_paid || 0))

      // Update customer totals
      agingReport[customerId].total_amount += invoice.amount || 0
      agingReport[customerId].total_paid += invoice.amount_paid || 0
      agingReport[customerId].outstanding += outstanding

      // Assign to aging bucket based on outstanding amount
      if (outstanding > 0) {
        if (daysSinceInvoice <= 30) {
          agingReport[customerId].aging["0-30"].count++
          agingReport[customerId].aging["0-30"].amount += outstanding
        } else if (daysSinceInvoice <= 60) {
          agingReport[customerId].aging["31-60"].count++
          agingReport[customerId].aging["31-60"].amount += outstanding
        } else if (daysSinceInvoice <= 90) {
          agingReport[customerId].aging["61-90"].count++
          agingReport[customerId].aging["61-90"].amount += outstanding
        } else if (daysSinceInvoice <= 120) {
          agingReport[customerId].aging["91-120"].count++
          agingReport[customerId].aging["91-120"].amount += outstanding
        } else {
          agingReport[customerId].aging["120+"].count++
          agingReport[customerId].aging["120+"].amount += outstanding
        }
      }
    })

    // Calculate grand totals
    const grandTotals = {
      total_amount: 0,
      total_paid: 0,
      outstanding: 0,
      aging: { ...agingBuckets },
    }

    Object.values(agingReport).forEach((customer: any) => {
      grandTotals.total_amount += customer.total_amount
      grandTotals.total_paid += customer.total_paid
      grandTotals.outstanding += customer.outstanding

      Object.keys(agingBuckets).forEach((bucket) => {
        ;(grandTotals.aging as any)[bucket].count += customer.aging[bucket].count
        ;(grandTotals.aging as any)[bucket].amount += customer.aging[bucket].amount
      })
    })

    return NextResponse.json({
      data: agingReport,
      summary: grandTotals,
      customer_count: Object.keys(agingReport).length,
    })
  } catch (error) {
    console.error("Error generating aging report:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
