import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DispatcherClient } from "@/components/dispatcher/DispatcherClient"
import { LoadWithRelations, PipelineCounts } from "@/types/dispatcher"

async function getDispatcherData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch loads with relations (full tracking join, falls back to safe join if columns not migrated)
  const FULL_JOIN = `*, customers ( id, name, email, phone, address, city, state, zip_code ), containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, seal_number, time_in, time_out, stopped_road, stopped_vessel, stopped_rail, impediment_road, equipment_type, ph_synced_at, vessel_id, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ), drivers ( id, name, phone, status )`
  const SAFE_JOIN = `*, customers ( id, name, email, phone, address, city, state, zip_code ), containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, seal_number, vessel_id, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ), drivers ( id, name, phone, status )`

  let { data: loads } = await supabase
    .from("loads")
    .select(FULL_JOIN)
    .order("created_at", { ascending: false })

  // If full join fails (tracking columns not yet migrated), try safe join
  if (!loads) {
    const fallback = await supabase
      .from("loads")
      .select(SAFE_JOIN)
      .order("created_at", { ascending: false })
    loads = fallback.data
  }

  // Calculate pipeline counts — must match client-side logic in DispatcherClient.tsx
  const ll = loads || []
  const today = new Date().toDateString()

  const arrivingStatuses = ["Created", "Pending", "Available", "Customs Hold", "Freight Released"]
  const pickupStatuses = ["Available", "Freight Released", "Assigned", "Dispatched"]
  const deliveryStatuses = ["Arrived At Pickup", "In Transit", "At Warehouse"]
  const returnStatuses = ["Delivered", "Arrived At Delivery", "Arrived At Return Empty"]
  const droppedStatuses = ["Delivered", "Arrived At Delivery"]

  const arriving = ll.filter((l: any) => arrivingStatuses.includes(l.status))
  const needPickup = ll.filter((l: any) => pickupStatuses.includes(l.status) && !l.actual_pickup)
  const needDelivery = ll.filter((l: any) => deliveryStatuses.includes(l.status))
  const needReturn = ll.filter((l: any) => returnStatuses.includes(l.status))
  const dropped = ll.filter((l: any) => droppedStatuses.includes(l.status))

  const pipelineCounts: PipelineCounts = {
    arrivingOnVessel: arriving.length,
    arrivingOnHold: arriving.filter((l: any) =>
      l.customs_hold === "hold" || l.freight_hold === "hold" ||
      l.terminal_hold === "hold" || l.fees_hold === "hold" ||
      l.carrier_hold === true || l.other_hold === "hold"
    ).length,
    arrivingReleased: arriving.filter((l: any) =>
      l.customs_hold !== "hold" && l.freight_hold !== "hold" &&
      l.terminal_hold !== "hold" && l.fees_hold !== "hold" &&
      l.carrier_hold !== true && l.other_hold !== "hold"
    ).length,
    needPickup: needPickup.length,
    needPickupLFD: needPickup.filter((l: any) =>
      l.containers?.last_free_day && new Date(l.containers.last_free_day) < new Date()
    ).length,
    needPickupApt: needPickup.filter((l: any) => l.pickup_apt_from && l.pickup_apt_to).length,
    needDelivery: needDelivery.length,
    needDeliveryAtTerminal: needDelivery.filter((l: any) => l.status === "At Warehouse" || l.status === "Arrived At Pickup").length,
    needDeliveryInYard: needDelivery.filter((l: any) => l.status === "In Transit").length,
    needReturn: needReturn.length,
    needReturnReady: needReturn.filter((l: any) => !!l.ready_to_return_date).length,
    needReturnNotReady: needReturn.filter((l: any) => !l.ready_to_return_date).length,
    dropped: dropped.length,
    droppedInYard: dropped.filter((l: any) => !!l.ingate_date).length,
    droppedAtCustomer: dropped.filter((l: any) => !l.ingate_date).length,
    dispatched: ll.filter((l: any) => l.status === "Dispatched").length,
    finishedToday: ll.filter((l: any) =>
      l.status === "Completed" && l.completed_date &&
      new Date(l.completed_date).toDateString() === today
    ).length,
  }

  // Fetch available drivers
  const { data: availableDrivers } = await supabase
    .from("drivers")
    .select("id, name, phone, status")
    .neq("enabled", false)
    .not("status", "in", '("Inactive","Terminated")')
    .order("name")

  return {
    loads: loads || [] as LoadWithRelations[],
    pipelineCounts,
    availableDrivers: availableDrivers || [],
  }
}

export default async function DispatcherPage() {
  const { loads, pipelineCounts, availableDrivers } = await getDispatcherData()

  return (
    <DispatcherClient
      loads={loads}
      pipelineCounts={pipelineCounts}
      availableDrivers={availableDrivers}
    />
  )
}
