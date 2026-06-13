import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateBody } from "@/lib/validations/validate"
import { createDriverPaySchema } from "@/lib/validations/schemas"

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
    const driverId = url.searchParams.get("driver_id")
    const dateFrom = url.searchParams.get("date_from")
    const dateTo = url.searchParams.get("date_to")

    // Build query
    let query = supabase
      .from("ap_driver_pay")
      .select(`
        id,
        driver_id,
        load_id,
        container_number,
        truck_number,
        owner,
        load_status,
        from_location,
        to_location,
        pay_date,
        amount,
        status,
        settlement_id,
        notes,
        created_at,
        updated_at,
        drivers!inner(id, name, first_name, last_name),
        loads(id, reference_number, status)
      `)

    // Apply filters
    if (status) {
      query = query.eq("status", status)
    }

    if (driverId) {
      query = query.eq("driver_id", driverId)
    }

    if (dateFrom) {
      query = query.gte("pay_date", dateFrom)
    }

    if (dateTo) {
      query = query.lte("pay_date", dateTo)
    }

    const { data, error } = await query.order("pay_date", { ascending: false })

    if (error) {
      console.error("Driver pay fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch driver pay records" },
        { status: 500 }
      )
    }

    // Calculate summary
    const summary = {
      total_records: data.length,
      total_amount: 0,
      by_status: {} as Record<string, { count: number; amount: number }>,
    }

    data?.forEach((record) => {
      summary.total_amount += record.amount || 0

      const recordStatus = record.status || "Unknown"
      if (!summary.by_status[recordStatus]) {
        summary.by_status[recordStatus] = { count: 0, amount: 0 }
      }
      summary.by_status[recordStatus].count++
      summary.by_status[recordStatus].amount += record.amount || 0
    })

    return NextResponse.json({
      data,
      summary,
    })
  } catch (error) {
    console.error("Error fetching driver pay:", error)
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
    const validation = validateBody(body, createDriverPaySchema)
    if (!validation.success) {
      return validation.response
    }

    const data = validation.data

    // Verify driver exists
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, first_name, last_name")
      .eq("id", data.driver_id)
      .single()

    if (driverError || !driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 })
    }

    // Create driver pay record
    const { data: driverPay, error: insertError } = await supabase
      .from("ap_driver_pay")
      .insert({
        driver_id: data.driver_id,
        load_id: data.load_id || null,
        container_number: data.container_number || null,
        truck_number: data.truck_number || null,
        owner: data.owner || null,
        load_status: data.load_status || null,
        from_location: data.from_location || null,
        to_location: data.to_location || null,
        pay_date: data.pay_date || new Date().toISOString(),
        amount: Number(data.amount),
        status: data.status || "Unapproved",
        settlement_id: data.settlement_id || null,
        notes: data.notes || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Driver pay insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create driver pay record" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_driver_pay",
      entity_id: driverPay.id,
      action: "created",
      user_id: user.id,
      details: {
        driver_id: data.driver_id,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        amount: data.amount,
        created_by: user.email,
      },
    })

    return NextResponse.json(driverPay, { status: 201 })
  } catch (error) {
    console.error("Error creating driver pay:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
