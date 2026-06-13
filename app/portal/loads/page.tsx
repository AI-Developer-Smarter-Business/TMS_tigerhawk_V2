// app/portal/loads/page.tsx
// Active Loads — customer's in-progress shipments
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PortalLoadsTable } from "@/components/portal/PortalLoadsTable"
import { PortalLoad, ACTIVE_LOAD_STATUSES } from "@/types/portal"

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
  vessel_name,
  voyage,
  scheduled_pickup,
  actual_pickup,
  actual_delivery,
  pickup_apt_from,
  pickup_apt_to,
  delivery_apt_from,
  delivery_apt_to,
  outgate_date,
  per_diem_free_day,
  created_at,
  updated_at,
  customer_id,
  container_id,
  driver_id,
  chassis_number,
  commodity,
  total_weight,
  is_hazmat,
  is_hot,
  is_overweight,
  shipment_number,
  purchase_order,
  mbol,
  house_bol,
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

export default async function PortalActiveLoadsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/portal/login")

  // Fetch active loads (RLS automatically scopes to customer)
  const { data: loads, error } = await supabase
    .from("loads")
    .select(LOAD_SELECT)
    .in("status", ACTIVE_LOAD_STATUSES)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[Portal Active Loads] Query error:", error.message, error.details, error.hint)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Active Loads</h1>
        <p className="text-sm text-gray-400 mt-1">
          Your in-progress shipments ({loads?.length || 0})
        </p>
      </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <p className="text-sm text-red-400">Failed to load data: {error.message}</p>
        </div>
      )}
      <PortalLoadsTable loads={(loads || []) as unknown as PortalLoad[]} showDateColumn="updated" />
    </div>
  )
}
