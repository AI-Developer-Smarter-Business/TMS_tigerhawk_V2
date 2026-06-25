/** Shared wait-time product constants (aligned with mobile `lib/wait-time/constants.ts`). */

export const DEFAULT_FREE_WAIT_MINUTES = 60

export const DELIVERY_WAIT_EVENT_NAME = "delivery_wait" as const

export const DETENTION_WARNING_45_MINUTES = 45

export const DETENTION_WARNING_45_TEMPLATE_KEY = "detention_warning_45" as const

export const DETENTION_WARNING_45_EMAIL_SENT_ACTION =
  "detention_warning_45_email_sent" as const

export const DETENTION_WARNING_45_EMAIL_FAILED_ACTION =
  "detention_warning_45_email_failed" as const

export const DETENTION_WARNING_45_EMAIL_SKIPPED_INACTIVE_ACTION =
  "detention_warning_45_email_skipped_inactive_template" as const

export const DETENTION_WARNING_45_EMAIL_SKIPPED_NO_RECIPIENT_ACTION =
  "detention_warning_45_email_skipped_no_recipient" as const

export const DETENTION_WARNING_45_TERMINAL_ACTIONS = [
  DETENTION_WARNING_45_EMAIL_SENT_ACTION,
  DETENTION_WARNING_45_EMAIL_SKIPPED_INACTIVE_ACTION,
  DETENTION_WARNING_45_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
] as const

export const DETENTION_STARTED_TEMPLATE_KEY = "detention_started" as const

export const DETENTION_STARTED_EMAIL_SENT_ACTION =
  "detention_started_email_sent" as const

export const DETENTION_STARTED_EMAIL_FAILED_ACTION =
  "detention_started_email_failed" as const

export const DETENTION_STARTED_EMAIL_SKIPPED_INACTIVE_ACTION =
  "detention_started_email_skipped_inactive_template" as const

export const DETENTION_STARTED_EMAIL_SKIPPED_NO_RECIPIENT_ACTION =
  "detention_started_email_skipped_no_recipient" as const

export const DETENTION_STARTED_TERMINAL_ACTIONS = [
  DETENTION_STARTED_EMAIL_SENT_ACTION,
  DETENTION_STARTED_EMAIL_SKIPPED_INACTIVE_ACTION,
  DETENTION_STARTED_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
] as const

export const DETENTION_COMPLETED_TEMPLATE_KEY = "detention_completed" as const

export const DETENTION_COMPLETED_EMAIL_SENT_ACTION =
  "detention_completed_email_sent" as const

export const DETENTION_COMPLETED_EMAIL_FAILED_ACTION =
  "detention_completed_email_failed" as const

export const DETENTION_COMPLETED_EMAIL_SKIPPED_INACTIVE_ACTION =
  "detention_completed_email_skipped_inactive_template" as const

export const DETENTION_COMPLETED_EMAIL_SKIPPED_NO_RECIPIENT_ACTION =
  "detention_completed_email_skipped_no_recipient" as const

export const DETENTION_COMPLETED_TERMINAL_ACTIONS = [
  DETENTION_COMPLETED_EMAIL_SENT_ACTION,
  DETENTION_COMPLETED_EMAIL_SKIPPED_INACTIVE_ACTION,
  DETENTION_COMPLETED_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
] as const

export const DELIVERY_WAIT_FORGOTTEN_TIMER_ALERT_ACTION =
  "delivery_wait_forgotten_timer_alert" as const

/** WT.33 — IANA timezone for customer email timestamps (default US Eastern). */
export const DETENTION_EMAIL_TIMEZONE =
  process.env.DETENTION_EMAIL_TIMEZONE?.trim() || "America/New_York"

/** WT.33 — optional CC on detention customer emails (comma-separated). */
export function resolveDetentionEmailCc(): string[] {
  const raw = process.env.DETENTION_EMAIL_CC?.trim()
  if (!raw) return []
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean)
}

/** WT.33 — alert dispatch when open wait exceeds this many minutes (default 8 h). */
export const DETENTION_FORGOTTEN_TIMER_MAX_MINUTES = (() => {
  const parsed = Number(process.env.DETENTION_FORGOTTEN_TIMER_MAX_MINUTES ?? "480")
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 480
})()

export const COMPANY_CONTACT_EMAIL =
  process.env.COMPANY_CONTACT_EMAIL ?? "dispatch@tigerhawklogistics.com"

export const COMPANY_CONTACT_PHONE = process.env.COMPANY_CONTACT_PHONE ?? ""
