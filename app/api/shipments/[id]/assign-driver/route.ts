// app/api/shipments/[id]/assign-driver/route.ts
import { createClient } from "@/lib/supabase/server"
import { auditLog } from "@/lib/auditLog"
import { NextRequest, NextResponse } from "next/server"
import { validateBody } from "@/lib/validations/validate"
import { assignDriverSchema } from "@/lib/validations/schemas"

export async function POST(
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

    // Check if user has permission (admin or dispatcher only)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get driver_id from request body
    const body = await request.json()

    // Validate request body with Zod schema
    const validation = validateBody(body, assignDriverSchema)
    if (!validation.success) {
      return validation.response
    }

    const { driver_id } = validation.data

    // Check if driver exists and is available
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, name, status")
      .eq("id", driver_id)
      .single()

    if (driverError || !driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 })
    }

    if (driver.status !== "Available") {
      return NextResponse.json(
        { error: `Driver is currently ${driver.status}` },
        { status: 400 }
      )
    }

    // Update shipment with driver and change status to Assigned
    const { data: shipment, error: shipmentError } = await supabase
      .from("loads")
      .update({
        driver_id,
        status: "Assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        customers ( id, name, email, phone ),
        containers ( container_number, bol_number, size, type, status, last_free_day ),
        drivers ( id, name, phone, status )
      `)
      .single()

    if (shipmentError || !shipment) {
      return NextResponse.json(
        { error: "Failed to assign driver to shipment" },
        { status: 500 }
      )
    }

    // Update driver status to "On Assignment"
    const { error: updateDriverError } = await supabase
      .from("drivers")
      .update({ status: "On Assignment" })
      .eq("id", driver_id)

    if (updateDriverError) {
      // Log error but don't fail the request since shipment was updated
      console.error("Failed to update driver status:", updateDriverError)
    }

    // Audit log
    auditLog({
      entity_type: "shipment",
      entity_id: id,
      action: "driver_assigned",
      user_id: user.id,
      details: {
        driver_id,
        driver_name: driver.name,
        reference_number: shipment.reference_number,
        changed_by: user.email,
      },
    })

    return NextResponse.json({ shipment })
  } catch (error) {
    console.error("Error assigning driver:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
