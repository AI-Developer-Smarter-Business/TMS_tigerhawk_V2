import type { SupabaseClient } from "@supabase/supabase-js"

import { computeBillableMinutes } from "@/lib/wait-time/notify-exceeded"
import {
  fetchLoadEmailContext,
  formatDetentionUsd,
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
  DETENTION_COMPLETED_EMAIL_FAILED_ACTION,
  DETENTION_COMPLETED_EMAIL_SENT_ACTION,
  DETENTION_COMPLETED_EMAIL_SKIPPED_INACTIVE_ACTION,
  DETENTION_COMPLETED_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
  DETENTION_COMPLETED_TEMPLATE_KEY,
  DETENTION_COMPLETED_TERMINAL_ACTIONS,
} from "@/lib/wait-time/constants"
import {
  formatWaitEmailTimestamp,
  resolveWaitEventDurationMinutes,
} from "@/lib/wait-time/resolve-event-duration-minutes"

export function shouldSendDetentionCompleted(
  event: Pick<WaitEventEmailRow, "event_name" | "end_time" | "start_time">,
): boolean {
  return (
    event.event_name === DELIVERY_WAIT_EVENT_NAME &&
    Boolean(event.start_time && event.end_time)
  )
}

export function buildDetentionCompletedVariables(
  load: LoadEmailContext,
  event: WaitEventEmailRow,
  durationMinutes: number,
): Record<string, string> {
  const freeMinutes = Number(event.free_time_minutes) || DEFAULT_FREE_WAIT_MINUTES
  const billableMinutes = computeBillableMinutes(durationMinutes, freeMinutes)

  return {
    customer_name: load.customers?.name?.trim() || "Customer",
    reference_number: load.reference_number?.trim() || "",
    container_number: load.containers?.container_number?.trim() || "—",
    delivery_location: load.delivery_location?.trim() || "delivery site",
    wait_start_time: event.start_time
      ? formatWaitEmailTimestamp(event.start_time)
      : "",
    wait_end_time: event.end_time
      ? formatWaitEmailTimestamp(event.end_time)
      : "",
    total_minutes: String(durationMinutes),
    free_minutes: String(freeMinutes),
    billable_minutes: String(billableMinutes),
    estimated_charge: formatDetentionUsd(event.charge_amount),
    company_contact_email: COMPANY_CONTACT_EMAIL,
    company_phone: COMPANY_CONTACT_PHONE,
  }
}

const COMPLETED_CONFIG = {
  templateKey: DETENTION_COMPLETED_TEMPLATE_KEY,
  logType: "detention_completed_email",
  terminalActions: DETENTION_COMPLETED_TERMINAL_ACTIONS,
  sentAction: DETENTION_COMPLETED_EMAIL_SENT_ACTION,
  failedAction: DETENTION_COMPLETED_EMAIL_FAILED_ACTION,
  skippedInactiveAction: DETENTION_COMPLETED_EMAIL_SKIPPED_INACTIVE_ACTION,
  skippedNoRecipientAction: DETENTION_COMPLETED_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
} as const

/** WT.31 — send `detention_completed` summary when wait closes. */
export async function maybeNotifyDetentionCompleted(
  adminSupabase: SupabaseClient,
  event: WaitEventEmailRow,
  actorUserId: string,
): Promise<boolean> {
  if (!shouldSendDetentionCompleted(event)) return false

  if (await hasDetentionEmailTerminalLog(adminSupabase, event.id, COMPLETED_CONFIG.terminalActions)) {
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
    config: COMPLETED_CONFIG,
    variables: buildDetentionCompletedVariables(load, event, durationMinutes),
  })
}
