import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { startOfWeek, endOfWeek, format } from "date-fns"

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

    // Check permission - admin, accounting, dispatcher, finance
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "accounting", "dispatcher", "finance"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()

    // Verify driver pay record exists — include pay_date for settlement logic
    const { data: driverPay, error: driverPayError } = await supabase
      .from("ap_driver_pay")
      .select("id, driver_id, amount, pay_date, status, settlement_id")
      .eq("id", id)
      .single()

    if (driverPayError || !driverPay) {
      return NextResponse.json({ error: "Driver pay record not found" }, { status: 404 })
    }

    // Build updates
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.status !== undefined) updates.status = body.status
    if (body.amount !== undefined) updates.amount = Number(body.amount)
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.load_status !== undefined) updates.load_status = body.load_status

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // ─── Settlement auto-creation when status → Approved ─────────
    if (body.status === "Approved" && driverPay.status !== "Approved") {
      try {
        const payDate = driverPay.pay_date ? new Date(driverPay.pay_date) : new Date()
        const periodStart = startOfWeek(payDate, { weekStartsOn: 0 }) // Sunday
        const periodEnd = endOfWeek(payDate, { weekStartsOn: 0 })     // Saturday

        const periodStartStr = format(periodStart, "yyyy-MM-dd")
        const periodEndStr = format(periodEnd, "yyyy-MM-dd")

        // Look for existing settlement for this driver + period
        const { data: existingSettlement } = await adminSupabase
          .from("ap_settlements")
          .select("id, total_driver_pay, status")
          .eq("driver_id", driverPay.driver_id)
          .eq("period_start", periodStartStr)
          .eq("period_end", periodEndStr)
          .maybeSingle()

        let settlementId: string

        if (existingSettlement) {
          // Update existing settlement total
          settlementId = existingSettlement.id
          const newTotal = (existingSettlement.total_driver_pay || 0) + (driverPay.amount || 0)
          await adminSupabase
            .from("ap_settlements")
            .update({
              total_driver_pay: newTotal,
              net_pay: newTotal - 0, // deductions handled separately
              updated_at: new Date().toISOString(),
            })
            .eq("id", settlementId)

          console.log(`[Settlement] Updated settlement ${settlementId}: added $${driverPay.amount}, new total $${newTotal}`)
        } else {
          // Create new settlement
          const setNum = `SET-${format(new Date(), "yyyyMMdd")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

          const { data: newSettlement, error: createError } = await adminSupabase
            .from("ap_settlements")
            .insert({
              settlement_number: setNum,
              driver_id: driverPay.driver_id,
              period_start: periodStartStr,
              period_end: periodEndStr,
              total_driver_pay: driverPay.amount || 0,
              total_deductions: 0,
              net_pay: driverPay.amount || 0,
              status: "Pending",
            })
            .select("id")
            .single()

          if (createError || !newSettlement) {
            console.error("[Settlement] Failed to create settlement:", createError)
          } else {
            settlementId = newSettlement.id
            console.log(`[Settlement] Created ${setNum} for driver ${driverPay.driver_id}, period ${periodStartStr} - ${periodEndStr}, amount $${driverPay.amount}`)
          }
        }

        // Link pay record to settlement
        if (settlementId!) {
          updates.settlement_id = settlementId
        }
      } catch (settlementError) {
        // Non-fatal: log but don't block the status update
        console.error("[Settlement] Error in auto-settlement creation:", settlementError)
      }
    }

    // ─── If unapproving, unlink from settlement and update totals ──
    if (body.status === "Unapproved" && driverPay.status === "Approved" && driverPay.settlement_id) {
      try {
        // Get current settlement to adjust totals
        const { data: settlement } = await adminSupabase
          .from("ap_settlements")
          .select("id, total_driver_pay, status")
          .eq("id", driverPay.settlement_id)
          .single()

        if (settlement && settlement.status === "Pending") {
          const newTotal = Math.max(0, (settlement.total_driver_pay || 0) - (driverPay.amount || 0))

          if (newTotal <= 0) {
            // Delete empty settlement
            await adminSupabase
              .from("ap_settlements")
              .delete()
              .eq("id", settlement.id)
            console.log(`[Settlement] Deleted empty settlement ${settlement.id}`)
          } else {
            await adminSupabase
              .from("ap_settlements")
              .update({
                total_driver_pay: newTotal,
                net_pay: newTotal,
                updated_at: new Date().toISOString(),
              })
              .eq("id", settlement.id)
            console.log(`[Settlement] Reduced settlement ${settlement.id}: removed $${driverPay.amount}, new total $${newTotal}`)
          }
        }

        updates.settlement_id = null
      } catch (unlinkError) {
        console.error("[Settlement] Error unlinking settlement:", unlinkError)
      }
    }

    // Update driver pay record
    const { data: updatedRecord, error: updateError } = await supabase
      .from("ap_driver_pay")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError || !updatedRecord) {
      console.error("Driver pay update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update driver pay record" },
        { status: 500 }
      )
    }

    // Log activity
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_driver_pay",
      entity_id: id,
      action: "updated",
      user_id: user.id,
      details: {
        driver_id: driverPay.driver_id,
        updated_fields: Object.keys(updates).filter(k => k !== "updated_at"),
        updated_by: user.email,
        ...(body.status === "Approved" ? { settlement_auto_created: true } : {}),
      },
    })

    return NextResponse.json(updatedRecord)
  } catch (error) {
    console.error("Error updating driver pay:", error)
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

    // Verify driver pay record exists
    const { data: driverPay, error: driverPayError } = await supabase
      .from("ap_driver_pay")
      .select("id, driver_id")
      .eq("id", id)
      .single()

    if (driverPayError || !driverPay) {
      return NextResponse.json({ error: "Driver pay record not found" }, { status: 404 })
    }

    // Delete driver pay record
    const { error: deleteError } = await supabase
      .from("ap_driver_pay")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Driver pay delete error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete driver pay record" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_driver_pay",
      entity_id: id,
      action: "deleted",
      user_id: user.id,
      details: {
        driver_id: driverPay.driver_id,
        deleted_by: user.email,
      },
    })

    return NextResponse.json({ success: true, message: "Driver pay record deleted successfully" })
  } catch (error) {
    console.error("Error deleting driver pay:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
