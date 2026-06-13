// app/api/shipments/route.ts
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { validateBody } from "@/lib/validations/validate"
import { createShipmentSchema } from "@/lib/validations/schemas"

// Service role client for admin operations (activity log, driver status)
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Auth check — middleware handles redirect, but API needs explicit check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check role — only admin/dispatcher can create shipments
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await req.json()

    // Validate request body with Zod schema
    const validation = validateBody(body, createShipmentSchema)
    if (!validation.success) {
      return validation.response
    }

    const data = validation.data

    // Verify customer exists (uses auth client — RLS enforces access)
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", data.customer_id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "Invalid customer" }, { status: 400 })
    }

    // If container_id provided, verify it exists
    if (data.container_id) {
      const { data: container, error: containerError } = await supabase
        .from("containers")
        .select("id")
        .eq("id", data.container_id)
        .single()

      if (containerError || !container) {
        return NextResponse.json({ error: "Invalid container" }, { status: 400 })
      }
    }

    // If driver_id provided, verify driver exists and is available
    if (data.driver_id) {
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("id, status")
        .eq("id", data.driver_id)
        .single()

      if (driverError || !driver) {
        return NextResponse.json({ error: "Invalid driver" }, { status: 400 })
      }
      if (driver.status !== "Available") {
        return NextResponse.json({ error: "Driver is not available" }, { status: 400 })
      }
    }

    // Build the shipment record
    const shipmentData: Record<string, unknown> = {
      customer_id: data.customer_id,
      container_id: data.container_id || null,
      driver_id: data.driver_id || null,
      pickup_location: data.pickup_location,
      delivery_location: data.delivery_location,
      scheduled_pickup: data.scheduled_pickup || null,
      chassis_number: data.chassis_number || null,
      rate: data.rate != null ? Number(data.rate) : null,
      notes: data.notes || null,
      load_type: data.load_type || "Import",
      route_type: data.route_type || null,
      status: data.driver_id ? "Assigned" : "Created",
    }

    // Insert the shipment (RLS allows admin/dispatcher to insert)
    const { data: shipment, error: insertError } = await supabase
      .from("loads")
      .insert(shipmentData)
      .select()
      .single()

    if (insertError) {
      console.error("Shipment insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create shipment" },
        { status: 500 }
      )
    }

    // If a driver was assigned, update their status to "On Job"
    // Use service client to ensure this always works regardless of RLS
    if (data.driver_id) {
      const { error: driverUpdateError } = await serviceSupabase
        .from("drivers")
        .update({ status: "On Job" })
        .eq("id", data.driver_id)

      if (driverUpdateError) {
        console.error("Driver status update error:", driverUpdateError)
      }
    }

    // Log the activity (use service client for reliability)
    await serviceSupabase.from("activity_log").insert({
      entity_type: "shipment",
      entity_id: shipment.id,
      action: "created",
      user_id: user.id,
      details: {
        reference_number: shipment.reference_number,
        customer_id: data.customer_id,
        status: shipment.status,
        load_type: shipment.load_type,
        route_type: shipment.route_type,
        driver_assigned: !!data.driver_id,
        created_by: user.email,
      },
    })

    return NextResponse.json(shipment, { status: 201 })
  } catch (err: unknown) {
    console.error("Shipment creation error:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
