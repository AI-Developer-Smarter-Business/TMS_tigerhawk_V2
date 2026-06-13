import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { auditLog } from "@/lib/auditLog"

// Service role client bypasses RLS for admin mutations
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper function to check auth and permissions
async function checkAuth(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
    return { authorized: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { authorized: true, supabase, user }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const originId = url.searchParams.get("origin_id")

    // origin_id is REQUIRED
    if (!originId) {
      return NextResponse.json(
        { error: "origin_id query parameter is required" },
        { status: 400 }
      )
    }

    // Fetch zones with origin details
    const { data: zones, error: zonesError } = await supabase
      .from("lane_zones")
      .select(`
        id,
        origin_id,
        zone_number,
        name,
        min_miles,
        max_miles,
        reference_city,
        description,
        created_at,
        updated_at,
        lane_origins(name)
      `)
      .eq("origin_id", originId)
      .order("zone_number")

    if (zonesError) {
      console.error("Zones fetch error:", zonesError)
      return NextResponse.json(
        { error: zonesError.message || "Failed to fetch zones" },
        { status: 500 }
      )
    }

    // Transform to flatten origin name
    const transformedZones = (zones || []).map((zone: any) => ({
      ...zone,
      origin_name: zone.lane_origins?.name || null,
      lane_origins: undefined,
    }))

    return NextResponse.json({ zones: transformedZones }, { status: 200 })
  } catch (error) {
    console.error("Error fetching zones:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authorized) {
      return auth.response
    }

    const body = await request.json()

    // Validation
    if (!body.origin_id) {
      return NextResponse.json(
        { error: "origin_id is required" },
        { status: 400 }
      )
    }

    if (body.zone_number === undefined || body.zone_number === null) {
      return NextResponse.json(
        { error: "zone_number is required" },
        { status: 400 }
      )
    }

    if (!body.name) {
      return NextResponse.json(
        { error: "Zone name is required" },
        { status: 400 }
      )
    }

    const insertData = {
      origin_id: body.origin_id,
      zone_number: parseInt(body.zone_number),
      name: body.name,
      min_miles: body.min_miles !== undefined ? parseFloat(body.min_miles) : null,
      max_miles: body.max_miles !== undefined ? parseFloat(body.max_miles) : null,
      reference_city: body.reference_city || null,
      description: body.description || null,
    }

    // Use service client for insert
    const { data: zone, error: createError } = await serviceSupabase
      .from("lane_zones")
      .insert(insertData)
      .select()
      .single()

    if (createError || !zone) {
      console.error("Create error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create zone" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "lane_zone",
      entity_id: zone.id,
      action: "created",
      user_id: auth.user!.id,
      details: {
        zone_name: zone.name,
        zone_number: zone.zone_number,
        origin_id: zone.origin_id,
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ zone }, { status: 201 })
  } catch (error) {
    console.error("Error creating zone:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authorized) {
      return auth.response
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: "Zone id is required" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.zone_number !== undefined) updateData.zone_number = parseInt(body.zone_number)
    if (body.name !== undefined) updateData.name = body.name
    if (body.min_miles !== undefined) updateData.min_miles = parseFloat(body.min_miles)
    if (body.max_miles !== undefined) updateData.max_miles = parseFloat(body.max_miles)
    if (body.reference_city !== undefined) updateData.reference_city = body.reference_city
    if (body.description !== undefined) updateData.description = body.description

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const { data: zone, error: updateError } = await serviceSupabase
      .from("lane_zones")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (updateError || !zone) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update zone" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "lane_zone",
      entity_id: zone.id,
      action: "updated",
      user_id: auth.user!.id,
      details: {
        zone_name: zone.name,
        updated_fields: Object.keys(updateData),
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ zone }, { status: 200 })
  } catch (error) {
    console.error("Error updating zone:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
