// app/api/chassis/route.ts
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
    if (!body.chassis_number) return NextResponse.json({ error: "Chassis number is required" }, { status: 400 })

    const insertData: Record<string, unknown> = {
      chassis_number: body.chassis_number,
      chassis_owner: body.chassis_owner || null,
      chassis_size: body.chassis_size || null,
      chassis_type: body.chassis_type || "Standard",
      license_number: body.license_number || null,
      license_state: body.license_state || null,
      address: body.address || null,
      vin: body.vin || null,
      registration_expiry: body.registration_expiry || null,
      inspection_expiry: body.inspection_expiry || null,
      insurance_expiry: body.insurance_expiry || null,
      enabled: body.enabled ?? true,
      status: body.status || "Available",
      notes: body.notes || null,
    }

    const { data: chassis, error } = await serviceSupabase
      .from("chassis").insert(insertData).select().single()

    if (error) {
      console.error("Create chassis error:", error)
      return NextResponse.json({ error: error.message || "Failed to create chassis" }, { status: 500 })
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "chassis",
        entity_id: chassis.id,
        action: "created",
        user_id: user.id,
        details: {
          chassis_number: chassis.chassis_number,
          chassis_owner: chassis.chassis_owner,
          chassis_type: chassis.chassis_type,
          created_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ chassis }, { status: 201 })
  } catch (error) {
    console.error("Error creating chassis:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
