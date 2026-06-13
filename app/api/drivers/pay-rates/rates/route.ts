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
    const zoneId = url.searchParams.get("zone_id")
    const driverGroupId = url.searchParams.get("driver_group_id")
    const originId = url.searchParams.get("origin_id")

    // Build query
    let query = supabase
      .from("lane_rates")
      .select(`
        id,
        zone_id,
        driver_group_id,
        service_type,
        rate,
        unit_of_measure,
        effective_date,
        expires_date,
        created_at,
        updated_at,
        lane_zones(name, zone_number),
        driver_groups(name)
      `)

    if (zoneId) {
      query = query.eq("zone_id", zoneId)
    }

    if (driverGroupId) {
      query = query.eq("driver_group_id", driverGroupId)
    }

    // If originId provided, we need to filter zones by origin_id first
    if (originId && !zoneId) {
      // Get all zone IDs for this origin
      const { data: zones } = await supabase
        .from("lane_zones")
        .select("id")
        .eq("origin_id", originId)

      const zoneIds = (zones || []).map(z => z.id)
      if (zoneIds.length > 0) {
        query = query.in("zone_id", zoneIds)
      } else {
        // No zones for this origin
        return NextResponse.json({ rates: [] }, { status: 200 })
      }
    }

    const { data: rates, error: ratesError } = await query.order("service_type")

    if (ratesError) {
      console.error("Rates fetch error:", ratesError)
      return NextResponse.json(
        { error: ratesError.message || "Failed to fetch rates" },
        { status: 500 }
      )
    }

    // Transform to flatten zone and group names
    const transformedRates = (rates || []).map((rate: any) => ({
      ...rate,
      zone_name: rate.lane_zones?.name || null,
      zone_number: rate.lane_zones?.zone_number || null,
      group_name: rate.driver_groups?.name || null,
      lane_zones: undefined,
      driver_groups: undefined,
    }))

    return NextResponse.json({ rates: transformedRates }, { status: 200 })
  } catch (error) {
    console.error("Error fetching rates:", error)
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
    if (!body.zone_id) {
      return NextResponse.json(
        { error: "zone_id is required" },
        { status: 400 }
      )
    }

    if (!body.driver_group_id) {
      return NextResponse.json(
        { error: "driver_group_id is required" },
        { status: 400 }
      )
    }

    if (body.rate === undefined || body.rate === null) {
      return NextResponse.json(
        { error: "rate is required" },
        { status: 400 }
      )
    }

    if (!body.effective_date) {
      return NextResponse.json(
        { error: "effective_date is required" },
        { status: 400 }
      )
    }

    const insertData = {
      zone_id: body.zone_id,
      driver_group_id: body.driver_group_id,
      service_type: body.service_type || null,
      rate: parseFloat(body.rate),
      unit_of_measure: body.unit_of_measure || "per_move",
      effective_date: body.effective_date,
      expires_date: body.expires_date || null,
    }

    // Use service client for insert
    const { data: rate, error: createError } = await serviceSupabase
      .from("lane_rates")
      .insert(insertData)
      .select()
      .single()

    if (createError || !rate) {
      console.error("Create error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create rate" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "lane_rate",
      entity_id: rate.id,
      action: "created",
      user_id: auth.user!.id,
      details: {
        zone_id: rate.zone_id,
        driver_group_id: rate.driver_group_id,
        rate_amount: rate.rate,
        effective_date: rate.effective_date,
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ rate }, { status: 201 })
  } catch (error) {
    console.error("Error creating rate:", error)
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

    // Validation
    if (!body.id) {
      return NextResponse.json(
        { error: "id is required in request body" },
        { status: 400 }
      )
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {}

    if (body.service_type !== undefined) {
      updateData.service_type = body.service_type
    }
    if (body.rate !== undefined) {
      updateData.rate = parseFloat(body.rate)
    }
    if (body.unit_of_measure !== undefined) {
      updateData.unit_of_measure = body.unit_of_measure
    }
    if (body.effective_date !== undefined) {
      updateData.effective_date = body.effective_date
    }
    if (body.expires_date !== undefined) {
      updateData.expires_date = body.expires_date
    }

    // Use service client for update
    const { data: rate, error: updateError } = await serviceSupabase
      .from("lane_rates")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (updateError || !rate) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update rate" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "lane_rate",
      entity_id: rate.id,
      action: "updated",
      user_id: auth.user!.id,
      details: {
        updated_fields: Object.keys(updateData),
        rate_amount: rate.rate,
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ rate }, { status: 200 })
  } catch (error) {
    console.error("Error updating rate:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
