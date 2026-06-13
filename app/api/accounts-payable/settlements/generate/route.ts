// app/api/accounts-payable/settlements/generate/route.ts
// Batch settlement generation — creates settlements for all drivers
// (or a specific driver) who have unsettled pay records in a date range.
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const SETTLEMENT_ROLES = ["admin", "accounting", "finance"] as const

function canGenerate(role: string | undefined): boolean {
  return !!role && (SETTLEMENT_ROLES as readonly string[]).includes(role)
}

/** Preview: same selection as POST without mutating data. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!canGenerate(profile?.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const url = new URL(request.url)
    const period_start = url.searchParams.get("period_start")
    const period_end = url.searchParams.get("period_end")
    const driver_id = url.searchParams.get("driver_id") || undefined

    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: "period_start and period_end are required (YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    if (period_end < period_start) {
      return NextResponse.json(
        { error: "period_end must be on or after period_start" },
        { status: 400 }
      )
    }

    let payQuery = supabase
      .from("ap_driver_pay")
      .select(
        "id, driver_id, amount, pay_date, load_id, container_number, truck_number, owner, status"
      )
      .in("status", ["Unapproved", "Approved"])
      .is("settlement_id", null)
      .gte("pay_date", period_start)
      .lte("pay_date", period_end)

    if (driver_id) {
      payQuery = payQuery.eq("driver_id", driver_id)
    }

    const { data: payRecords, error: payError } = await payQuery

    if (payError) {
      console.error("Failed to fetch pay records (preview):", payError)
      return NextResponse.json(
        { error: "Failed to fetch pay records" },
        { status: 500 }
      )
    }

    if (!payRecords || payRecords.length === 0) {
      return NextResponse.json({
        period: { start: period_start, end: period_end },
        driver_count: 0,
        pay_record_count: 0,
        drivers: [],
      })
    }

    const byDriver = new Map<
      string,
      { totalPay: number; payIds: string[]; truckNumber: string | null; owner: string | null }
    >()
    for (const rec of payRecords || []) {
      const existing = byDriver.get(rec.driver_id)
      if (existing) {
        existing.totalPay += Number(rec.amount) || 0
        existing.payIds.push(rec.id)
        if (rec.truck_number) existing.truckNumber = rec.truck_number
        if (rec.owner) existing.owner = rec.owner
      } else {
        byDriver.set(rec.driver_id, {
          totalPay: Number(rec.amount) || 0,
          payIds: [rec.id],
          truckNumber: rec.truck_number || null,
          owner: rec.owner || null,
        })
      }
    }

    const driverIds = Array.from(byDriver.keys())
    const { data: deductions } = await supabase
      .from("ap_deductions")
      .select("id, driver_id, amount")
      .in("driver_id", driverIds)
      .in("status", ["Unapproved", "Approved"])
      .is("settlement_id", null)
      .gte("deduction_date", period_start)
      .lte("deduction_date", period_end)

    const deductionsByDriver = new Map<string, number>()
    for (const ded of deductions || []) {
      deductionsByDriver.set(
        ded.driver_id,
        (deductionsByDriver.get(ded.driver_id) || 0) + (Number(ded.amount) || 0)
      )
    }

    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, name, first_name, last_name")
      .in("id", driverIds)

    const driverMap = new Map((drivers || []).map((d) => [d.id, d]))

    const drivers_preview = driverIds.map((dId) => {
      const payData = byDriver.get(dId)!
      const totalDed = deductionsByDriver.get(dId) || 0
      const d = driverMap.get(dId)
      const name = d
        ? `${d.first_name || ""} ${d.last_name || ""}`.trim() || d.name || "Unknown"
        : "Unknown"
      return {
        driver_id: dId,
        driver_name: name,
        pay_record_count: payData.payIds.length,
        total_driver_pay: payData.totalPay,
        total_deductions: totalDed,
        net_pay: payData.totalPay - totalDed,
      }
    })

    return NextResponse.json({
      period: { start: period_start, end: period_end },
      driver_count: byDriver.size,
      pay_record_count: payRecords?.length || 0,
      drivers: drivers_preview,
    })
  } catch (error) {
    console.error("Error previewing batch settlements:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!canGenerate(profile?.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    const { period_start, period_end, driver_id } = body
    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: "period_start and period_end are required" },
        { status: 400 }
      )
    }

    if (period_end < period_start) {
      return NextResponse.json(
        { error: "period_end must be on or after period_start" },
        { status: 400 }
      )
    }

    let payQuery = supabase
      .from("ap_driver_pay")
      .select(
        "id, driver_id, amount, pay_date, load_id, container_number, truck_number, owner"
      )
      .in("status", ["Unapproved", "Approved"])
      .is("settlement_id", null)
      .gte("pay_date", period_start)
      .lte("pay_date", period_end)

    if (driver_id) {
      payQuery = payQuery.eq("driver_id", driver_id)
    }

    const { data: payRecords, error: payError } = await payQuery

    if (payError) {
      console.error("Failed to fetch pay records:", payError)
      return NextResponse.json(
        { error: "Failed to fetch pay records" },
        { status: 500 }
      )
    }

    if (!payRecords || payRecords.length === 0) {
      return NextResponse.json(
        {
          error:
            "No unsettled pay records found for the given period. Ensure lines are Unapproved or Approved, not already linked to a settlement.",
          code: "NO_UNSETTLED_PAY",
        },
        { status: 400 }
      )
    }

    const byDriver = new Map<
      string,
      { totalPay: number; payIds: string[]; truckNumber: string | null; owner: string | null }
    >()
    for (const rec of payRecords) {
      const existing = byDriver.get(rec.driver_id)
      if (existing) {
        existing.totalPay += Number(rec.amount) || 0
        existing.payIds.push(rec.id)
        if (rec.truck_number) existing.truckNumber = rec.truck_number
        if (rec.owner) existing.owner = rec.owner
      } else {
        byDriver.set(rec.driver_id, {
          totalPay: Number(rec.amount) || 0,
          payIds: [rec.id],
          truckNumber: rec.truck_number || null,
          owner: rec.owner || null,
        })
      }
    }

    const driverIds = Array.from(byDriver.keys())

    const deductionQuery = supabase
      .from("ap_deductions")
      .select("id, driver_id, amount")
      .in("driver_id", driverIds)
      .in("status", ["Unapproved", "Approved"])
      .is("settlement_id", null)
      .gte("deduction_date", period_start)
      .lte("deduction_date", period_end)

    const { data: deductions } = await deductionQuery

    const deductionsByDriver = new Map<
      string,
      { totalDeductions: number; deductionIds: string[] }
    >()
    for (const ded of deductions || []) {
      const existing = deductionsByDriver.get(ded.driver_id)
      if (existing) {
        existing.totalDeductions += Number(ded.amount) || 0
        existing.deductionIds.push(ded.id)
      } else {
        deductionsByDriver.set(ded.driver_id, {
          totalDeductions: Number(ded.amount) || 0,
          deductionIds: [ded.id],
        })
      }
    }

    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, name, first_name, last_name")
      .in("id", driverIds)

    const driverMap = new Map((drivers || []).map((d) => [d.id, d]))

    const adminSupabase = createAdminClient()
    const results: Array<{
      driver_id: string
      driver_name: string
      settlement_id: string
      settlement_number: string
      total_pay: number
      total_deductions: number
      net_pay: number
      pay_records: number
      deduction_records: number
    }> = []
    const errors: Array<{ driver_id: string; error: string }> = []

    for (const [dId, payData] of byDriver) {
      const dedData = deductionsByDriver.get(dId)
      const totalDeductions = dedData?.totalDeductions || 0
      const netPay = payData.totalPay - totalDeductions
      const driver = driverMap.get(dId)
      const driverName = driver
        ? `${driver.first_name || ""} ${driver.last_name || ""}`.trim() ||
          driver.name ||
          "Unknown"
        : "Unknown"

      const dateStr = period_end.replace(/-/g, "")
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
      const settlementNumber = `SET-${dateStr}-${rand}`

      const { data: settlement, error: insertErr } = await adminSupabase
        .from("ap_settlements")
        .insert({
          settlement_number: settlementNumber,
          driver_id: dId,
          fleet_owner: payData.owner,
          truck_number: payData.truckNumber,
          period_start,
          period_end,
          total_driver_pay: payData.totalPay,
          total_deductions: totalDeductions,
          net_pay: netPay,
          status: "Pending",
        })
        .select("id, settlement_number")
        .single()

      if (insertErr || !settlement) {
        console.error(`Settlement insert error for driver ${dId}:`, insertErr)
        errors.push({
          driver_id: dId,
          error: insertErr?.message || "Failed to create settlement",
        })
        continue
      }

      const { data: payRowsBefore } = await adminSupabase
        .from("ap_driver_pay")
        .select("id, status")
        .in("id", payData.payIds)

      const { error: linkPayErr } = await adminSupabase
        .from("ap_driver_pay")
        .update({ settlement_id: settlement.id, status: "Settled" })
        .in("id", payData.payIds)

      if (linkPayErr) {
        console.error(`Failed to link pay records for driver ${dId}:`, linkPayErr)
        await adminSupabase.from("ap_settlements").delete().eq("id", settlement.id)
        errors.push({
          driver_id: dId,
          error:
            linkPayErr.message ||
            "Failed to link ap_driver_pay rows — settlement rolled back",
        })
        continue
      }

      if (dedData && dedData.deductionIds.length > 0) {
        const { error: linkDedErr } = await adminSupabase
          .from("ap_deductions")
          .update({ settlement_id: settlement.id, status: "Settled" })
          .in("id", dedData.deductionIds)

        if (linkDedErr) {
          console.error(`Failed to link deductions for driver ${dId}:`, linkDedErr)
          for (const row of payRowsBefore || []) {
            await adminSupabase
              .from("ap_driver_pay")
              .update({ settlement_id: null, status: row.status })
              .eq("id", row.id)
          }
          await adminSupabase.from("ap_settlements").delete().eq("id", settlement.id)
          errors.push({
            driver_id: dId,
            error:
              linkDedErr.message ||
              "Failed to link deductions — settlement and pay links rolled back",
          })
          continue
        }
      }

      await adminSupabase.from("activity_log").insert({
        entity_type: "ap_settlement",
        entity_id: settlement.id,
        action: "batch_generated",
        user_id: user.id,
        details: {
          driver_id: dId,
          driver_name: driverName,
          settlement_number: settlementNumber,
          period_start,
          period_end,
          total_pay: payData.totalPay,
          total_deductions: totalDeductions,
          net_pay: netPay,
          generated_by: user.email,
        },
      })

      results.push({
        driver_id: dId,
        driver_name: driverName,
        settlement_id: settlement.id,
        settlement_number: settlement.settlement_number,
        total_pay: payData.totalPay,
        total_deductions: totalDeductions,
        net_pay: netPay,
        pay_records: payData.payIds.length,
        deduction_records: dedData?.deductionIds.length || 0,
      })
    }

    return NextResponse.json({
      settlements_created: results.length,
      settlements: results,
      errors: errors.length > 0 ? errors : undefined,
      period: { start: period_start, end: period_end },
    })
  } catch (error) {
    console.error("Error generating batch settlements:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
