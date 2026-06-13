// app/portal/page.tsx
// Customer Portal Dashboard — overview cards + recent activity
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PortalDashboardClient } from "@/components/portal/PortalDashboardClient"
import {
  PortalLoad,
  ACTIVE_LOAD_STATUSES,
  COMPLETED_LOAD_STATUSES,
  IN_TRANSIT_STATUSES,
} from "@/types/portal"

// Lightweight select for the recent-activity table (no deep joins needed)
const RECENT_ACTIVITY_SELECT = `
  id,
  reference_number,
  status,
  load_type,
  container_size,
  ssl,
  pickup_location,
  delivery_location,
  vessel_eta,
  actual_delivery,
  created_at,
  updated_at,
  customer_id,
  containers (
    id,
    container_number,
    size,
    shipping_line,
    last_free_day,
    status,
    type,
    bol_number,
    transit_state,
    seal_number,
    time_in,
    time_out,
    stopped_road,
    stopped_vessel,
    stopped_rail,
    impediment_road,
    equipment_type,
    ph_synced_at,
    vessel_id,
    vessels (
      id, name, voyage_number, eta, terminal, shipping_line
    )
  ),
  customers (
    id, name
  ),
  drivers (
    id, name, phone, status
  )
`

export default async function PortalDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/portal/login")

  // Run all queries in parallel — count queries use head:true to avoid
  // transferring rows; only the count is returned. RLS scopes all automatically.
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    activeResult,
    inTransitResult,
    deliveredResult,
    pendingResult,
    recentResult,
  ] = await Promise.all([
    // Count: active loads
    supabase
      .from("loads")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_LOAD_STATUSES as string[]),

    // Count: in-transit loads
    supabase
      .from("loads")
      .select("id", { count: "exact", head: true })
      .in("status", IN_TRANSIT_STATUSES as string[]),

    // Count: delivered/completed in last 30 days
    supabase
      .from("loads")
      .select("id", { count: "exact", head: true })
      .in("status", COMPLETED_LOAD_STATUSES as string[])
      .gte("updated_at", thirtyDaysAgo.toISOString()),

    // Count: pending/created loads
    supabase
      .from("loads")
      .select("id", { count: "exact", head: true })
      .in("status", ["Pending", "Created"]),

    // Recent activity: only the 10 most recent loads with minimal joins
    supabase
      .from("loads")
      .select(RECENT_ACTIVITY_SELECT)
      .order("updated_at", { ascending: false })
      .limit(10),
  ])

  // Log any query errors
  for (const [label, result] of [
    ["active", activeResult],
    ["inTransit", inTransitResult],
    ["delivered30", deliveredResult],
    ["pending", pendingResult],
    ["recent", recentResult],
  ] as const) {
    if (result.error) {
      console.error(`[Portal Dashboard] ${label} query error:`, result.error.message)
    }
  }

  const recentActivity = (recentResult.data || []) as unknown as PortalLoad[]

  return (
    <PortalDashboardClient
      summary={{
        activeLoads: activeResult.count ?? 0,
        inTransit: inTransitResult.count ?? 0,
        deliveredLast30: deliveredResult.count ?? 0,
        pending: pendingResult.count ?? 0,
      }}
      recentActivity={recentActivity}
    />
  )
}
