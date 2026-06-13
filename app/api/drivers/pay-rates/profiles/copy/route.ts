import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { auditLog } from "@/lib/auditLog"

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

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authorized) return auth.response!

    const body = await request.json()
    const sourceId = body.source_profile_id
    const newName = body.name

    if (!sourceId) {
      return NextResponse.json({ error: "source_profile_id is required" }, { status: 400 })
    }

    // 1. Fetch source profile
    const { data: source, error: srcErr } = await serviceSupabase
      .from("rate_profiles")
      .select("name, description, is_active, effective_date, expires_date")
      .eq("id", sourceId)
      .single()

    if (srcErr || !source) {
      return NextResponse.json({ error: "Source profile not found" }, { status: 404 })
    }

    // 2. Create new profile
    const { data: newProfile, error: createErr } = await serviceSupabase
      .from("rate_profiles")
      .insert({
        name: newName || `${source.name} Copy`,
        description: source.description,
        is_active: source.is_active,
        effective_date: source.effective_date,
        expires_date: source.expires_date,
      })
      .select("id, name")
      .single()

    if (createErr || !newProfile) {
      console.error("Copy profile create error:", createErr)
      return NextResponse.json({ error: createErr?.message || "Failed to create copy" }, { status: 500 })
    }

    // 3. Fetch source lanes
    const { data: sourceLanes } = await serviceSupabase
      .from("rate_profile_lanes")
      .select("*")
      .eq("rate_profile_id", sourceId)
      .order("priority", { ascending: false })

    if (!sourceLanes || sourceLanes.length === 0) {
      return NextResponse.json({ profile: newProfile }, { status: 201 })
    }

    // 4. Copy each lane, its charges, and their conditions
    for (const lane of sourceLanes) {
      const { id: oldLaneId, rate_profile_id: _, created_at: _ca, updated_at: _ua, ...laneData } = lane
      const { data: newLane, error: laneErr } = await serviceSupabase
        .from("rate_profile_lanes")
        .insert({ ...laneData, rate_profile_id: newProfile.id })
        .select("id")
        .single()

      if (laneErr || !newLane) {
        console.error("Copy lane error:", laneErr)
        continue
      }

      // Fetch charges for this lane
      const { data: sourceCharges } = await serviceSupabase
        .from("rate_profile_charges")
        .select("*")
        .eq("lane_id", oldLaneId)
        .order("sort_order")

      if (!sourceCharges) continue

      for (const charge of sourceCharges) {
        const { id: oldChargeId, lane_id: _, created_at: _cca, updated_at: _cua, ...chargeData } = charge
        const { data: newCharge, error: chargeErr } = await serviceSupabase
          .from("rate_profile_charges")
          .insert({ ...chargeData, lane_id: newLane.id })
          .select("id")
          .single()

        if (chargeErr || !newCharge) {
          console.error("Copy charge error:", chargeErr)
          continue
        }

        // Fetch conditions for this charge
        const { data: sourceConditions } = await serviceSupabase
          .from("rate_profile_conditions")
          .select("*")
          .eq("charge_id", oldChargeId)

        if (sourceConditions && sourceConditions.length > 0) {
          for (const cond of sourceConditions) {
            const { id: _cid, charge_id: _ccid, lane_id: _clid, created_at: _ccca, updated_at: _ccua, ...condData } = cond
            await serviceSupabase
              .from("rate_profile_conditions")
              .insert({ ...condData, charge_id: newCharge.id, lane_id: newLane.id })
          }
        }
      }

      // Also copy lane-level conditions (conditions with lane_id but no charge_id)
      const { data: laneConditions } = await serviceSupabase
        .from("rate_profile_conditions")
        .select("*")
        .eq("lane_id", oldLaneId)
        .is("charge_id", null)

      if (laneConditions && laneConditions.length > 0) {
        for (const cond of laneConditions) {
          const { id: _cid, lane_id: _clid, created_at: _ccca, updated_at: _ccua, ...condData } = cond
          await serviceSupabase
            .from("rate_profile_conditions")
            .insert({ ...condData, lane_id: newLane.id })
        }
      }
    }

    // 5. Copy driver group assignments from source profile
    const { data: sourceGroups } = await serviceSupabase
      .from("rate_profile_driver_groups")
      .select("driver_group_id")
      .eq("rate_profile_id", sourceId)

    if (sourceGroups && sourceGroups.length > 0) {
      const groupRows = sourceGroups.map((g) => ({
        rate_profile_id: newProfile.id,
        driver_group_id: g.driver_group_id,
      }))
      const { error: groupErr } = await serviceSupabase
        .from("rate_profile_driver_groups")
        .insert(groupRows)
      if (groupErr) {
        console.error("Copy driver groups error:", groupErr)
      }
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "rate_profile",
      entity_id: newProfile.id,
      action: "copied",
      user_id: auth.user!.id,
      details: {
        profile_name: newProfile.name,
        source_profile_id: sourceId,
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ profile: newProfile }, { status: 201 })
  } catch (error) {
    console.error("Error copying rate profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
