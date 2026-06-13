// app/api/admin/email-templates/send/route.ts
// Admin API for sending test emails or triggering template sends
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTemplateEmail } from "@/lib/email/sendTemplateEmail"
import { NextRequest, NextResponse } from "next/server"
import { sendEmailSchema } from "@/lib/validations/schemas"
import { validateBody } from "@/lib/validations/validate"

/**
 * POST — Send a test email using a template
 * Body: { templateKey: string, to: string, variables?: Record<string, string> }
 *
 * Admin-only. Sends a single email using the specified template.
 * Useful for the "Send Test" button in the admin UI.
 */
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

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()

    // Validate with Zod schema
    const validation = validateBody(body, sendEmailSchema)
    if (!validation.success) return validation.response
    const { templateKey, to, variables } = validation.data

    const result = await sendTemplateEmail({
      templateKey,
      to,
      variables: variables || {},
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      )
    }

    // Audit log
    try {
      const adminClient = createAdminClient()
      await adminClient.from("activity_log").insert({
        entity_type: "email_template",
        entity_id: templateKey,
        action: result.templateInactive ? "test_send_skipped_inactive" : "test_send",
        user_id: user.id,
        details: {
          template_key: templateKey,
          recipient: to,
          message_id: result.messageId || null,
          template_inactive: result.templateInactive || false,
          sent_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    if (result.templateInactive) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Template is inactive — email was not sent",
      })
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Test email sent to ${to}`,
    })
  } catch (error) {
    console.error("Error in POST /api/admin/email-templates/send:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
