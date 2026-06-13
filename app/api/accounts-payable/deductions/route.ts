import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateBody } from "@/lib/validations/validate"
import { createDeductionSchema } from "@/lib/validations/schemas"

type DriverDeductionLimit = {
  id: string
  amount: number | null
  limit_total: number | null
  limit_per_period: number | null
  total_deducted: number | null
  deduction_templates: {
    name: string | null
    enabled: boolean | null
  }[] | null
}

function normalizeDeductionType(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase()
}

async function getLimitSettingForDeductionType(
  adminSupabase: ReturnType<typeof createAdminClient>,
  driverId: string,
  deductionType: string
): Promise<DriverDeductionLimit | null> {
  const { data, error } = await adminSupabase
    .from("driver_deduction_settings")
    .select(`
      id,
      amount,
      limit_total,
      limit_per_period,
      total_deducted,
      deduction_templates(
        name,
        enabled
      )
    `)
    .eq("driver_id", driverId)
    .eq("enabled", true)

  if (error || !data) return null

  const wantedType = normalizeDeductionType(deductionType)
  return (
    (data as DriverDeductionLimit[]).find((row) => {
      const template = row.deduction_templates?.[0]
      if (!template?.enabled) return false
      return normalizeDeductionType(template.name) === wantedType
    }) || null
  )
}

function getLimitViolationDetails(setting: DriverDeductionLimit, requestedAmount: number) {
  if (setting.limit_per_period !== null && setting.limit_per_period !== undefined) {
    if (requestedAmount > setting.limit_per_period) {
      return {
        code: "DEDUCTION_LIMIT_PER_PERIOD_EXCEEDED",
        error: "Deduction amount exceeds per-period limit",
        details: {
          requested_amount: requestedAmount,
          limit_per_period: setting.limit_per_period,
        },
      }
    }
  }

  if (setting.limit_total !== null && setting.limit_total !== undefined) {
    const alreadyDeducted = setting.total_deducted || 0
    const remainingTotal = Math.max(0, setting.limit_total - alreadyDeducted)
    if (requestedAmount > remainingTotal) {
      return {
        code: "DEDUCTION_LIMIT_TOTAL_EXCEEDED",
        error: "Deduction amount exceeds remaining total limit",
        details: {
          requested_amount: requestedAmount,
          limit_total: setting.limit_total,
          total_deducted: alreadyDeducted,
          remaining_total: remainingTotal,
        },
      }
    }
  }

  return null
}

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
    const driverId = url.searchParams.get("driver_id")
    const status = url.searchParams.get("status")
    const dateFrom = url.searchParams.get("date_from")
    const dateTo = url.searchParams.get("date_to")

    // Build query
    let query = supabase
      .from("ap_deductions")
      .select(`
        id,
        driver_id,
        settlement_id,
        deduction_type,
        description,
        unit_of_measure,
        math_operation,
        amount,
        final_amount,
        deduction_date,
        status,
        created_at,
        updated_at,
        drivers!inner(id, name, first_name, last_name)
      `)

    // Apply filters
    if (driverId) {
      query = query.eq("driver_id", driverId)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (dateFrom) {
      query = query.gte("deduction_date", dateFrom)
    }

    if (dateTo) {
      query = query.lte("deduction_date", dateTo)
    }

    const { data, error } = await query.order("deduction_date", { ascending: false })

    if (error) {
      console.error("Deductions fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch deductions" },
        { status: 500 }
      )
    }

    // Calculate summary
    const summary = {
      total_deductions: data.length,
      total_amount: 0,
      by_type: {} as Record<string, { count: number; amount: number }>,
      by_status: {} as Record<string, { count: number; amount: number }>,
    }

    data?.forEach((deduction) => {
      summary.total_amount += deduction.amount || 0

      // By type
      const type = deduction.deduction_type || "Unknown"
      if (!summary.by_type[type]) {
        summary.by_type[type] = { count: 0, amount: 0 }
      }
      summary.by_type[type].count++
      summary.by_type[type].amount += deduction.amount || 0

      // By status
      const dedStatus = deduction.status || "Unknown"
      if (!summary.by_status[dedStatus]) {
        summary.by_status[dedStatus] = { count: 0, amount: 0 }
      }
      summary.by_status[dedStatus].count++
      summary.by_status[dedStatus].amount += deduction.amount || 0
    })

    return NextResponse.json({
      data,
      summary,
    })
  } catch (error) {
    console.error("Error fetching deductions:", error)
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
    const validation = validateBody(body, createDeductionSchema)
    if (!validation.success) {
      return validation.response
    }

    const data = validation.data

    // Verify driver exists
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, name, first_name, last_name")
      .eq("id", data.driver_id)
      .single()

    if (driverError || !driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 })
    }

    // Ensure deduction_date is a proper ISO timestamp for TIMESTAMPTZ column.
    // If a bare "yyyy-MM-dd" string is passed, treat it as local midnight.
    let deductionDate = data.deduction_date || new Date().toISOString()
    if (typeof deductionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(deductionDate)) {
      deductionDate = new Date(deductionDate + "T00:00:00").toISOString()
    }

    const requestedAmount = Number(data.amount)
    const adminSupabase = createAdminClient()
    const setting = await getLimitSettingForDeductionType(
      adminSupabase,
      data.driver_id,
      data.deduction_type
    )
    if (setting) {
      const violation = getLimitViolationDetails(setting, requestedAmount)
      if (violation) {
        return NextResponse.json(violation, { status: 422 })
      }
    }

    // Create deduction
    const { data: deduction, error: insertError } = await supabase
      .from("ap_deductions")
      .insert({
        driver_id: data.driver_id,
        settlement_id: data.settlement_id || null,
        deduction_type: data.deduction_type,
        description: data.description || null,
        unit_of_measure: data.unit_of_measure || "Flat Amount",
        math_operation: data.math_operation || "Subtract",
        amount: requestedAmount,
        final_amount: Number(data.final_amount || data.amount),
        deduction_date: deductionDate,
        status: data.status || "Unapproved",
      })
      .select()
      .single()

    if (insertError) {
      console.error("Deduction insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create deduction" },
        { status: 500 }
      )
    }

    // Log activity
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_deduction",
      entity_id: deduction.id,
      action: "created",
      user_id: user.id,
      details: {
        driver_id: data.driver_id,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        type: data.deduction_type,
        amount: data.amount,
        created_by: user.email,
      },
    })

    return NextResponse.json(deduction, { status: 201 })
  } catch (error) {
    console.error("Error creating deduction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
