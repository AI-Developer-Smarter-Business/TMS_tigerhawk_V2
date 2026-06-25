import type { SupabaseClient } from "@supabase/supabase-js"

import { DELIVERY_WAIT_EVENT_NAME } from "@/lib/wait-time/constants"
import type { WaitEventEmailRow } from "@/lib/wait-time/detention-email-shared"
import { notifyOpenDeliveryWaitSideEffects } from "@/lib/wait-time/notify-delivery-wait-customer-emails"
import { maybeNotifyWaitExceeded } from "@/lib/wait-time/notify-exceeded"
import { resolveWaitEventDurationMinutes } from "@/lib/wait-time/resolve-event-duration-minutes"

const OPEN_WAIT_SELECT =
  "id, load_id, driver_id, event_name, start_time, end_time, duration_minutes, free_time_minutes, charge_amount, billable, rate_per_hour"

export async function syncOpenWaitDurationFromServer(
  adminSupabase: SupabaseClient,
  event: WaitEventEmailRow,
  nowMs: number = Date.now(),
): Promise<WaitEventEmailRow> {
  if (!event.start_time || event.end_time) return event

  const serverDuration = resolveWaitEventDurationMinutes(event, nowMs)
  const storedDuration = Number(event.duration_minutes) || 0

  if (serverDuration <= storedDuration) return event

  const { data: updated, error } = await adminSupabase
    .from("waiting_time_events")
    .update({ duration_minutes: serverDuration })
    .eq("id", event.id)
    .select(OPEN_WAIT_SELECT)
    .single()

  if (error || !updated) {
    console.error("[WT.32] duration sync failed:", error?.message)
    return { ...event, duration_minutes: serverDuration }
  }

  return updated as WaitEventEmailRow
}

export type ProcessOpenDeliveryWaitEmailsResult = {
  scanned: number
  synced: number
  emailsTriggered: number
  forgottenAlerts: number
}

/** WT.32 — scan open delivery waits; sync server duration; send 45/60 emails offline-safe. */
export async function processOpenDeliveryWaitEmails(
  adminSupabase: SupabaseClient,
  actorUserId: string,
  nowMs: number = Date.now(),
): Promise<ProcessOpenDeliveryWaitEmailsResult> {
  const { data: events, error } = await adminSupabase
    .from("waiting_time_events")
    .select(OPEN_WAIT_SELECT)
    .eq("event_name", DELIVERY_WAIT_EVENT_NAME)
    .not("start_time", "is", null)
    .is("end_time", null)

  if (error) {
    console.error("[WT.32] open wait scan failed:", error.message)
    return { scanned: 0, synced: 0, emailsTriggered: 0, forgottenAlerts: 0 }
  }

  let synced = 0

  for (const raw of events ?? []) {
    const event = raw as WaitEventEmailRow
    const beforeDuration = Number(event.duration_minutes) || 0
    const syncedEvent = await syncOpenWaitDurationFromServer(adminSupabase, event, nowMs)
    if ((Number(syncedEvent.duration_minutes) || 0) > beforeDuration) synced += 1

    const { data: load } = await adminSupabase
      .from("loads")
      .select("id, reference_number, driver_id")
      .eq("id", syncedEvent.load_id)
      .maybeSingle()

    if (load) {
      await maybeNotifyWaitExceeded(
        adminSupabase,
        {
          id: syncedEvent.id,
          load_id: syncedEvent.load_id,
          driver_id: (syncedEvent as WaitEventEmailRow & { driver_id?: string | null }).driver_id ?? null,
          duration_minutes: syncedEvent.duration_minutes ?? 0,
          free_time_minutes: syncedEvent.free_time_minutes ?? 60,
          charge_amount: syncedEvent.charge_amount ?? null,
          billable: syncedEvent.billable ?? true,
        },
        load,
        actorUserId,
      )
    }

    await notifyOpenDeliveryWaitSideEffects(adminSupabase, syncedEvent, actorUserId)
  }

  return {
    scanned: events?.length ?? 0,
    synced,
    emailsTriggered: events?.length ?? 0,
    forgottenAlerts: 0,
  }
}
