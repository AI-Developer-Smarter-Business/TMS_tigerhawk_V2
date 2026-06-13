// app/api/trucks/route.ts
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("user_profiles").select("role").eq("id", user.id).single()
    if (!profile || !["admin", "dispatcher"].includes(profile.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    if (!body.truck_number) return NextResponse.json({ error: "Truck number is required" }, { status: 400 })

    const insertData: Record<string, unknown> = {
      truck_number: body.truck_number,
      truck_owner: body.truck_owner || null,
      license_plate: body.license_plate || null,
      license_plate_state: body.license_plate_state || null,
      vin: body.vin || null,
      address: body.address || null,
      registration_expiry: body.registration_expiry || null,
      inspection_expiry: body.inspection_expiry || null,
      annual_inspection_expiry: body.annual_inspection_expiry || null,
      insurance_expiry: body.insurance_expiry || null,
      engine_family: body.engine_family || null,
      has_sleeper: body.has_sleeper ?? false,
      use_for_pre_appointments: body.use_for_pre_appointments ?? false,
      enabled: body.enabled ?? true,
      status: body.status || "Available",
      notes: body.notes || null,
    }

    const { data: truck, error } = await serviceSupabase
      .from("trucks").insert(insertData).select().single()

    if (error) {
      console.error("Create truck error:", error)
      return NextResponse.json({ error: error.message || "Failed to create truck" }, { status: 500 })
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "truck",
        entity_id: truck.id,
        action: "created",
        user_id: user.id,
        details: {
          truck_number: truck.truck_number,
          truck_owner: truck.truck_owner,
          created_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ truck }, { status: 201 })
  } catch (error) {
    console.error("Error creating truck:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
