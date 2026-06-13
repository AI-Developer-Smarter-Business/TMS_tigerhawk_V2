import type { SupabaseClient } from "@supabase/supabase-js"

type WaitEventRow = {
  id: string
  load_id: string
  driver_id: string | null
  duration_minutes: number | null
  free_time_minutes: number | null
  charge_amount: number | null
  billable: boolean | null
}

type LoadRow = {
  id: string
  reference_number: string | null
  driver_id: string | null
}

export function computeBillableMinutes(
  durationMinutes: number,
  freeTimeMinutes: number = 60,
): number {
  return Math.max(0, durationMinutes - freeTimeMinutes)
}

/**
 * Inserts a single activity_log row when billable wait time crosses the free threshold.
 * Idempotent per event id (WT.11 feed + WT.12 toast trigger on client via Realtime).
 */
export async function maybeNotifyWaitExceeded(
  adminSupabase: SupabaseClient,
  event: WaitEventRow,
  load: LoadRow,
  actorUserId: string,
): Promise<boolean> {
  const duration = Number(event.duration_minutes) || 0
  const freeMinutes = Number(event.free_time_minutes) || 60
  const billableMinutes = computeBillableMinutes(duration, freeMinutes)
  if (billableMinutes <= 0) return false

  const { data: existing } = await adminSupabase
    .from("activity_log")
    .select("id")
    .eq("entity_type", "waiting_time_event")
    .eq("entity_id", event.id)
    .eq("action", "waiting_time_exceeded")
    .limit(1)
    .maybeSingle()

  if (existing) return false

  const { error } = await adminSupabase.from("activity_log").insert({
    entity_type: "waiting_time_event",
    entity_id: event.id,
    action: "waiting_time_exceeded",
    user_id: actorUserId,
    details: {
      type: "waiting_time_exceeded",
      load_id: load.id,
      reference_number: load.reference_number,
      event_id: event.id,
      billable_minutes: billableMinutes,
      driver_id: event.driver_id ?? load.driver_id,
      charge_amount: event.charge_amount,
    },
  })

  return !error
}
