// app/api/dispatcher/loads/pipeline/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { PipelineCounts } from "@/types/dispatcher"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher", "driver"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Fetch all loads with container status
    const { data: loads, error: loadsError } = await supabase
      .from("loads")
      .select(`
        id,
        status,
        actual_pickup,
        actual_delivery,
        completed_date,
        created_at,
        pickup_apt_from,
        containers (
          status,
          transit_state,
          last_free_day
        )
      `)

    if (loadsError) {
      console.error("Loads fetch error:", loadsError)
      return NextResponse.json(
        { error: loadsError.message || "Failed to fetch loads" },
        { status: 500 }
      )
    }

    // Calculate pipeline counts based on load and container status
    const counts: PipelineCounts = {
      arrivingOnVessel: 0,
      arrivingOnHold: 0,
      arrivingReleased: 0,
      needPickup: 0,
      needPickupLFD: 0,
      needPickupApt: 0,
      needDelivery: 0,
      needDeliveryAtTerminal: 0,
      needDeliveryInYard: 0,
      needReturn: 0,
      needReturnReady: 0,
      needReturnNotReady: 0,
      dropped: 0,
      droppedInYard: 0,
      droppedAtCustomer: 0,
      dispatched: 0,
      finishedToday: 0,
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    loads.forEach((load) => {
      const container = load.containers ? (Array.isArray(load.containers) ? load.containers[0] : load.containers) : null

      // Arriving on Vessel
      if (container?.status === "On Vessel" || container?.transit_state === "In Transit") {
        counts.arrivingOnVessel++
      }

      // Need Pickup - Available or Freight Released with no actual_pickup
      if (
        (load.status === "Available" || load.status === "Freight Released") &&
        !load.actual_pickup
      ) {
        counts.needPickup++

        // Check for LFD (Last Free Day)
        if (container?.last_free_day) {
          const lfdDate = new Date(container.last_free_day)
          lfdDate.setHours(0, 0, 0, 0)
          if (lfdDate <= today) {
            counts.needPickupLFD++
          }
        }

        // Count loads that have an appointment set
        if (load.actual_pickup || (load as Record<string, unknown>).pickup_apt_from) {
          counts.needPickupApt++
        }
      }

      // Need Delivery - Dispatched or In Transit with no actual_delivery
      if (
        (load.status === "Dispatched" || load.status === "In Transit") &&
        !load.actual_delivery
      ) {
        counts.needDelivery++

        // Determine if at terminal or in yard (basic heuristic - could be enhanced)
        if (container?.transit_state === "At Terminal") {
          counts.needDeliveryAtTerminal++
        } else {
          counts.needDeliveryInYard++
        }
      }

      // Need Return - Delivered with no return completed
      if (load.status === "Delivered") {
        counts.needReturn++

        // Check if ready to return based on LFD
        if (container?.last_free_day) {
          const readyDate = new Date(container.last_free_day)
          readyDate.setHours(0, 0, 0, 0)
          if (readyDate <= today) {
            counts.needReturnReady++
          } else {
            counts.needReturnNotReady++
          }
        } else {
          counts.needReturnReady++
        }
      }

      // Dropped - container dropped off at customer or yard
      if (container?.transit_state === "Dropped At Customer" || container?.transit_state === "Dropped In Yard") {
        counts.dropped++

        if (container.transit_state === "Dropped In Yard") {
          counts.droppedInYard++
        } else if (container.transit_state === "Dropped At Customer") {
          counts.droppedAtCustomer++
        }
      }

      // Dispatched
      if (load.status === "Dispatched") {
        counts.dispatched++
      }

      // Finished Today - completed today
      if (load.completed_date) {
        const completedDate = new Date(load.completed_date)
        completedDate.setHours(0, 0, 0, 0)
        if (completedDate.getTime() === today.getTime()) {
          counts.finishedToday++
        }
      }
    })

    // Set arriving on hold/released counts (these would need additional holds data)
    // For now, estimate based on status
    counts.arrivingOnHold = loads.filter((l) => l.status === "Customs Hold").length
    counts.arrivingReleased = loads.filter((l) => l.status === "Freight Released").length

    return NextResponse.json(counts)
  } catch (error) {
    console.error("Error calculating pipeline counts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
