import type { SupabaseClient } from "@supabase/supabase-js"

type WaitEventForBilling = {
  id: string
  event_name: string
  duration_minutes: number | null
  free_time_minutes: number | null
  charge_amount: number | null
  billable: boolean | null
  end_time: string | null
}

export function waitEventBillingTag(eventId: string): string {
  return `[wte:${eventId}]`
}

export function buildWaitEventBillingDescription(event: WaitEventForBilling): string {
  const freeMinutes = event.free_time_minutes ?? 60
  const duration = event.duration_minutes ?? 0
  return `${event.event_name} — ${duration} min (${freeMinutes} min free) ${waitEventBillingTag(event.id)}`
}

/**
 * Upsert a Detention line in load_billing when a wait event closes with charge_amount > 0.
 * Idempotent per waiting_time_events.id (tag in description).
 */
export async function syncWaitEventToLoadBilling(
  adminSupabase: SupabaseClient,
  loadId: string,
  event: WaitEventForBilling,
): Promise<boolean> {
  if (!event.end_time) return false

  const amount = Number(event.charge_amount) || 0
  if (event.billable === false || amount <= 0) return false

  const tag = waitEventBillingTag(event.id)
  const description = buildWaitEventBillingDescription(event)
  const now = new Date().toISOString()

  const { data: existing } = await adminSupabase
    .from("load_billing")
    .select("id, amount")
    .eq("load_id", loadId)
    .eq("charge_type", "Detention")
    .ilike("description", `%${tag}%`)
    .maybeSingle()

  if (existing?.id) {
    if (Number(existing.amount) !== amount) {
      await adminSupabase
        .from("load_billing")
        .update({ amount, description, updated_at: now })
        .eq("id", existing.id)
    }
    return true
  }

  const { error } = await adminSupabase.from("load_billing").insert({
    load_id: loadId,
    charge_type: "Detention",
    description,
    amount,
    created_at: now,
    updated_at: now,
  })

  return !error
}
