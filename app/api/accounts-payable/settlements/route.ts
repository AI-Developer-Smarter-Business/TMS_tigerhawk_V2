import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateBody } from "@/lib/validations/validate"
import { createSettlementSchema } from "@/lib/validations/schemas"

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
    const periodStart = url.searchParams.get("period_start")
    const periodEnd = url.searchParams.get("period_end")
    const page = parseInt(url.searchParams.get("page") || "1", 10)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from("ap_settlements")
      .select(`
        id,
        settlement_number,
        driver_id,
        fleet_owner,
        truck_number,
        period_start,
        period_end,
        total_driver_pay,
        total_deductions,
        net_pay,
        status,
        reviewed_at,
        finalized_at,
        created_at,
        updated_at,
        drivers!inner(id, name, first_name, last_name)
      `, { count: "exact" })

    // Apply filters
    if (status) {
      query = query.eq("status", status)
    }

    if (driverId) {
      query = query.eq("driver_id", driverId)
    }

    if (periodStart) {
      query = query.gte("period_start", periodStart)
    }

    if (periodEnd) {
      query = query.lte("period_end", periodEnd)
    }

    const { data, error, count } = await query
      .order("period_end", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Settlements fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch settlements" },
        { status: 500 }
      )
    }

    // For each settlement, compute aggregates from driver pay and deductions if not already in settlement
    const enrichedData = await Promise.all(
      (data || []).map(async (settlement) => {
        // Fetch associated driver pay records
        const { data: driverPayRecords } = await supabase
          .from("ap_driver_pay")
          .select("amount")
          .eq("driver_id", settlement.driver_id)
          .gte("pay_date", settlement.period_start)
          .lte("pay_date", settlement.period_end)

        // Fetch associated deductions
        const { data: deductions } = await supabase
          .from("ap_deductions")
          .select("amount")
          .eq("driver_id", settlement.driver_id)
          .gte("deduction_date", settlement.period_start)
          .lte("deduction_date", settlement.period_end)

        const computedPayTotal = driverPayRecords?.reduce((sum, record) => sum + (record.amount || 0), 0) || 0
        const computedDeductionsTotal = deductions?.reduce((sum, ded) => sum + (ded.amount || 0), 0) || 0

        return {
          ...settlement,
          computed_pay: computedPayTotal,
          computed_deductions: computedDeductionsTotal,
          computed_net: computedPayTotal - computedDeductionsTotal,
        }
      })
    )

    // Calculate summary
    const summary = {
      total_settlements: enrichedData.length,
      total_pay: 0,
      total_deductions: 0,
      total_net: 0,
      by_status: {} as Record<string, { count: number; net: number }>,
    }

    enrichedData.forEach((settlement) => {
      summary.total_pay += settlement.total_driver_pay || 0
      summary.total_deductions += settlement.total_deductions || 0
      summary.total_net += settlement.net_pay || 0

      const settlementStatus = settlement.status || "Unknown"
      if (!summary.by_status[settlementStatus]) {
        summary.by_status[settlementStatus] = { count: 0, net: 0 }
      }
      summary.by_status[settlementStatus].count++
      summary.by_status[settlementStatus].net += settlement.net_pay || 0
    })

    return NextResponse.json({
      data: enrichedData,
      summary,
      total: count,
      page,
      limit,
    })
  } catch (error) {
    console.error("Error fetching settlements:", error)
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
    const validation = validateBody(body, createSettlementSchema)
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

    // Compute totals from driver pay and deductions for the period
    const { data: driverPayRecords } = await supabase
      .from("ap_driver_pay")
      .select("amount")
      .eq("driver_id", data.driver_id)
      .gte("pay_date", data.period_start)
      .lte("pay_date", data.period_end)

    const { data: deductions } = await supabase
      .from("ap_deductions")
      .select("amount")
      .eq("driver_id", data.driver_id)
      .gte("deduction_date", data.period_start)
      .lte("deduction_date", data.period_end)

    const totalPay = driverPayRecords?.reduce((sum, record) => sum + (record.amount || 0), 0) || 0
    const totalDeductions = deductions?.reduce((sum, ded) => sum + (ded.amount || 0), 0) || 0
    const netSettlement = totalPay - totalDeductions

    // Create settlement
    const { data: settlement, error: insertError } = await supabase
      .from("ap_settlements")
      .insert({
        settlement_number: data.settlement_number || `SET-${Date.now()}`,
        driver_id: data.driver_id,
        fleet_owner: data.fleet_owner || null,
        truck_number: data.truck_number || null,
        period_start: data.period_start,
        period_end: data.period_end,
        total_driver_pay: totalPay,
        total_deductions: totalDeductions,
        net_pay: netSettlement,
        status: data.status || "Pending",
      })
      .select()
      .single()

    if (insertError) {
      console.error("Settlement insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create settlement" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_settlement",
      entity_id: settlement.id,
      action: "created",
      user_id: user.id,
      details: {
        driver_id: data.driver_id,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        period_start: data.period_start,
        period_end: data.period_end,
        net_settlement: netSettlement,
        created_by: user.email,
      },
    })

    return NextResponse.json(settlement, { status: 201 })
  } catch (error) {
    console.error("Error creating settlement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
