// app/api/drivers/route.ts
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

// Service role client bypasses RLS for admin mutations
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

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

    const body = await request.json()

    // Validation
    if (!body.name && (!body.first_name || !body.last_name)) {
      return NextResponse.json(
        { error: "Name is required (first_name + last_name or name)" },
        { status: 400 }
      )
    }
    if (!body.phone) {
      return NextResponse.json(
        { error: "Phone is required" },
        { status: 400 }
      )
    }

    // Build insert data with all supported fields
    const insertData: Record<string, unknown> = {
      name: body.name || `${body.first_name || ""} ${body.last_name || ""}`.trim(),
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      username: body.username || null,
      email: body.email || null,
      phone: body.phone,
      truck_number: body.truck_number || null,
      truck_owner: body.truck_owner || null,
      license_number: body.license_number || null,
      license_state: body.license_state || null,
      license_expiry: body.license_expiry || null,
      medical_expiry: body.medical_expiry || null,
      twic_expiry: body.twic_expiry || null,
      date_of_birth: body.date_of_birth || null,
      date_of_hire: body.date_of_hire || null,
      emergency_contact: body.emergency_contact || null,
      emergency_phone: body.emergency_phone || null,
      use_for_pre_appointments: body.use_for_pre_appointments ?? false,
      enabled: body.enabled ?? true,
      status: body.status || "Available",
      notes: body.notes || null,
    }

    // Use service client to bypass RLS for admin/dispatcher inserts
    const { data: driver, error: createError } = await serviceSupabase
      .from("drivers")
      .insert(insertData)
      .select()
      .single()

    if (createError || !driver) {
      console.error("Create error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create driver" },
        { status: 500 }
      )
    }

    // Audit log
    try {
      await serviceSupabase.from("activity_log").insert({
        entity_type: "driver",
        entity_id: driver.id,
        action: "created",
        user_id: user.id,
        details: {
          name: driver.name,
          phone: driver.phone,
          truck_number: driver.truck_number,
          created_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ driver }, { status: 201 })
  } catch (error) {
    console.error("Error creating driver:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
