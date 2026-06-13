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

const VALID_CALC_MODES = ["between_statuses", "by_event", "by_move", "by_leg"] as const
const VALID_UNITS = ["per_move", "per_day", "per_hour", "per_pounds", "per_miles", "per_road_toll_miles", "fixed", "percentage", "per_15min"] as const

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const laneId = url.searchParams.get("lane_id")

    if (!laneId) {
      return NextResponse.json({ error: "lane_id query parameter is required" }, { status: 400 })
    }

    const { data: charges, error } = await supabase
      .from("rate_profile_charges")
      .select(`
        id,
        lane_id,
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
        is_active,
        created_at,
        updated_at,
        rate_profile_conditions(
          id, condition_type, operator, condition_value, logic_group, logic_operator
        )
      `)
      .eq("lane_id", laneId)
      .order("sort_order")
      .order("charge_code")

    if (error) {
      console.error("Charges fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch charges" },
        { status: 500 }
      )
    }

    // Rename conditions field
    const transformedCharges = (charges || []).map((charge: any) => ({
      ...charge,
      conditions: charge.rate_profile_conditions || [],
      rate_profile_conditions: undefined,
    }))

    return NextResponse.json({ charges: transformedCharges }, { status: 200 })
  } catch (error) {
    console.error("Error fetching charges:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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
    if (!body.lane_id) {
      return NextResponse.json({ error: "lane_id is required" }, { status: 400 })
    }
    if (!body.charge_code) {
      return NextResponse.json({ error: "charge_code is required" }, { status: 400 })
    }
    if (!body.charge_name) {
      return NextResponse.json({ error: "charge_name is required" }, { status: 400 })
    }
    if (!body.calculation_mode || !VALID_CALC_MODES.includes(body.calculation_mode)) {
      return NextResponse.json(
        { error: `calculation_mode must be one of: ${VALID_CALC_MODES.join(", ")}` },
        { status: 400 }
      )
    }
    if (!body.unit_of_measure || !VALID_UNITS.includes(body.unit_of_measure)) {
      return NextResponse.json(
        { error: `unit_of_measure must be one of: ${VALID_UNITS.join(", ")}` },
        { status: 400 }
      )
    }
    if (body.rate === undefined || body.rate === null) {
      return NextResponse.json({ error: "rate is required" }, { status: 400 })
    }

    // Mode-specific validation
    if (body.calculation_mode === "between_statuses") {
      if (!body.status_from || !body.status_to) {
        return NextResponse.json(
          { error: "status_from and status_to are required for between_statuses mode" },
          { status: 400 }
        )
      }
    }
    if (body.calculation_mode === "by_event") {
      if (!body.event) {
        return NextResponse.json(
          { error: "event is required for by_event mode" },
          { status: 400 }
        )
      }
    }
    if (body.calculation_mode === "by_leg") {
      if (!body.leg_from || !body.leg_to) {
        return NextResponse.json(
          { error: "leg_from and leg_to are required for by_leg mode" },
          { status: 400 }
        )
      }
    }

    const insertData: Record<string, unknown> = {
      lane_id: body.lane_id,
      charge_code: body.charge_code,
      charge_name: body.charge_name,
      calculation_mode: body.calculation_mode,
      unit_of_measure: body.unit_of_measure,
      rate: parseFloat(body.rate),
      min_amount: body.min_amount !== undefined ? parseFloat(body.min_amount) : null,
      max_amount: body.max_amount !== undefined ? parseFloat(body.max_amount) : null,
      free_units: body.free_units !== undefined ? parseFloat(body.free_units) : 0,
      auto_add: body.auto_add ?? true,
      effective_date_based_on: body.effective_date_based_on || "current_date",
      description: body.description || null,
      sort_order: body.sort_order !== undefined ? parseInt(body.sort_order) : 0,
      is_active: body.is_active ?? true,
    }

    // Mode-specific fields
    if (body.calculation_mode === "between_statuses") {
      insertData.status_from = body.status_from
      insertData.status_to = body.status_to
    }
    if (body.calculation_mode === "by_event") {
      insertData.event = body.event
      insertData.event_location = body.event_location || null
    }
    if (body.calculation_mode === "by_leg") {
      insertData.leg_from = body.leg_from
      insertData.leg_from_location = body.leg_from_location || null
      insertData.leg_to = body.leg_to
      insertData.leg_to_location = body.leg_to_location || null
    }

    const { data: charge, error: createError } = await serviceSupabase
      .from("rate_profile_charges")
      .insert(insertData)
      .select()
      .single()

    if (createError || !charge) {
      console.error("Create charge error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create charge" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_charge", charge.id, "created", auth.user.id, {
        lane_id: body.lane_id,
        charge_code: charge.charge_code,
        charge_name: charge.charge_name,
        rate: charge.rate,
        created_by: auth.user.email,
      })
    }

    return NextResponse.json({ charge }, { status: 201 })
  } catch (error) {
    console.error("Error creating charge:", error)
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

    if (body.charge_code !== undefined) updateData.charge_code = body.charge_code
    if (body.charge_name !== undefined) updateData.charge_name = body.charge_name
    if (body.calculation_mode !== undefined) {
      if (!VALID_CALC_MODES.includes(body.calculation_mode)) {
        return NextResponse.json(
          { error: `calculation_mode must be one of: ${VALID_CALC_MODES.join(", ")}` },
          { status: 400 }
        )
      }
      updateData.calculation_mode = body.calculation_mode
    }
    if (body.unit_of_measure !== undefined) {
      if (!VALID_UNITS.includes(body.unit_of_measure)) {
        return NextResponse.json(
          { error: `unit_of_measure must be one of: ${VALID_UNITS.join(", ")}` },
          { status: 400 }
        )
      }
      updateData.unit_of_measure = body.unit_of_measure
    }
    if (body.rate !== undefined) updateData.rate = parseFloat(body.rate)
    if (body.min_amount !== undefined) updateData.min_amount = body.min_amount !== null ? parseFloat(body.min_amount) : null
    if (body.max_amount !== undefined) updateData.max_amount = body.max_amount !== null ? parseFloat(body.max_amount) : null
    if (body.free_units !== undefined) updateData.free_units = parseFloat(body.free_units)
    if (body.auto_add !== undefined) updateData.auto_add = body.auto_add
    if (body.effective_date_based_on !== undefined) updateData.effective_date_based_on = body.effective_date_based_on
    if (body.description !== undefined) updateData.description = body.description
    if (body.sort_order !== undefined) updateData.sort_order = parseInt(body.sort_order)
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    // Mode-specific fields
    if (body.status_from !== undefined) updateData.status_from = body.status_from
    if (body.status_to !== undefined) updateData.status_to = body.status_to
    if (body.event !== undefined) updateData.event = body.event
    if (body.event_location !== undefined) updateData.event_location = body.event_location
    if (body.leg_from !== undefined) updateData.leg_from = body.leg_from
    if (body.leg_from_location !== undefined) updateData.leg_from_location = body.leg_from_location
    if (body.leg_to !== undefined) updateData.leg_to = body.leg_to
    if (body.leg_to_location !== undefined) updateData.leg_to_location = body.leg_to_location

    const { data: charge, error: updateError } = await serviceSupabase
      .from("rate_profile_charges")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (updateError || !charge) {
      console.error("Update charge error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update charge" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_charge", charge.id, "updated", auth.user.id, {
        charge_code: charge.charge_code,
        fields_changed: Object.keys(updateData),
        updated_by: auth.user.email,
      })
    }

    return NextResponse.json({ charge }, { status: 200 })
  } catch (error) {
    console.error("Error updating charge:", error)
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
    const chargeId = url.searchParams.get("id")

    if (!chargeId) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 })
    }

    // Cascading delete handles charge-level conditions
    const { error: deleteError } = await serviceSupabase
      .from("rate_profile_charges")
      .delete()
      .eq("id", chargeId)

    if (deleteError) {
      console.error("Delete charge error:", deleteError)
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete charge" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_charge", chargeId, "deleted", auth.user.id, {
        deleted_by: auth.user.email,
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting charge:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
