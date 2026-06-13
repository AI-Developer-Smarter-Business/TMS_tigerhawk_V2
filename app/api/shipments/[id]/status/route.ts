// app/api/shipments/[id]/status/route.ts
import { createClient } from "@/lib/supabase/server"
import { auditLog } from "@/lib/auditLog"
import { NextRequest, NextResponse } from "next/server"
import { validateBody } from "@/lib/validations/validate"
import { statusChangeSchema } from "@/lib/validations/schemas"

type ShipmentStatus =
  | "Created"
  | "Assigned"
  | "Dispatched"
  | "In Transit"
  | "At Warehouse"
  | "Delivered"
  | "Completed"
  | "Cancelled"

const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  Created: ["Assigned", "Cancelled"],
  Assigned: ["Dispatched", "Created", "Cancelled"],
  Dispatched: ["In Transit", "Assigned", "Cancelled"],
  "In Transit": ["At Warehouse", "Delivered", "Dispatched", "Cancelled"],
  "At Warehouse": ["In Transit", "Delivered", "Cancelled"],
  Delivered: ["Completed", "In Transit", "Cancelled"],
  Completed: [], // Terminal state
  Cancelled: [], // Terminal state
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current shipment
    const { data: currentShipment, error: fetchError } = await supabase
      .from("loads")
      .select("status, driver_id")
      .eq("id", id)
      .single()

    if (fetchError || !currentShipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 })
    }

    // Get new status from request body
    const body = await request.json()

    // Validate request body with Zod schema
    const validation = validateBody(body, statusChangeSchema)
    if (!validation.success) {
      return validation.response
    }

    const { status: newStatus } = validation.data

    // Validate status transition
    const currentStatus = currentShipment.status as ShipmentStatus
    const validNextStates = VALID_TRANSITIONS[currentStatus] || []

    if (!validNextStates.includes(newStatus as ShipmentStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
          validNextStates,
        },
        { status: 400 }
      )
    }

    // Prepare update data
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    // Set timestamps based on status
    const now = new Date().toISOString()
    if (newStatus === "In Transit" && !currentShipment.driver_id) {
      return NextResponse.json(
        { error: "Cannot mark as In Transit without a driver assigned" },
        { status: 400 }
      )
    }

    if (newStatus === "In Transit") {
      updates.actual_pickup = now
    } else if (newStatus === "Delivered") {
      updates.actual_delivery = now
    }

    // Update shipment
    const { data: shipment, error: updateError } = await supabase
      .from("loads")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        customers ( id, name, email, phone ),
        containers ( container_number, bol_number, size, type, status, last_free_day ),
        drivers ( id, name, phone, status )
      `)
      .single()

    if (updateError || !shipment) {
      return NextResponse.json(
        { error: "Failed to update shipment status" },
        { status: 500 }
      )
    }

    // Update driver status when shipment is completed
    if (newStatus === "Completed" && currentShipment.driver_id) {
      const { error: driverUpdateError } = await supabase
        .from("drivers")
        .update({ status: "Available" })
        .eq("id", currentShipment.driver_id)

      if (driverUpdateError) {
        console.error("Failed to update driver status:", driverUpdateError)
      }
    }

    // Audit log
    auditLog({
      entity_type: "shipment",
      entity_id: id,
      action: "status_changed",
      user_id: user.id,
      details: {
        reference_number: shipment.reference_number,
        from_status: currentStatus,
        to_status: newStatus,
        changed_by: user.email,
      },
    })

    return NextResponse.json({ shipment })
  } catch (error) {
    console.error("Error updating shipment status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
