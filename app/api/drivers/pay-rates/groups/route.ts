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

    // Fetch driver groups with count of assignments
    const { data: groups, error: groupsError } = await supabase
      .from("driver_groups")
      .select(`
        id,
        name,
        pay_type,
        base_rate,
        is_company_driver,
        default_service_type,
        notes,
        rate_profile_id,
        created_at,
        updated_at,
        driver_group_assignments(count),
        rate_profiles(id, name)
      `)
      .order("name")

    if (groupsError) {
      console.error("Groups fetch error:", groupsError)
      return NextResponse.json(
        { error: groupsError.message || "Failed to fetch groups" },
        { status: 500 }
      )
    }

    // Transform to include assignment count
    const groupsWithCounts = (groups || []).map((group: any) => ({
      ...group,
      assignment_count: group.driver_group_assignments?.length || 0,
      rate_profile_name: group.rate_profiles?.name || null,
      driver_group_assignments: undefined,
      rate_profiles: undefined,
    }))

    return NextResponse.json({ groups: groupsWithCounts }, { status: 200 })
  } catch (error) {
    console.error("Error fetching groups:", error)
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
        { error: "Group name is required" },
        { status: 400 }
      )
    }

    if (!body.pay_type || !["per_move", "hourly", "per_mile", "percentage", "flat"].includes(body.pay_type)) {
      return NextResponse.json(
        { error: "pay_type must be one of: per_move, hourly, per_mile, percentage, flat" },
        { status: 400 }
      )
    }

    if (body.base_rate === undefined || body.base_rate === null) {
      return NextResponse.json(
        { error: "base_rate is required" },
        { status: 400 }
      )
    }

    const insertData = {
      name: body.name,
      pay_type: body.pay_type,
      base_rate: parseFloat(body.base_rate),
      is_company_driver: body.is_company_driver ?? false,
      default_service_type: body.default_service_type || null,
      notes: body.notes || null,
      rate_profile_id: body.rate_profile_id || null,
    }

    // Use service client for insert
    const { data: group, error: createError } = await serviceSupabase
      .from("driver_groups")
      .insert(insertData)
      .select()
      .single()

    if (createError || !group) {
      console.error("Create error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create group" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "driver_group",
      entity_id: group.id,
      action: "created",
      user_id: auth.user!.id,
      details: {
        group_name: group.name,
        pay_type: group.pay_type,
        base_rate: group.base_rate,
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    console.error("Error creating group:", error)
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
    if (body.pay_type !== undefined) {
      if (!["per_move", "hourly", "per_mile", "percentage", "flat"].includes(body.pay_type)) {
        return NextResponse.json(
          { error: "pay_type must be one of: per_move, hourly, per_mile, percentage, flat" },
          { status: 400 }
        )
      }
      updateData.pay_type = body.pay_type
    }
    if (body.base_rate !== undefined) updateData.base_rate = parseFloat(body.base_rate)
    if (body.is_company_driver !== undefined) updateData.is_company_driver = body.is_company_driver
    if (body.default_service_type !== undefined) updateData.default_service_type = body.default_service_type
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.rate_profile_id !== undefined) updateData.rate_profile_id = body.rate_profile_id || null

    const { data: group, error: updateError } = await serviceSupabase
      .from("driver_groups")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (updateError || !group) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update group" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "driver_group",
      entity_id: group.id,
      action: "updated",
      user_id: auth.user!.id,
      details: {
        group_name: group.name,
        updated_fields: Object.keys(updateData),
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ group }, { status: 200 })
  } catch (error) {
    console.error("Error updating group:", error)
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
    const groupId = url.searchParams.get("id")

    if (!groupId) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      )
    }

    // First remove all assignments for this group
    const { error: assignDeleteError } = await serviceSupabase
      .from("driver_group_assignments")
      .delete()
      .eq("driver_group_id", groupId)

    if (assignDeleteError) {
      console.error("Failed to remove group assignments:", assignDeleteError)
    }

    // Delete the group
    const { error: deleteError } = await serviceSupabase
      .from("driver_groups")
      .delete()
      .eq("id", groupId)

    if (deleteError) {
      console.error("Delete error:", deleteError)
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete group" },
        { status: 500 }
      )
    }

    auditLog({
      entity_type: "driver_group",
      entity_id: groupId,
      action: "deleted",
      user_id: auth.user!.id,
      details: {
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting group:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
