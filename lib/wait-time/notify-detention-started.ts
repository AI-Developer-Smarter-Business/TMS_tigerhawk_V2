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
  DETENTION_STARTED_EMAIL_FAILED_ACTION,
  DETENTION_STARTED_EMAIL_SENT_ACTION,
  DETENTION_STARTED_EMAIL_SKIPPED_INACTIVE_ACTION,
  DETENTION_STARTED_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
  DETENTION_STARTED_TEMPLATE_KEY,
  DETENTION_STARTED_TERMINAL_ACTIONS,
} from "@/lib/wait-time/constants"
import {
  formatWaitEmailTimestamp,
  resolveWaitEventDurationMinutes,
} from "@/lib/wait-time/resolve-event-duration-minutes"

export function shouldSendDetentionStarted(
  event: Pick<WaitEventEmailRow, "event_name" | "end_time" | "start_time" | "duration_minutes" | "free_time_minutes">,
  nowMs: number = Date.now(),
): boolean {
  if (event.event_name !== DELIVERY_WAIT_EVENT_NAME) return false
  if (!event.start_time || event.end_time) return false

  const freeMinutes = Number(event.free_time_minutes) || DEFAULT_FREE_WAIT_MINUTES
  const durationMinutes = resolveWaitEventDurationMinutes(event, nowMs)
  return durationMinutes >= freeMinutes
}

export function buildDetentionStartedVariables(
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
    free_minutes: String(freeMinutes),
    minutes_elapsed: String(durationMinutes),
    billable_minutes: String(billableMinutes),
    estimated_charge: formatDetentionUsd(event.charge_amount),
    company_contact_email: COMPANY_CONTACT_EMAIL,
    company_phone: COMPANY_CONTACT_PHONE,
  }
}

const STARTED_CONFIG = {
  templateKey: DETENTION_STARTED_TEMPLATE_KEY,
  logType: "detention_started_email",
  terminalActions: DETENTION_STARTED_TERMINAL_ACTIONS,
  sentAction: DETENTION_STARTED_EMAIL_SENT_ACTION,
  failedAction: DETENTION_STARTED_EMAIL_FAILED_ACTION,
  skippedInactiveAction: DETENTION_STARTED_EMAIL_SKIPPED_INACTIVE_ACTION,
  skippedNoRecipientAction: DETENTION_STARTED_EMAIL_SKIPPED_NO_RECIPIENT_ACTION,
} as const

/** WT.30 — send `detention_started` when free time (60 min) is exceeded. */
export async function maybeNotifyDetentionStarted(
  adminSupabase: SupabaseClient,
  event: WaitEventEmailRow,
  actorUserId: string,
): Promise<boolean> {
  if (!shouldSendDetentionStarted(event)) return false

  if (await hasDetentionEmailTerminalLog(adminSupabase, event.id, STARTED_CONFIG.terminalActions)) {
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
    config: STARTED_CONFIG,
    variables: buildDetentionStartedVariables(load, event, durationMinutes),
  })
}
