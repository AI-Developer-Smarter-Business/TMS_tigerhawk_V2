import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

type DriverDeductionLimit = {
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

export async function PATCH(
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

    const body = await request.json()

    // Verify deduction exists
    const { data: deduction, error: deductionError } = await supabase
      .from("ap_deductions")
      .select("id, driver_id, deduction_type, amount, final_amount")
      .eq("id", id)
      .single()

    if (deductionError || !deduction) {
      return NextResponse.json({ error: "Deduction not found" }, { status: 404 })
    }

    // Build updates
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.deduction_type !== undefined) updates.deduction_type = body.deduction_type
    if (body.description !== undefined) updates.description = body.description
    if (body.amount !== undefined) {
      const requestedAmount = Number(body.amount)
      const deductionTypeForValidation = String(body.deduction_type ?? deduction.deduction_type ?? "")
      const adminSupabase = createAdminClient()
      const setting = await getLimitSettingForDeductionType(
        adminSupabase,
        deduction.driver_id,
        deductionTypeForValidation
      )
      if (setting) {
        const violation = getLimitViolationDetails(setting, requestedAmount)
        if (violation) {
          return NextResponse.json(violation, { status: 422 })
        }
      }

      updates.amount = requestedAmount
      if (body.final_amount === undefined) {
        updates.final_amount = requestedAmount
      }
    }
    if (body.status !== undefined) updates.status = body.status
    if (body.unit_of_measure !== undefined) updates.unit_of_measure = body.unit_of_measure
    if (body.math_operation !== undefined) updates.math_operation = body.math_operation
    if (body.final_amount !== undefined) updates.final_amount = Number(body.final_amount)
    if (body.notes !== undefined) updates.notes = body.notes

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Update deduction
    const { data: updatedDeduction, error: updateError } = await supabase
      .from("ap_deductions")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError || !updatedDeduction) {
      console.error("Deduction update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update deduction" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_deduction",
      entity_id: id,
      action: "updated",
      user_id: user.id,
      details: {
        driver_id: deduction.driver_id,
        updated_fields: Object.keys(updates).filter(k => k !== "updated_at"),
        updated_by: user.email,
      },
    })

    return NextResponse.json(updatedDeduction)
  } catch (error) {
    console.error("Error updating deduction:", error)
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

    // Check permission - admin only for delete
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify deduction exists
    const { data: deduction, error: deductionError } = await supabase
      .from("ap_deductions")
      .select("id, driver_id")
      .eq("id", id)
      .single()

    if (deductionError || !deduction) {
      return NextResponse.json({ error: "Deduction not found" }, { status: 404 })
    }

    // Delete deduction
    const { error: deleteError } = await supabase
      .from("ap_deductions")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Deduction delete error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete deduction" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_deduction",
      entity_id: id,
      action: "deleted",
      user_id: user.id,
      details: {
        driver_id: deduction.driver_id,
        deleted_by: user.email,
      },
    })

    return NextResponse.json({ success: true, message: "Deduction deleted successfully" })
  } catch (error) {
    console.error("Error deleting deduction:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
