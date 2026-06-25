import type { SupabaseClient } from "@supabase/supabase-js"

import { maybeNotifyWaitExceeded } from "@/lib/wait-time/notify-exceeded"
import { notifyDeliveryWaitCustomerEmails } from "@/lib/wait-time/notify-delivery-wait-customer-emails"
import { syncWaitEventToLoadBilling } from "@/lib/wait-time/sync-load-billing"

export const OPEN_DELIVERY_WAIT_SELECT =
  "id, load_id, driver_id, event_name, start_time, end_time, duration_minutes, free_time_minutes, billable, charge_amount, driver_pay_amount, notes"

function computeDurationMinutes(startTime: string, endTime: string): number {
  return Math.max(
    0,
    Math.round(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000,
    ),
  )
}

export type CloseOpenDeliveryWaitResult =
  | { status: "closed"; event: Record<string, unknown> }
  | { status: "no_open_event" }
  | { status: "error"; message: string }

/** Close the newest open `delivery_wait` on a load (shared by manual PATCH, geofence, e-POD). */
export async function closeOpenDeliveryWaitEvent(
  adminSupabase: SupabaseClient,
  params: {
    loadId: string
    endTime?: string
    actorUserId: string
    appendNotes?: string
  },
): Promise<CloseOpenDeliveryWaitResult> {
  const { data: openEvent, error: fetchError } = await adminSupabase
    .from("waiting_time_events")
    .select(OPEN_DELIVERY_WAIT_SELECT)
    .eq("load_id", params.loadId)
    .eq("event_name", "delivery_wait")
    .not("start_time", "is", null)
    .is("end_time", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    return { status: "error", message: fetchError.message }
  }
  if (!openEvent?.start_time) {
    return { status: "no_open_event" }
  }

  const endTime = params.endTime ?? new Date().toISOString()
  const durationMinutes = computeDurationMinutes(openEvent.start_time, endTime)

  const updatePayload: Record<string, unknown> = {
    end_time: endTime,
    duration_minutes: durationMinutes,
  }

  if (params.appendNotes) {
    const existing = (openEvent.notes as string | null) ?? ""
    updatePayload.notes = existing
      ? `${existing}\n${params.appendNotes}`
      : params.appendNotes
  }

  const { data: event, error: updateError } = await adminSupabase
    .from("waiting_time_events")
    .update(updatePayload)
    .eq("id", openEvent.id)
    .select(OPEN_DELIVERY_WAIT_SELECT)
    .single()

  if (updateError || !event) {
    return {
      status: "error",
      message: updateError?.message ?? "Failed to close delivery wait event",
    }
  }

  const { data: load } = await adminSupabase
    .from("loads")
    .select("id, reference_number, driver_id")
    .eq("id", params.loadId)
    .single()

  if (load) {
    await maybeNotifyWaitExceeded(
      adminSupabase,
      {
        id: event.id as string,
        load_id: event.load_id as string,
        driver_id: (event.driver_id as string | null) ?? null,
        duration_minutes: (event.duration_minutes as number | null) ?? 0,
        free_time_minutes: (event.free_time_minutes as number | null) ?? 60,
        charge_amount: (event.charge_amount as number | null) ?? null,
        billable: (event.billable as boolean | null) ?? true,
      },
      load,
      params.actorUserId,
    )
    await syncWaitEventToLoadBilling(adminSupabase, params.loadId, event)
    await notifyDeliveryWaitCustomerEmails(
      adminSupabase,
      {
        id: event.id as string,
        load_id: event.load_id as string,
        event_name: event.event_name as string,
        start_time: event.start_time as string,
        end_time: event.end_time as string,
        duration_minutes: (event.duration_minutes as number | null) ?? null,
        free_time_minutes: (event.free_time_minutes as number | null) ?? null,
        charge_amount: (event.charge_amount as number | null) ?? null,
        billable: (event.billable as boolean | null) ?? null,
      },
      params.actorUserId,
    )
  }

  return { status: "closed", event }
}
