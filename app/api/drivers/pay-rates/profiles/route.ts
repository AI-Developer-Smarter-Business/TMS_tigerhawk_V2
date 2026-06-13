import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const profileId = url.searchParams.get("id")
    const allParam = url.searchParams.get("all")

    // Single profile with full details
    if (profileId) {
      const { data: profile, error: profileError } = await supabase
        .from("rate_profiles")
        .select(`
          id,
          name,
          description,
          is_active,
          effective_date,
          expires_date,
          created_at,
          updated_at,
          rate_profile_lanes(
            id,
            lane_type,
            name,
            anchor_point_id,
            anchor_role,
            zone_id,
            pickup_location,
            pickup_lat,
            pickup_lng,
            delivery_location,
            delivery_lat,
            delivery_lng,
            return_location,
            return_lat,
            return_lng,
            direction,
            priority,
            is_active,
            created_at,
            updated_at,
            lane_origins(id, name, code, city, state),
            lane_zones(id, zone_number, name, min_miles, max_miles, reference_city),
            rate_profile_charges(
              id,
              charge_code,
              charge_name,
              calculation_mode,
              status_from,
              status_to,
              event,
              event_location,
              leg_from,
              leg_from_location,
              leg_to,
              leg_to_location,
              unit_of_measure,
              rate,
              min_amount,
              max_amount,
              free_units,
              auto_add,
              effective_date_based_on,
              description,
              sort_order,
              is_active
            ),
            rate_profile_conditions(
              id,
              condition_type,
              operator,
              condition_value,
              logic_group,
              logic_operator
            )
          )
        `)
        .eq("id", profileId)
        .single()

      if (profileError || !profile) {
        return NextResponse.json(
          { error: profileError?.message || "Profile not found" },
          { status: 404 }
        )
      }

      // Also fetch charge-level conditions for each charge in each lane
      const lanes = (profile as any).rate_profile_lanes || []
      for (const lane of lanes) {
        const charges = lane.rate_profile_charges || []
        for (const charge of charges) {
          const { data: chargeConditions } = await supabase
            .from("rate_profile_conditions")
            .select("id, condition_type, operator, condition_value, logic_group, logic_operator")
            .eq("charge_id", charge.id)

          charge.conditions = chargeConditions || []
        }
      }

      return NextResponse.json({ profile }, { status: 200 })
    }

    // List all profiles with summary info
    let query = supabase
      .from("rate_profiles")
      .select(`
        id,
        name,
        description,
        is_active,
        effective_date,
        expires_date,
        created_at,
        updated_at,
        rate_profile_lanes(count)
      `)
      .order("name")

    // Filter by active unless ?all=true
    if (!allParam || allParam !== "true") {
      query = query.eq("is_active", true)
    }

    const { data: profiles, error: profilesError } = await query

    if (profilesError) {
      console.error("Profiles fetch error:", profilesError)
      return NextResponse.json(
        { error: profilesError.message || "Failed to fetch profiles" },
        { status: 500 }
      )
    }

    // Transform to include lane count
    const profilesWithCounts = (profiles || []).map((profile: any) => ({
      ...profile,
      lane_count: profile.rate_profile_lanes?.[0]?.count || 0,
      rate_profile_lanes: undefined,
    }))

    // Fetch driver group assignments via junction table (many-to-many)
    const profileIds = profilesWithCounts.map((p: any) => p.id)
    if (profileIds.length > 0) {
      const { data: groupLinks } = await serviceSupabase
        .from("rate_profile_driver_groups")
        .select("rate_profile_id, driver_group_id, driver_groups(id, name)")
        .in("rate_profile_id", profileIds)

      const groupsByProfile: Record<string, Array<{ id: string; name: string }>> = {}
      for (const link of (groupLinks || []) as any[]) {
        const pid = link.rate_profile_id
        if (!groupsByProfile[pid]) groupsByProfile[pid] = []
        if (link.driver_groups) {
          groupsByProfile[pid].push({ id: link.driver_groups.id, name: link.driver_groups.name })
        }
      }

      for (const profile of profilesWithCounts) {
        (profile as any).driver_groups = groupsByProfile[profile.id] || []
      }
    }

    return NextResponse.json({ profiles: profilesWithCounts }, { status: 200 })
  } catch (error) {
    console.error("Error fetching rate profiles:", error)
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
    if (!body.name) {
      return NextResponse.json(
        { error: "Profile name is required" },
        { status: 400 }
      )
    }

    const insertData = {
      name: body.name,
      description: body.description || null,
      is_active: body.is_active ?? true,
      effective_date: body.effective_date || null,
      expires_date: body.expires_date || null,
    }

    // Use service client for insert
    const { data: profile, error: createError } = await serviceSupabase
      .from("rate_profiles")
      .insert(insertData)
      .select()
      .single()

    if (createError || !profile) {
      console.error("Create error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create rate profile" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile", profile.id, "created", auth.user.id, {
        name: profile.name,
        description: profile.description,
        created_by: auth.user.email,
      })
    }

    return NextResponse.json({ profile }, { status: 201 })
  } catch (error) {
    console.error("Error creating rate profile:", error)
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
      return NextResponse.json(
        { error: "id is required in request body" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.effective_date !== undefined) updateData.effective_date = body.effective_date
    if (body.expires_date !== undefined) updateData.expires_date = body.expires_date

    const { data: profile, error: updateError } = await serviceSupabase
      .from("rate_profiles")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (updateError || !profile) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update rate profile" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile", profile.id, "updated", auth.user.id, {
        name: profile.name,
        fields_changed: Object.keys(updateData),
        updated_by: auth.user.email,
      })
    }

    return NextResponse.json({ profile }, { status: 200 })
  } catch (error) {
    console.error("Error updating rate profile:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authorized) {
      return auth.response
    }

    const url = new URL(request.url)
    const profileId = url.searchParams.get("id")

    if (!profileId) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      )
    }

    // Cascading delete handles lanes, charges, conditions, and group links (junction table)
    const { error: deleteError } = await serviceSupabase
      .from("rate_profiles")
      .delete()
      .eq("id", profileId)

    if (deleteError) {
      console.error("Delete error:", deleteError)
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete rate profile" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile", profileId, "deleted", auth.user.id, {
        deleted_by: auth.user.email,
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting rate profile:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
