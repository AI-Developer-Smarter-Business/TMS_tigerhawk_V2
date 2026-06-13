// lib/email/sendTemplateEmail.ts
// Core utility for sending emails using Resend + database-driven templates

import { createAdminClient } from "@/lib/supabase/admin"
import { DEFAULT_FROM, sendResendEmailWithRetry } from "@/lib/email/resendClient"

export type SendTemplateEmailParams = {
  /** The template_key from the email_templates table (e.g. "settlement_ready") */
  templateKey: string
  /** Recipient email address */
  to: string
  /** Variable values to interpolate into subject + body (e.g. { customer_name: "Acme" }) */
  variables?: Record<string, string>
  /** Optional override for the "from" address */
  from?: string
  /** Optional CC recipients */
  cc?: string[]
  /** Optional BCC recipients */
  bcc?: string[]
  /** Optional reply-to address */
  replyTo?: string
}

export type SendEmailResult = {
  success: boolean
  messageId?: string
  error?: string
  /** Template was found but is_active=false — email was not sent */
  templateInactive?: boolean
}

/**
 * Fetches a template from the database by key, interpolates variables,
 * and sends via Resend. Returns success/failure with message ID.
 *
 * - If the template is not found, returns an error.
 * - If the template is inactive (is_active=false), skips sending and returns templateInactive: true.
 * - All {{variable}} placeholders in subject and body are replaced with provided values.
 *   Missing variables are replaced with empty strings to avoid broken output.
 * - Delivery is synchronous in the request (no queue). Resend calls use bounded retries for transient errors.
 */
export async function sendTemplateEmail(
  params: SendTemplateEmailParams
): Promise<SendEmailResult> {
  const { templateKey, to, variables = {}, from, cc, bcc, replyTo } = params

  try {
    // 1. Fetch template from database
    const adminClient = createAdminClient()
    const { data: template, error: fetchError } = await adminClient
      .from("email_templates")
      .select("*")
      .eq("template_key", templateKey)
      .single()

    if (fetchError || !template) {
      console.error(`Email template "${templateKey}" not found:`, fetchError)
      return { success: false, error: `Template "${templateKey}" not found` }
    }

    // 2. Check if template is active
    if (!template.is_active) {
      console.log(`Email template "${templateKey}" is inactive — skipping send to ${to}`)
      return { success: true, templateInactive: true }
    }

    // 3. Interpolate variables into subject and body
    const subject = interpolateVariables(template.subject, variables)
    const bodyHtml = interpolateVariables(template.body_html, variables)

    // 4. Send via Resend (with retry on transient failures)
    const { data, error: sendError } = await sendResendEmailWithRetry({
      from: from || DEFAULT_FROM,
      to: [to],
      subject,
      html: bodyHtml,
      ...(cc && cc.length > 0 ? { cc } : {}),
      ...(bcc && bcc.length > 0 ? { bcc } : {}),
      ...(replyTo ? { replyTo } : {}),
    })

    if (sendError) {
      console.error(`Resend error for template "${templateKey}" to ${to}:`, sendError)
      return { success: false, error: sendError.message || "Resend API error" }
    }

    console.log(`Email sent: template="${templateKey}" to=${to} id=${data?.id}`)
    return { success: true, messageId: data?.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`sendTemplateEmail error:`, error)
    return { success: false, error: message }
  }
}

/**
 * Replace all {{variable_name}} placeholders with values from the variables map.
 * Missing variables are replaced with empty strings.
 */
function interpolateVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    return variables[varName] ?? ""
  })
}

/**
 * Convenience: Send a template email to multiple recipients.
 * Each recipient gets their own email (not CC'd together).
 */
export async function sendTemplateEmailBulk(
  templateKey: string,
  recipients: { to: string; variables?: Record<string, string> }[],
  options?: { from?: string; replyTo?: string }
): Promise<{ results: SendEmailResult[] }> {
  const results: SendEmailResult[] = []

  for (const recipient of recipients) {
    const result = await sendTemplateEmail({
      templateKey,
      to: recipient.to,
      variables: recipient.variables || {},
      from: options?.from,
      replyTo: options?.replyTo,
    })
    results.push(result)
  }

  return { results }
}
