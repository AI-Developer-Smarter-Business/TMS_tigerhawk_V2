import type { SupabaseClient } from "@supabase/supabase-js"

/** waiting_time_events.driver_id FK → drivers(id); loads.driver_id may not match. */
export async function resolveWaitEventDriverId(
  adminSupabase: SupabaseClient,
  loadDriverId: string | null | undefined,
): Promise<string | null> {
  if (!loadDriverId) return null
  const { data } = await adminSupabase
    .from("drivers")
    .select("id")
    .eq("id", loadDriverId)
    .maybeSingle()
  return data?.id ?? null
}
