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
    const eventName = url.searchParams.get("event_name")
    const customerId = url.searchParams.get("customer_id")

    // Build query
    let query = supabase
      .from("waiting_time_events")
      .select(`
        id,
        load_id,
        event_name,
        event_date,
        duration_minutes,
        billable,
        rate_per_hour,
        charge_amount,
        notes,
        created_at,
        updated_at,
        loads!inner(
          id,
          reference_number,
          customer_id,
          status,
          customers(id, name)
        ),
        drivers(id, first_name, last_name)
      `)

    // Apply filters
    if (eventName) {
      query = query.eq("event_name", eventName)
    }

    if (customerId) {
      query = query.eq("loads.customer_id", customerId)
    }

    const { data, error } = await query.order("event_date", { ascending: false })

    if (error) {
      console.error("Waiting time events fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch waiting time events" },
        { status: 500 }
      )
    }

    // Calculate summary
    const summary = {
      total_events: data.length,
      total_duration_minutes: 0,
      total_billable_amount: 0,
      by_event_type: {} as Record<string, { count: number; duration: number; amount: number }>,
      by_customer: {} as Record<string, { count: number; duration: number; amount: number; customer_name: string }>,
    }

    data?.forEach((event) => {
      summary.total_duration_minutes += event.duration_minutes || 0
      if (event.billable) {
        summary.total_billable_amount += event.charge_amount || 0
      }

      // By event type
      const eventType = event.event_name || "Unknown"
      if (!summary.by_event_type[eventType]) {
        summary.by_event_type[eventType] = { count: 0, duration: 0, amount: 0 }
      }
      summary.by_event_type[eventType].count++
      summary.by_event_type[eventType].duration += event.duration_minutes || 0
      if (event.billable) {
        summary.by_event_type[eventType].amount += event.charge_amount || 0
      }

      // By customer
      const custId = (event.loads as any)?.customer_id
      const custName = (event.loads as any)?.customers?.name || "Unknown"
      if (custId && !summary.by_customer[custId]) {
        summary.by_customer[custId] = { count: 0, duration: 0, amount: 0, customer_name: custName }
      }
      if (custId) {
        summary.by_customer[custId].count++
        summary.by_customer[custId].duration += event.duration_minutes || 0
        if (event.billable) {
          summary.by_customer[custId].amount += event.charge_amount || 0
        }
      }
    })

    return NextResponse.json({
      data,
      summary,
    })
  } catch (error) {
    console.error("Error fetching waiting time events:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
