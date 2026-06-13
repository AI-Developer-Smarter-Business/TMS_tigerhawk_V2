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
    const allParam = url.searchParams.get("all")

    // Build query
    let query = supabase
      .from("accessorials")
      .select(`
        id,
        code,
        name,
        description,
        charge_type,
        default_amount,
        trigger_type,
        trigger_config,
        container_sizes,
        load_types,
        is_active,
        created_at,
        updated_at
      `)
      .order("code")

    // Filter by active status unless ?all=true
    if (!allParam || allParam !== "true") {
      query = query.eq("is_active", true)
    }

    const { data: accessorials, error: accessorialsError } = await query

    if (accessorialsError) {
      console.error("Accessorials fetch error:", accessorialsError)
      return NextResponse.json(
        { error: accessorialsError.message || "Failed to fetch accessorials" },
        { status: 500 }
      )
    }

    // Fetch group rules for each accessorial
    const { data: groupRules, error: rulesError } = await supabase
      .from("accessorial_group_rules")
      .select("id, accessorial_id, group_id, driver_groups(name)")

    if (rulesError) {
      console.error("Group rules fetch error:", rulesError)
      return NextResponse.json(
        { error: rulesError.message || "Failed to fetch group rules" },
        { status: 500 }
      )
    }

    return NextResponse.json({ accessorials, groupRules }, { status: 200 })
  } catch (error) {
    console.error("Error fetching accessorials:", error)
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
    if (!body.code) {
      return NextResponse.json(
        { error: "code is required" },
        { status: 400 }
      )
    }

    if (!body.name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      )
    }

    if (!body.charge_type || !["fixed", "percentage", "tiered"].includes(body.charge_type)) {
      return NextResponse.json(
        { error: "charge_type must be 'fixed', 'percentage', or 'tiered'" },
        { status: 400 }
      )
    }

    const insertData = {
      code: body.code,
      name: body.name,
      description: body.description || null,
      charge_type: body.charge_type,
      default_amount: body.default_amount !== undefined ? parseFloat(body.default_amount) : null,
      trigger_type: body.trigger_type || null,
      trigger_config: body.trigger_config || null,
      container_sizes: Array.isArray(body.container_sizes) ? body.container_sizes : null,
      load_types: Array.isArray(body.load_types) ? body.load_types : null,
      is_active: body.is_active ?? true,
    }

    // Use service client for insert
    const { data: accessorial, error: createError } = await serviceSupabase
      .from("accessorials")
      .insert(insertData)
      .select()
      .single()

    if (createError || !accessorial) {
      console.error("Create error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create accessorial" },
        { status: 500 }
      )
    }

    // Handle group assignments if provided
    if (body.group_ids && Array.isArray(body.group_ids) && body.group_ids.length > 0) {
      const rules = body.group_ids.map((gid: string) => ({
        accessorial_id: accessorial.id,
        group_id: gid,
      }))
      const { error: rulesError } = await serviceSupabase
        .from("accessorial_group_rules")
        .insert(rules)

      if (rulesError) {
        console.error("Error inserting group rules:", rulesError)
        return NextResponse.json(
          { error: rulesError.message || "Failed to create group assignments" },
          { status: 500 }
        )
      }
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "accessorial",
      entity_id: accessorial.id,
      action: "created",
      user_id: auth.user!.id,
      details: {
        code: accessorial.code,
        name: accessorial.name,
        charge_type: accessorial.charge_type,
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ accessorial }, { status: 201 })
  } catch (error) {
    console.error("Error creating accessorial:", error)
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

    if (body.code !== undefined) {
      updateData.code = body.code
    }
    if (body.name !== undefined) {
      updateData.name = body.name
    }
    if (body.description !== undefined) {
      updateData.description = body.description
    }
    if (body.charge_type !== undefined) {
      updateData.charge_type = body.charge_type
    }
    if (body.default_amount !== undefined) {
      updateData.default_amount = parseFloat(body.default_amount)
    }
    if (body.trigger_type !== undefined) {
      updateData.trigger_type = body.trigger_type
    }
    if (body.trigger_config !== undefined) {
      updateData.trigger_config = body.trigger_config
    }
    if (body.container_sizes !== undefined) {
      updateData.container_sizes = Array.isArray(body.container_sizes) ? body.container_sizes : null
    }
    if (body.load_types !== undefined) {
      updateData.load_types = Array.isArray(body.load_types) ? body.load_types : null
    }
    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active
    }

    // Use service client for update
    const { data: accessorial, error: updateError } = await serviceSupabase
      .from("accessorials")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single()

    if (updateError || !accessorial) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: updateError?.message || "Failed to update accessorial" },
        { status: 500 }
      )
    }

    // Handle group assignments if provided
    if (body.group_ids !== undefined && Array.isArray(body.group_ids)) {
      // Delete existing rules
      const { error: deleteError } = await serviceSupabase
        .from("accessorial_group_rules")
        .delete()
        .eq("accessorial_id", body.id)

      if (deleteError) {
        console.error("Error deleting old group rules:", deleteError)
        return NextResponse.json(
          { error: deleteError.message || "Failed to update group assignments" },
          { status: 500 }
        )
      }

      // Insert new rules
      if (body.group_ids.length > 0) {
        const rules = body.group_ids.map((gid: string) => ({
          accessorial_id: body.id,
          group_id: gid,
        }))
        const { error: insertError } = await serviceSupabase
          .from("accessorial_group_rules")
          .insert(rules)

        if (insertError) {
          console.error("Error inserting new group rules:", insertError)
          return NextResponse.json(
            { error: insertError.message || "Failed to update group assignments" },
            { status: 500 }
          )
        }
      }
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "accessorial",
      entity_id: accessorial.id,
      action: "updated",
      user_id: auth.user!.id,
      details: {
        code: accessorial.code,
        updated_fields: Object.keys(updateData),
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ accessorial }, { status: 200 })
  } catch (error) {
    console.error("Error updating accessorial:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
