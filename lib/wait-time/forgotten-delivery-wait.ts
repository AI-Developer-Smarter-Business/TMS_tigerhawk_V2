import type { SupabaseClient } from "@supabase/supabase-js"

import {
  DELIVERY_WAIT_FORGOTTEN_TIMER_ALERT_ACTION,
  DELIVERY_WAIT_EVENT_NAME,
  DETENTION_FORGOTTEN_TIMER_MAX_MINUTES,
} from "@/lib/wait-time/constants"
import { resolveWaitEventDurationMinutes } from "@/lib/wait-time/resolve-event-duration-minutes"
import type { WaitEventEmailRow } from "@/lib/wait-time/detention-email-shared"

export function shouldAlertForgottenDeliveryWait(
  event: Pick<WaitEventEmailRow, "event_name" | "start_time" | "end_time" | "duration_minutes">,
  nowMs: number = Date.now(),
): boolean {
  if (event.event_name !== DELIVERY_WAIT_EVENT_NAME) return false
  if (!event.start_time || event.end_time) return false

  const durationMinutes = resolveWaitEventDurationMinutes(event, nowMs)
  return durationMinutes >= DETENTION_FORGOTTEN_TIMER_MAX_MINUTES
}

/** WT.33 — one-time dispatcher alert when driver left timer running too long. */
export async function maybeAlertForgottenDeliveryWait(
  adminSupabase: SupabaseClient,
  event: WaitEventEmailRow,
  actorUserId: string,
): Promise<boolean> {
  if (!shouldAlertForgottenDeliveryWait(event)) return false

  const { data: existing } = await adminSupabase
    .from("activity_log")
    .select("id")
    .eq("entity_type", "waiting_time_event")
    .eq("entity_id", event.id)
    .eq("action", DELIVERY_WAIT_FORGOTTEN_TIMER_ALERT_ACTION)
    .limit(1)
    .maybeSingle()

  if (existing) return false

  const durationMinutes = resolveWaitEventDurationMinutes(event)

  await adminSupabase.from("activity_log").insert({
    entity_type: "waiting_time_event",
    entity_id: event.id,
    action: DELIVERY_WAIT_FORGOTTEN_TIMER_ALERT_ACTION,
    user_id: actorUserId,
    details: {
      type: "delivery_wait_forgotten_timer",
      load_id: event.load_id,
      event_id: event.id,
      duration_minutes: durationMinutes,
      max_minutes: DETENTION_FORGOTTEN_TIMER_MAX_MINUTES,
    },
  })

  return true
}
