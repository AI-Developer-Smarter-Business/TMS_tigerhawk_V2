import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DriverItineraryTab } from "@/components/dispatcher/tabs/DriverItineraryTab"
import { LoadWithRelations } from "@/types/dispatcher"

async function getData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch loads with relations
  const { data: loads } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state ),
      drivers ( id, name, phone, status )
    `)
    .order("created_at", { ascending: false })

  // Fetch all drivers (chassis_number is on loads, not drivers table)
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name, phone, status, truck_number")
    .order("name")

  return {
    loads: (loads || []) as LoadWithRelations[],
    drivers: drivers || [],
  }
}

export default async function DriverItineraryPage() {
  const { loads, drivers } = await getData()

  return (
    <div className="h-[calc(100vh-180px)]">
      <DriverItineraryTab loads={loads} drivers={drivers} />
    </div>
  )
}
