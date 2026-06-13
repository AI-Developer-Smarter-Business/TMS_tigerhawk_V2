import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTemplateEmail } from "@/lib/email/sendTemplateEmail"

export async function GET(
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

    // Fetch settlement details
    const { data: settlement, error } = await supabase
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
        drivers!inner(id, name, first_name, last_name, email)
      `)
      .eq("id", id)
      .single()

    if (error || !settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 })
    }

    // Fetch all driver pay items for the settlement period
    const { data: driverPayItems } = await supabase
      .from("ap_driver_pay")
      .select(`
        id,
        load_id,
        pay_date,
        amount,
        status,
        loads(id, reference_number)
      `)
      .eq("driver_id", settlement.driver_id)
      .gte("pay_date", settlement.period_start)
      .lte("pay_date", settlement.period_end)
      .order("pay_date", { ascending: false })

    // Fetch all deductions for the settlement period
    const { data: deductionItems } = await supabase
      .from("ap_deductions")
      .select(`
        id,
        deduction_date,
        deduction_type,
        description,
        amount,
        status
      `)
      .eq("driver_id", settlement.driver_id)
      .gte("deduction_date", settlement.period_start)
      .lte("deduction_date", settlement.period_end)
      .order("deduction_date", { ascending: false })

    return NextResponse.json({
      data: settlement,
      pay_items: driverPayItems || [],
      deductions: deductionItems || [],
      summary: {
        total_pay_items: (driverPayItems || []).length,
        total_deductions_items: (deductionItems || []).length,
      },
    })
  } catch (error) {
    console.error("Error fetching settlement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
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

    if (!profile || !["admin", "accounting", "finance"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    // Verify settlement exists
    const { data: settlement, error: settlementError } = await supabase
      .from("ap_settlements")
      .select("id, driver_id, status")
      .eq("id", id)
      .single()

    if (settlementError || !settlement) {
      return NextResponse.json({ error: "Settlement not found" }, { status: 404 })
    }

    // Build updates
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.status !== undefined) {
      updates.status = body.status
      if (body.status === "Reviewed") updates.reviewed_at = new Date().toISOString()
      if (body.status === "Finalized") updates.finalized_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Update settlement
    const { data: updatedSettlement, error: updateError } = await supabase
      .from("ap_settlements")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError || !updatedSettlement) {
      console.error("Settlement update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update settlement" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_settlement",
      entity_id: id,
      action: "updated",
      user_id: user.id,
      details: {
        driver_id: settlement.driver_id,
        updated_fields: Object.keys(updates).filter(k => k !== "updated_at"),
        updated_by: user.email,
      },
    })

    // Send settlement_ready email when finalized (synchronous send + audit; settlement still saved)
    if (body.status === "Finalized") {
      const { data: driver } = await adminSupabase
        .from("drivers")
        .select("name, email")
        .eq("id", settlement.driver_id)
        .single()

      if (driver?.email) {
        const periodStartStr = updatedSettlement.period_start
          ? new Date(updatedSettlement.period_start).toLocaleDateString("en-US")
          : ""
        const periodEndStr = updatedSettlement.period_end
          ? new Date(updatedSettlement.period_end).toLocaleDateString("en-US")
          : ""
        const netPayStr = updatedSettlement.net_pay
          ? `$${Number(updatedSettlement.net_pay).toFixed(2)}`
          : ""
        const emailResult = await sendTemplateEmail({
          templateKey: "settlement_ready",
          to: driver.email,
          variables: {
            driver_name: driver.name || "Driver",
            /** Seed template `email_templates.settlement_ready` expects these keys */
            settlement_period:
              periodStartStr && periodEndStr
                ? `${periodStartStr} – ${periodEndStr}`
                : periodStartStr || periodEndStr || "",
            total_amount: netPayStr,
            settlement_number: updatedSettlement.settlement_number || "",
            period_start: periodStartStr,
            period_end: periodEndStr,
            net_pay: netPayStr,
          },
        })

        try {
          await adminSupabase.from("activity_log").insert({
            entity_type: "ap_settlement",
            entity_id: id,
            action: emailResult.templateInactive
              ? "settlement_finalized_email_skipped_inactive_template"
              : emailResult.success
                ? "settlement_finalized_email_sent"
                : "settlement_finalized_email_failed",
            user_id: user.id,
            details: {
              recipient: driver.email,
              template_key: "settlement_ready",
              message_id: emailResult.messageId ?? null,
              error: emailResult.error ?? null,
              template_inactive: emailResult.templateInactive ?? false,
            },
          })
        } catch (logErr) {
          console.error("[ap_settlements PATCH] activity_log after settlement email:", logErr)
        }

        if (!emailResult.success && !emailResult.templateInactive) {
          console.error(
            "[ap_settlements PATCH] settlement_ready email failed:",
            emailResult.error
          )
        }
      }
    }

    return NextResponse.json(updatedSettlement)
  } catch (error) {
    console.error("Error updating settlement:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
