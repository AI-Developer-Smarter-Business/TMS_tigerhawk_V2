// app/portal/history/page.tsx
// Completed/cancelled loads history
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PortalLoadsTable } from "@/components/portal/PortalLoadsTable"
import { PortalLoad, COMPLETED_LOAD_STATUSES } from "@/types/portal"

const LOAD_SELECT = `
  id,
  reference_number,
  status,
  load_type,
  route_type,
  container_size,
  ssl,
  pickup_location,
  delivery_location,
  return_location,
  vessel_eta,
  actual_pickup,
  actual_delivery,
  created_at,
  updated_at,
  completed_date,
  customer_id,
  container_id,
  driver_id,
  shipment_number,
  purchase_order,
  mbol,
  house_bol,
  commodity,
  total_weight,
  is_hazmat,
  is_hot,
  is_overweight,
  notes,
  freight_hold,
  customs_hold,
  terminal_hold,
  fees_hold,
  containers (
    id,
    container_number,
    bol_number,
    size,
    type,
    status,
    last_free_day,
    shipping_line,
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
    id, name, email, phone, address, city, state, zip_code
  ),
  drivers (
    id, name, phone, status
  )
`

export default async function PortalHistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/portal/login")

  // Fetch completed loads (RLS scopes to customer)
  const { data: loads, error } = await supabase
    .from("loads")
    .select(LOAD_SELECT)
    .in("status", COMPLETED_LOAD_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[Portal History] Query error:", error.message, error.details, error.hint)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="text-sm text-gray-400 mt-1">
          Completed and cancelled loads ({loads?.length || 0})
        </p>
      </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">Failed to load data: {error.message}</p>
        </div>
      )}
      <PortalLoadsTable loads={(loads || []) as unknown as PortalLoad[]} showDateColumn="completed" />
    </div>
  )
}
