// app/api/accounts-payable/deductions/generate/route.ts
// Auto-generate weekly deductions from driver_deduction_settings + deduction_templates

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher", "finance", "accounting"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { period_start, period_end, driver_ids } = body

    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: "Missing required fields: period_start, period_end" },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    // Determine which drivers to generate for
    let targetDriverIds: string[] = []

    if (driver_ids && Array.isArray(driver_ids) && driver_ids.length > 0) {
      targetDriverIds = driver_ids
    } else {
      // All drivers with status "Available" or "On Assignment" (the two active statuses)
      const { data: activeDrivers } = await adminSupabase
        .from("drivers")
        .select("id")
        .in("status", ["Available", "On Assignment"])

      targetDriverIds = (activeDrivers || []).map((d) => d.id)
    }

    if (targetDriverIds.length === 0) {
      return NextResponse.json({
        generated: 0,
        skipped: 0,
        errors: [],
        message: "No active drivers found",
      })
    }

    // Fetch all driver_deduction_settings for target drivers, joined with templates
    const { data: driverSettings, error: settingsError } = await adminSupabase
      .from("driver_deduction_settings")
      .select(`
        id,
        driver_id,
        template_id,
        amount,
        enabled,
        limit_total,
        limit_per_period,
        total_deducted,
        start_date,
        end_date,
        notes,
        deduction_templates(
          id,
          name,
          deduction_type,
          math_operation,
          default_amount,
          frequency,
          enabled
        )
      `)
      .in("driver_id", targetDriverIds)
      .eq("enabled", true)

    if (settingsError) {
      console.error("[Deduction Generate] Settings fetch error:", settingsError)
      return NextResponse.json(
        { error: "Failed to fetch driver deduction settings" },
        { status: 500 }
      )
    }

    // Fetch existing deductions for this period to avoid duplicates
    const { data: existingDeductions } = await adminSupabase
      .from("ap_deductions")
      .select("driver_id, deduction_type")
      .gte("deduction_date", period_start)
      .lte("deduction_date", period_end)
      .in("driver_id", targetDriverIds)

    // Build a Set of "driver_id::deduction_type" for quick duplicate check
    const existingSet = new Set(
      (existingDeductions || []).map((d) => `${d.driver_id}::${d.deduction_type}`)
    )

    let generated = 0
    let skipped = 0
    const errors: string[] = []

    for (const setting of driverSettings || []) {
      const template = setting.deduction_templates as any
      if (!template || !template.enabled) {
        skipped++
        continue
      }

      // Only process weekly frequency templates (or "Weekly" frequency)
      // Templates without a frequency specified are assumed weekly
      if (template.frequency && template.frequency !== "Weekly") {
        skipped++
        continue
      }

      const driverId = setting.driver_id
      // Use template.name as the unique identifier (e.g., "Fuel", "Escrow", "Equipment Rental (Samsara)")
      // NOT template.deduction_type which is the calculation type (all default to "Fixed")
      const deductionType = template.name

      // Check if deduction already exists for this driver + type + period
      const dedKey = `${driverId}::${deductionType}`
      if (existingSet.has(dedKey)) {
        skipped++
        continue
      }

      // Check start_date / end_date windows on driver setting
      if (setting.start_date && new Date(setting.start_date) > new Date(period_end)) {
        skipped++
        continue
      }
      if (setting.end_date && new Date(setting.end_date) < new Date(period_start)) {
        skipped++
        continue
      }

      // Determine requested amount: use driver-specific amount if set, otherwise template default.
      const baseAmount = Number(setting.amount ?? template.default_amount ?? 0)
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
        skipped++
        continue
      }

      let effectiveAmount = baseAmount

      // Enforce limit_per_period by capping the generated row amount.
      if (setting.limit_per_period !== null && setting.limit_per_period !== undefined) {
        const perPeriodCap = Number(setting.limit_per_period)
        if (Number.isFinite(perPeriodCap)) {
          effectiveAmount = Math.min(effectiveAmount, Math.max(0, perPeriodCap))
        }
      }

      // Enforce limit_total (lifetime cap) by capping to remaining balance.
      if (setting.limit_total !== null && setting.limit_total !== undefined) {
        const remaining = Number(setting.limit_total) - Number(setting.total_deducted || 0)
        if (!Number.isFinite(remaining) || remaining <= 0) {
          skipped++
          continue
        }
        effectiveAmount = Math.min(effectiveAmount, remaining)
      }

      if (effectiveAmount <= 0) {
        skipped++
        continue
      }

      // Compute final_amount (for now, flat amount = amount; percentage/per-mile would need load data)
      const finalAmount = Number(effectiveAmount.toFixed(2))

      try {
        // Ensure deduction_date is a proper ISO timestamp for TIMESTAMPTZ column
        const deductionDateISO = new Date(period_start + "T00:00:00").toISOString()

        const { error: insertError } = await adminSupabase
          .from("ap_deductions")
          .insert({
            driver_id: driverId,
            deduction_type: deductionType,
            description: `Auto-generated: ${template.name}`,
            unit_of_measure: "Flat Amount",
            math_operation: template.math_operation || "Subtract",
            amount: finalAmount,
            final_amount: finalAmount,
            deduction_date: deductionDateISO,
            status: "Unapproved",
          })

        if (insertError) {
          console.error(`[Deduction Generate] Insert error for driver ${driverId}:`, insertError)
          errors.push(`Failed for driver ${driverId}, type ${deductionType}: ${insertError.message}`)
        } else {
          generated++
          existingSet.add(dedKey) // prevent duplicates within same batch

          // Update total_deducted on driver_deduction_settings
          if (setting.total_deducted !== null || setting.limit_total) {
            await adminSupabase
              .from("driver_deduction_settings")
              .update({
                total_deducted: (setting.total_deducted || 0) + finalAmount,
              })
              .eq("id", setting.id)
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        errors.push(`Exception for driver ${driverId}, type ${deductionType}: ${errMsg}`)
      }
    }

    // Log activity
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_deduction",
      entity_id: "batch_generate",
      action: "batch_generated",
      user_id: user.id,
      details: {
        period_start,
        period_end,
        target_driver_count: targetDriverIds.length,
        generated,
        skipped,
        error_count: errors.length,
        generated_by: user.email,
      },
    })

    console.log(
      `[Deduction Generate] Period ${period_start}-${period_end}: generated=${generated}, skipped=${skipped}, errors=${errors.length}`
    )

    return NextResponse.json({
      generated,
      skipped,
      errors,
      message: `Generated ${generated} deduction(s), skipped ${skipped}`,
    })
  } catch (error) {
    console.error("[Deduction Generate] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
