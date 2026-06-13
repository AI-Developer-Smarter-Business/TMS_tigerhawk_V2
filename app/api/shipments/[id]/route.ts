// app/api/shipments/[id]/route.ts
import { createClient } from "@/lib/supabase/server"
import { auditLog } from "@/lib/auditLog"
import { NextRequest, NextResponse } from "next/server"
import { validateBody } from "@/lib/validations/validate"
import { updateShipmentSchema } from "@/lib/validations/schemas"

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

    // Get current shipment to check permissions
    const { data: currentShipment, error: fetchError } = await supabase
      .from("loads")
      .select("id, status, driver_id")
      .eq("id", id)
      .single()

    if (fetchError || !currentShipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 })
    }

    // Check if user has permission to edit
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isStaff = profile && ["admin", "dispatcher"].includes(profile.role)
    const isAssignedDriver = profile?.role === "driver" && currentShipment.driver_id === user.id

    if (!isStaff && !isAssignedDriver) {
      return NextResponse.json(
        { error: "You don't have permission to edit this shipment" },
        { status: 403 }
      )
    }

    // Get updates from request body
    const body = await request.json()

    // Validate request body with Zod schema
    const validation = validateBody(body, updateShipmentSchema)
    if (!validation.success) {
      return validation.response
    }

    const data = validation.data

    // Only allow certain fields to be updated
    const allowedUpdates: Record<string, unknown> = {}

    if (data.pickup_location !== undefined) allowedUpdates.pickup_location = data.pickup_location
    if (data.delivery_location !== undefined) allowedUpdates.delivery_location = data.delivery_location
    if (data.chassis_number !== undefined) allowedUpdates.chassis_number = data.chassis_number
    if (data.scheduled_pickup !== undefined) allowedUpdates.scheduled_pickup = data.scheduled_pickup
    if (data.rate !== undefined) allowedUpdates.rate = data.rate
    if (data.accessorial_charges !== undefined) allowedUpdates.accessorial_charges = data.accessorial_charges
    if (data.detention_charges !== undefined) allowedUpdates.detention_charges = data.detention_charges
    if (data.notes !== undefined) allowedUpdates.notes = data.notes

    // Only staff can reassign drivers
    if (isStaff && data.driver_id !== undefined) {
      allowedUpdates.driver_id = data.driver_id
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // Add updated_at timestamp
    allowedUpdates.updated_at = new Date().toISOString()

    // Update shipment
    const { data: shipment, error: updateError } = await supabase
      .from("loads")
      .update(allowedUpdates)
      .eq("id", id)
      .select(`
        *,
        customers ( id, name, email, phone ),
        containers ( container_number, bol_number, size, type, status, last_free_day ),
        drivers ( id, name, phone, status )
      `)
      .single()

    if (updateError || !shipment) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update shipment" },
        { status: 500 }
      )
    }

    // Audit log
    auditLog({
      entity_type: "shipment",
      entity_id: id,
      action: "updated",
      user_id: user.id,
      details: {
        updated_fields: Object.keys(allowedUpdates).filter(k => k !== "updated_at"),
        changed_by: user.email,
      },
    })

    return NextResponse.json({ shipment })
  } catch (error) {
    console.error("Error updating shipment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
