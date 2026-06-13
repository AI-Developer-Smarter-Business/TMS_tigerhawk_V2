import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

// Audit logging helper
async function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  userId: string,
  details: Record<string, unknown>
) {
  try {
    await serviceSupabase.from("activity_log").insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      user_id: userId,
      details,
    })
  } catch (err) {
    console.error("Audit log error:", err)
  }
}

const VALID_LANE_TYPES = ["zonal", "defined"] as const
const VALID_ANCHOR_ROLES = ["origin", "destination"] as const
const VALID_DIRECTIONS = ["inbound", "outbound", "both"] as const

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const profileId = url.searchParams.get("profile_id")
    const laneId = url.searchParams.get("id")

    // Single lane with full details
    if (laneId) {
      const { data: lane, error } = await supabase
        .from("rate_profile_lanes")
        .select(`
          *,
          lane_origins(id, name, code, address, city, state, zip, lat, lng),
          lane_zones(id, zone_number, name, min_miles, max_miles, reference_city),
          rate_profile_charges(
            id, charge_code, charge_name, calculation_mode,
            status_from, status_to, event, event_location,
            leg_from, leg_from_location, leg_to, leg_to_location,
            unit_of_measure, rate, min_amount, max_amount, free_units,
            auto_add, effective_date_based_on, description, sort_order, is_active
          ),
          rate_profile_conditions(
            id, condition_type, operator, condition_value, logic_group, logic_operator
          )
        `)
        .eq("id", laneId)
        .single()

      if (error || !lane) {
        return NextResponse.json(
          { error: error?.message || "Lane not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({ lane }, { status: 200 })
    }

    // List lanes for a profile
    if (!profileId) {
      return NextResponse.json(
        { error: "profile_id or id query parameter is required" },
        { status: 400 }
      )
    }

    const { data: lanes, error: lanesError } = await supabase
      .from("rate_profile_lanes")
      .select(`
        id,
        rate_profile_id,
        lane_type,
        name,
        anchor_point_id,
        anchor_role,
        zone_id,
        pickup_location,
        delivery_location,
        return_location,
        direction,
        priority,
        is_active,
        created_at,
        updated_at,
        lane_origins(id, name, code, city, state),
        lane_zones(id, zone_number, name, min_miles, max_miles),
        rate_profile_charges(count),
        rate_profile_conditions(count)
      `)
      .eq("rate_profile_id", profileId)
      .order("priority", { ascending: false })
      .order("lane_type")
      .order("name")

    if (lanesError) {
      console.error("Lanes fetch error:", lanesError)
      return NextResponse.json(
        { error: lanesError.message || "Failed to fetch lanes" },
        { status: 500 }
      )
    }

    // Transform to flatten counts
    const transformedLanes = (lanes || []).map((lane: any) => ({
      ...lane,
      origin_name: lane.lane_origins?.name || null,
      origin_code: lane.lane_origins?.code || null,
      zone_name: lane.lane_zones?.name || null,
      zone_number: lane.lane_zones?.zone_number || null,
      zone_miles: lane.lane_zones ? `${lane.lane_zones.min_miles}-${lane.lane_zones.max_miles} mi` : null,
      zone_min_miles: lane.lane_zones?.min_miles ?? null,
      zone_max_miles: lane.lane_zones?.max_miles ?? null,
      charge_count: lane.rate_profile_charges?.[0]?.count || 0,
      condition_count: lane.rate_profile_conditions?.[0]?.count || 0,
      lane_origins: undefined,
      lane_zones: undefined,
      rate_profile_charges: undefined,
      rate_profile_conditions: undefined,
    }))

    return NextResponse.json({ lanes: transformedLanes }, { status: 200 })
  } catch (error) {
    console.error("Error fetching lanes:", error)
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
    if (!body.rate_profile_id) {
      return NextResponse.json({ error: "rate_profile_id is required" }, { status: 400 })
    }

    if (!body.lane_type || !VALID_LANE_TYPES.includes(body.lane_type)) {
      return NextResponse.json(
        { error: "lane_type must be 'zonal' or 'defined'" },
        { status: 400 }
      )
    }

    // Zonal validation
    if (body.lane_type === "zonal") {
      if (!body.anchor_point_id) {
        return NextResponse.json({ error: "anchor_point_id is required for zonal lanes" }, { status: 400 })
      }
      if (!body.anchor_role || !VALID_ANCHOR_ROLES.includes(body.anchor_role)) {
        return NextResponse.json({ error: "anchor_role must be 'origin' or 'destination'" }, { status: 400 })
      }
      if (!body.zone_id) {
        return NextResponse.json({ error: "zone_id is required for zonal lanes" }, { status: 400 })
      }
    }

    // Defined validation
    if (body.lane_type === "defined") {
      if (!body.pickup_location && !body.delivery_location) {
        return NextResponse.json(
          { error: "At least pickup_location or delivery_location is required for defined lanes" },
          { status: 400 }
        )
      }
    }

    if (body.direction && !VALID_DIRECTIONS.includes(body.direction)) {
      return NextResponse.json(
        { error: "direction must be 'inbound', 'outbound', or 'both'" },
        { status: 400 }
      )
    }

    const insertData: Record<string, unknown> = {
      rate_profile_id: body.rate_profile_id,
      lane_type: body.lane_type,
      name: body.name || null,
      direction: body.direction || "both",
      priority: body.priority !== undefined ? parseInt(body.priority) : 0,
      is_active: body.is_active ?? true,
    }

    // Zonal fields
    if (body.lane_type === "zonal") {
      insertData.anchor_point_id = body.anchor_point_id
      insertData.anchor_role = body.anchor_role
      insertData.zone_id = body.zone_id
    }

    // Defined fields
    if (body.lane_type === "defined") {
      insertData.pickup_location = body.pickup_location || null
      insertData.pickup_lat = body.pickup_lat ? parseFloat(body.pickup_lat) : null
      insertData.pickup_lng = body.pickup_lng ? parseFloat(body.pickup_lng) : null
      insertData.delivery_location = body.delivery_location || null
      insertData.delivery_lat = body.delivery_lat ? parseFloat(body.delivery_lat) : null
      insertData.delivery_lng = body.delivery_lng ? parseFloat(body.delivery_lng) : null
      insertData.return_location = body.return_location || null
      insertData.return_lat = body.return_lat ? parseFloat(body.return_lat) : null
      insertData.return_lng = body.return_lng ? parseFloat(body.return_lng) : null
    }

    const { data: lane, error: createError } = await serviceSupabase
      .from("rate_profile_lanes")
      .insert(insertData)
      .select()
      .single()

    if (createError || !lane) {
      console.error("Create lane error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create lane" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_lane", lane.id, "created", auth.user.id, {
        rate_profile_id: body.rate_profile_id,
        lane_type: body.lane_type,
        name: lane.name,
        created_by: auth.user.email,
      })
    }

    return NextResponse.json({ lane }, { status: 201 })
  } catch (error) {
    console.error("Error creating lane:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
      return NextResponse.json({ error: "id is required in request body" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}

    // Only update fields that are explicitly provided
    if (body.name !== undefined) updateData.name = body.name
    if (body.lane_type !== undefined) {
      if (!VALID_LANE_TYPES.includes(body.lane_type)) {
        return NextResponse.json({ error: "lane_type must be 'zonal' or 'defined'" }, { status: 400 })
      }
      updateData.lane_type = body.lane_type
    }
    if (body.anchor_point_id !== undefined) updateData.anchor_point_id = body.anchor_point_id
    if (body.anchor_role !== undefined) {
      if (body.anchor_role !== null && !VALID_ANCHOR_ROLES.includes(body.anchor_role)) {
        return NextResponse.json({ error: "anchor_role must be 'origin' or 'destination'" }, { status: 400 })
      }
      updateData.anchor_role = body.anchor_role
    }
    if (body.zone_id !== undefined) updateData.zone_id = body.zone_id
    if (body.pickup_location !== undefined) updateData.pickup_location = body.pickup_location
    if (body.pickup_lat !== undefined) updateData.pickup_lat = body.pickup_lat ? parseFloat(body.pickup_lat) : null
    if (body.pickup_lng !== undefined) updateData.pickup_lng = body.pickup_lng ? parseFloat(body.pickup_lng) : null
    if (body.delivery_location !== undefined) updateData.delivery_location = body.delivery_location
    if (body.delivery_lat !== undefined) updateData.delivery_lat = body.delivery_lat ? parseFloat(body.delivery_lat) : null
    if (body.delivery_lng !== undefined) updateData.delivery_lng = body.delivery_lng ? parseFloat(body.delivery_lng) : null
    if (body.return_location !== undefined) updateData.return_location = body.return_location
    if (body.return_lat !== undefined) updateData.return_lat = body.return_lat ? parseFloat(body.return_lat) : null
    if (body.return_lng !== undefined) updateData.return_lng = body.return_lng ? parseFloat(body.return_lng) : null
    if (body.direction !== undefined) {
      if (!VALID_DIRECTIONS.includes(body.direction)) {
        return NextResponse.json({ error: "direction must be 'inbound', 'outbound', or 'both'" }, { status: 400 })
      }
      updateData.direction = body.direction
    }
    if (body.priority !== undefined) updateData.priority = parseInt(body.priority)
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    const { data: lane, error: updateError } = await serviceSupabase
      .from("rate_profile_lanes")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (updateError || !lane) {
      console.error("Update lane error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update lane" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_lane", lane.id, "updated", auth.user.id, {
        fields_changed: Object.keys(updateData),
        updated_by: auth.user.email,
      })
    }

    return NextResponse.json({ lane }, { status: 200 })
  } catch (error) {
    console.error("Error updating lane:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authorized) {
      return auth.response
    }

    const url = new URL(request.url)
    const laneId = url.searchParams.get("id")

    if (!laneId) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 })
    }

    // Cascading delete handles charges and conditions
    const { error: deleteError } = await serviceSupabase
      .from("rate_profile_lanes")
      .delete()
      .eq("id", laneId)

    if (deleteError) {
      console.error("Delete lane error:", deleteError)
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete lane" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_lane", laneId, "deleted", auth.user.id, {
        deleted_by: auth.user.email,
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting lane:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
