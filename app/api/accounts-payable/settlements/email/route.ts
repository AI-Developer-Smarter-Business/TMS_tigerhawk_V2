// app/api/accounts-payable/settlements/email/route.ts
// Send settlement email to a driver or custom email address

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_FROM, sendResendEmailWithRetry } from "@/lib/email/resendClient"
import { format } from "date-fns"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
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

    if (!profile || !["admin", "accounting", "dispatcher", "finance"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { to, driverName, periodStart, periodEnd, totalDriverPay, totalDeductions, netPay, settlementNumber, payItemCount } = body

    if (!to || !driverName) {
      return NextResponse.json({ error: "Missing required fields: to, driverName" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    const fmtCurrency = (n: number) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const fmtPeriod = (d: string | undefined | null) => {
      if (!d) return "N/A"
      try { return format(new Date(d), "MMM dd, yyyy") } catch { return d || "N/A" }
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="border-bottom: 3px solid #E8700A; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #E8700A; margin: 0; font-size: 24px;">TIGERHAWK</h1>
          <p style="color: #6B7280; margin: 4px 0 0 0; font-size: 12px;">Transportation Management System</p>
        </div>

        <h2 style="color: #1E3A5F; font-size: 18px; margin-bottom: 8px;">Driver Settlement Statement</h2>
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 24px;">
          Settlement for <strong>${driverName}</strong>
          ${settlementNumber ? ` — ${settlementNumber}` : ""}
        </p>

        <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Pay Period</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827; font-size: 14px;">
                ${fmtPeriod(periodStart)} — ${fmtPeriod(periodEnd)}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Pay Items</td>
              <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">${payItemCount || 0} loads</td>
            </tr>
            <tr style="border-top: 1px solid #E5E7EB;">
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Total Driver Pay</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #16a34a; font-size: 14px;">${fmtCurrency(totalDriverPay)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280; font-size: 14px;">Total Deductions</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #dc2626; font-size: 14px;">-${fmtCurrency(totalDeductions)}</td>
            </tr>
            <tr style="border-top: 2px solid #E5E7EB;">
              <td style="padding: 12px 0; color: #111827; font-size: 16px; font-weight: bold;">Net Pay</td>
              <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #111827; font-size: 18px;">${fmtCurrency(netPay)}</td>
            </tr>
          </table>
        </div>

        <p style="color: #6B7280; font-size: 12px; margin-top: 32px; border-top: 1px solid #E5E7EB; padding-top: 16px;">
          This is an automated settlement notification from TigerHawk TMS.
          If you have questions about this settlement, please contact your dispatcher.
        </p>
      </div>
    `

    const { data: emailData, error: sendError } = await sendResendEmailWithRetry({
      from: DEFAULT_FROM,
      to: [to],
      subject: `Settlement Statement — ${driverName} — ${fmtPeriod(periodStart)} to ${fmtPeriod(periodEnd)}`,
      html: htmlBody,
    })

    if (sendError) {
      console.error("[Settlement Email] Resend error:", sendError)
      return NextResponse.json({ error: sendError.message || "Failed to send email" }, { status: 500 })
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ap_settlement",
      entity_id: settlementNumber || "manual",
      action: "email_sent",
      user_id: user.id,
      details: {
        recipient: to,
        driver_name: driverName,
        period: `${periodStart} - ${periodEnd}`,
        sent_by: user.email,
        message_id: emailData?.id,
      },
    })

    console.log(`[Settlement Email] Sent to ${to} for ${driverName}, period ${periodStart}-${periodEnd}`)

    return NextResponse.json({
      success: true,
      messageId: emailData?.id,
      message: `Settlement email sent to ${to}`,
    })
  } catch (error) {
    console.error("[Settlement Email] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
