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

const VALID_OPERATORS = ["equals", "not_equals", "in", "not_in", "gt", "gte", "lt", "lte"] as const
const VALID_LOGIC_OPERATORS = ["AND", "OR", "NOT"] as const

// All valid condition types from the design doc
const VALID_CONDITION_TYPES = [
  // Location & routing
  "load_type", "customer", "terminal", "warehouse", "chassis_pickup",
  "hook_chassis", "container_return", "chassis_term", "drop_location",
  "stopoff", "delivery_country", "city_state", "state",
  "postal_zip_code_groups", "city_groups",
  // Equipment
  "container_type", "container_size", "ssl", "chassis_type",
  "chassis_size", "chassis_owner",
  // Load properties (booleans)
  "hazmat", "overweight", "hot", "liquor", "reefer", "genset",
  "bonded", "scale", "street_turn", "oog", "ev", "double",
  "tanker", "dropped",
  // Other
  "csr", "branch", "commodity_profile", "commodities_weight",
  "delivery_day", "delivery_time_24hrs",
] as const

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const laneId = url.searchParams.get("lane_id")
    const chargeId = url.searchParams.get("charge_id")

    if (!laneId && !chargeId) {
      return NextResponse.json(
        { error: "lane_id or charge_id query parameter is required" },
        { status: 400 }
      )
    }

    let query = supabase
      .from("rate_profile_conditions")
      .select("*")
      .order("logic_group")
      .order("created_at")

    if (laneId) {
      query = query.eq("lane_id", laneId)
    } else if (chargeId) {
      query = query.eq("charge_id", chargeId)
    }

    const { data: conditions, error } = await query

    if (error) {
      console.error("Conditions fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch conditions" },
        { status: 500 }
      )
    }

    return NextResponse.json({ conditions: conditions || [] }, { status: 200 })
  } catch (error) {
    console.error("Error fetching conditions:", error)
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

    // Must have either lane_id or charge_id
    if (!body.lane_id && !body.charge_id) {
      return NextResponse.json(
        { error: "Either lane_id or charge_id is required" },
        { status: 400 }
      )
    }

    if (!body.condition_type) {
      return NextResponse.json({ error: "condition_type is required" }, { status: 400 })
    }

    if (!VALID_CONDITION_TYPES.includes(body.condition_type)) {
      return NextResponse.json(
        { error: `Invalid condition_type. Valid types: ${VALID_CONDITION_TYPES.join(", ")}` },
        { status: 400 }
      )
    }

    if (body.condition_value === undefined || body.condition_value === null) {
      return NextResponse.json({ error: "condition_value is required" }, { status: 400 })
    }

    if (body.operator && !VALID_OPERATORS.includes(body.operator)) {
      return NextResponse.json(
        { error: `operator must be one of: ${VALID_OPERATORS.join(", ")}` },
        { status: 400 }
      )
    }

    if (body.logic_operator && !VALID_LOGIC_OPERATORS.includes(body.logic_operator)) {
      return NextResponse.json(
        { error: `logic_operator must be one of: ${VALID_LOGIC_OPERATORS.join(", ")}` },
        { status: 400 }
      )
    }

    const insertData = {
      lane_id: body.lane_id || null,
      charge_id: body.charge_id || null,
      condition_type: body.condition_type,
      operator: body.operator || "equals",
      condition_value: body.condition_value,
      logic_group: body.logic_group !== undefined ? parseInt(body.logic_group) : 1,
      logic_operator: body.logic_operator || "AND",
    }

    const { data: condition, error: createError } = await serviceSupabase
      .from("rate_profile_conditions")
      .insert(insertData)
      .select()
      .single()

    if (createError || !condition) {
      console.error("Create condition error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create condition" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_condition", condition.id, "created", auth.user.id, {
        lane_id: body.lane_id || null,
        charge_id: body.charge_id || null,
        condition_type: condition.condition_type,
        operator: condition.operator,
        created_by: auth.user.email,
      })
    }

    return NextResponse.json({ condition }, { status: 201 })
  } catch (error) {
    console.error("Error creating condition:", error)
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

    if (body.condition_type !== undefined) {
      if (!VALID_CONDITION_TYPES.includes(body.condition_type)) {
        return NextResponse.json(
          { error: `Invalid condition_type. Valid types: ${VALID_CONDITION_TYPES.join(", ")}` },
          { status: 400 }
        )
      }
      updateData.condition_type = body.condition_type
    }
    if (body.operator !== undefined) {
      if (!VALID_OPERATORS.includes(body.operator)) {
        return NextResponse.json(
          { error: `operator must be one of: ${VALID_OPERATORS.join(", ")}` },
          { status: 400 }
        )
      }
      updateData.operator = body.operator
    }
    if (body.condition_value !== undefined) updateData.condition_value = body.condition_value
    if (body.logic_group !== undefined) updateData.logic_group = parseInt(body.logic_group)
    if (body.logic_operator !== undefined) {
      if (!VALID_LOGIC_OPERATORS.includes(body.logic_operator)) {
        return NextResponse.json(
          { error: `logic_operator must be one of: ${VALID_LOGIC_OPERATORS.join(", ")}` },
          { status: 400 }
        )
      }
      updateData.logic_operator = body.logic_operator
    }

    const { data: condition, error: updateError } = await serviceSupabase
      .from("rate_profile_conditions")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (updateError || !condition) {
      console.error("Update condition error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update condition" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_condition", condition.id, "updated", auth.user.id, {
        condition_type: condition.condition_type,
        fields_changed: Object.keys(updateData),
        updated_by: auth.user.email,
      })
    }

    return NextResponse.json({ condition }, { status: 200 })
  } catch (error) {
    console.error("Error updating condition:", error)
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
    const conditionId = url.searchParams.get("id")

    if (!conditionId) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 })
    }

    const { error: deleteError } = await serviceSupabase
      .from("rate_profile_conditions")
      .delete()
      .eq("id", conditionId)

    if (deleteError) {
      console.error("Delete condition error:", deleteError)
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete condition" },
        { status: 500 }
      )
    }

    // Audit log
    if (auth.user) {
      await logActivity("rate_profile_condition", conditionId, "deleted", auth.user.id, {
        deleted_by: auth.user.email,
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting condition:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
