import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { LoadWithRelations } from "@/types/dispatcher"
import { PlannerView } from "@/components/dispatcher/PlannerView"

type Driver = {
  id: string
  name: string
  phone: string | null
  status: string
}

async function getPlannerData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch upcoming loads (scheduled for future dates)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0]

  const { data: upcomingLoads } = await supabase
    .from("loads")
    .select(`
      *,
      customers(id, name, email, phone),
      containers(id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, seal_number, time_in, time_out, stopped_road, stopped_vessel, stopped_rail, impediment_road, equipment_type, ph_synced_at, vessel_id, vessels ( id, name, voyage_number, eta, terminal, shipping_line )),
      drivers(id, name, phone, status)
    `)
    .gte("scheduled_pickup", `${tomorrowStr}T00:00:00`)
    .order("scheduled_pickup", { ascending: true })
    .limit(100)

  // Fetch available drivers
  const { data: availableDrivers } = await supabase
    .from("drivers")
    .select("id, name, phone, status")
    .order("name")

  return {
    upcomingLoads: (upcomingLoads || []) as LoadWithRelations[],
    availableDrivers: (availableDrivers || []) as Driver[],
  }
}

export default async function PlannerPage() {
  const { upcomingLoads, availableDrivers } = await getPlannerData()

  return (
    <div className="h-screen flex flex-col">
      <PlannerView loads={upcomingLoads} drivers={availableDrivers} />
    </div>
  )
}
