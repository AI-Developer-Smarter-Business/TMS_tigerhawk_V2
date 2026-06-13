import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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
    const status = url.searchParams.get("status")
    const billingStatus = url.searchParams.get("billing_status")

    // Build query
    let query = supabase
      .from("ar_invoices")
      .select(`
        id,
        invoice_number,
        customer_id,
        load_id,
        invoice_date,
        due_date,
        amount,
        billing_status,
        created_at,
        updated_at,
        loads!inner(id, reference_number, status),
        customers!inner(id, name)
      `)

    // Apply filters
    if (status) {
      query = query.eq("loads.status", status)
    }

    if (billingStatus) {
      query = query.eq("billing_status", billingStatus)
    }

    const { data, error } = await query.order("invoice_date", { ascending: false })

    if (error) {
      console.error("Billing data fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch billing data" },
        { status: 500 }
      )
    }

    // Calculate summary
    const summary = {
      total_invoices: data.length,
      total_amount: data.reduce((sum, inv) => sum + (inv.amount || 0), 0),
      by_status: {} as Record<string, { count: number; amount: number }>,
      by_billing_status: {} as Record<string, { count: number; amount: number }>,
    }

    data.forEach((inv) => {
      // By load status
      const loadStatus = (inv.loads as any)?.status || "Unknown"
      if (!summary.by_status[loadStatus]) {
        summary.by_status[loadStatus] = { count: 0, amount: 0 }
      }
      summary.by_status[loadStatus].count++
      summary.by_status[loadStatus].amount += inv.amount || 0

      // By billing status
      const billingStatus = inv.billing_status || "Unknown"
      if (!summary.by_billing_status[billingStatus]) {
        summary.by_billing_status[billingStatus] = { count: 0, amount: 0 }
      }
      summary.by_billing_status[billingStatus].count++
      summary.by_billing_status[billingStatus].amount += inv.amount || 0
    })

    return NextResponse.json({ data, summary })
  } catch (error) {
    console.error("Error fetching billing data:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
