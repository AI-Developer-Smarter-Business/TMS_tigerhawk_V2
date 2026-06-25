import type { SupabaseClient } from "@supabase/supabase-js"

import {
  fetchLoadEmailContext,
  hasDetentionEmailTerminalLog,
  sendDetentionCustomerEmail,
  type LoadEmailContext,
  type WaitEventEmailRow,
} from "@/lib/wait-time/detention-email-shared"
import {
  COMPANY_CONTACT_EMAIL,
  COMPANY_CONTACT_PHONE,
  DEFAULT_FREE_WAIT_MINUTES,
  DELIVERY_WAIT_EVENT_NAME,
  DETENTION_WARNING_45_EMAIL_FAILED_ACTION,
  DETENTION_WARNING_45_EMAIL_SENT_ACTION,
  DETENTION_WARNING_45_EMAIL_SKIPPED_INACTIVE_ACTION,
  DETENTION_WARNING_45_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
  DETENTION_WARNING_45_MINUTES,
  DETENTION_WARNING_45_TEMPLATE_KEY,
  DETENTION_WARNING_45_TERMINAL_ACTIONS,
} from "@/lib/wait-time/constants"
import {
  formatWaitEmailTimestamp,
  resolveWaitEventDurationMinutes,
} from "@/lib/wait-time/resolve-event-duration-minutes"

export {
  normalizeLoadEmailContext,
  type LoadEmailContext,
  type LoadEmailRow,
} from "@/lib/wait-time/detention-email-shared"

export function shouldSendDetentionWarning45(
  event: Pick<WaitEventEmailRow, "event_name" | "end_time" | "start_time" | "duration_minutes">,
  nowMs: number = Date.now(),
): boolean {
  if (event.event_name !== DELIVERY_WAIT_EVENT_NAME) return false
  if (!event.start_time || event.end_time) return false

  const durationMinutes = resolveWaitEventDurationMinutes(event, nowMs)
  return durationMinutes >= DETENTION_WARNING_45_MINUTES
}

export function buildDetentionWarning45Variables(
  load: LoadEmailContext,
  event: WaitEventEmailRow,
  durationMinutes: number,
): Record<string, string> {
  const freeMinutes = Number(event.free_time_minutes) || DEFAULT_FREE_WAIT_MINUTES
  const minutesUntilBillable = Math.max(0, freeMinutes - durationMinutes)

  return {
    customer_name: load.customers?.name?.trim() || "Customer",
    reference_number: load.reference_number?.trim() || "",
    container_number: load.containers?.container_number?.trim() || "—",
    delivery_location: load.delivery_location?.trim() || "delivery site",
    wait_start_time: event.start_time
      ? formatWaitEmailTimestamp(event.start_time)
      : "",
    free_minutes: String(freeMinutes),
    minutes_elapsed: String(durationMinutes),
    minutes_until_billable: String(minutesUntilBillable),
    company_contact_email: COMPANY_CONTACT_EMAIL,
    company_phone: COMPANY_CONTACT_PHONE,
  }
}

const WARNING_45_CONFIG = {
  templateKey: DETENTION_WARNING_45_TEMPLATE_KEY,
  logType: "detention_warning_45_email",
  terminalActions: DETENTION_WARNING_45_TERMINAL_ACTIONS,
  sentAction: DETENTION_WARNING_45_EMAIL_SENT_ACTION,
  failedAction: DETENTION_WARNING_45_EMAIL_FAILED_ACTION,
  skippedInactiveAction: DETENTION_WARNING_45_EMAIL_SKIPPED_INACTIVE_ACTION,
  skippedNoRecipientAction: DETENTION_WARNING_45_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
} as const

/** WT.29 — send `detention_warning_45` when open delivery wait ≥ 45 min. */
export async function maybeNotifyDetentionWarning45(
  adminSupabase: SupabaseClient,
  event: WaitEventEmailRow,
  actorUserId: string,
): Promise<boolean> {
  if (!shouldSendDetentionWarning45(event)) return false

  if (await hasDetentionEmailTerminalLog(adminSupabase, event.id, WARNING_45_CONFIG.terminalActions)) {
    return false
  }

  const durationMinutes = resolveWaitEventDurationMinutes(event)
  const load = await fetchLoadEmailContext(adminSupabase, event.load_id)
  if (!load) return false

  return sendDetentionCustomerEmail(adminSupabase, {
    event,
    actorUserId,
    load,
    durationMinutes,
    config: WARNING_45_CONFIG,
    variables: buildDetentionWarning45Variables(load, event, durationMinutes),
  })
}
