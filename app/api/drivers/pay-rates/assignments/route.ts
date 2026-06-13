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
    const driverId = url.searchParams.get("driver_id")
    const groupId = url.searchParams.get("group_id")

    // Build query
    let query = supabase
      .from("driver_group_assignments")
      .select(`
        id,
        driver_id,
        driver_group_id,
        effective_date,
        expires_date,
        created_at,
        updated_at,
        drivers(name),
        driver_groups(name)
      `)

    if (driverId) {
      query = query.eq("driver_id", driverId)
    }

    if (groupId) {
      query = query.eq("driver_group_id", groupId)
    }

    const { data: assignments, error: assignmentsError } = await query.order("effective_date", { ascending: false })

    if (assignmentsError) {
      console.error("Assignments fetch error:", assignmentsError)
      return NextResponse.json(
        { error: assignmentsError.message || "Failed to fetch assignments" },
        { status: 500 }
      )
    }

    // Transform to flatten driver and group names
    const transformedAssignments = (assignments || []).map((assignment: any) => ({
      ...assignment,
      driver_name: assignment.drivers?.name || null,
      group_name: assignment.driver_groups?.name || null,
      drivers: undefined,
      driver_groups: undefined,
    }))

    return NextResponse.json({ assignments: transformedAssignments }, { status: 200 })
  } catch (error) {
    console.error("Error fetching assignments:", error)
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
    if (!body.driver_id) {
      return NextResponse.json(
        { error: "driver_id is required" },
        { status: 400 }
      )
    }

    if (!body.driver_group_id) {
      return NextResponse.json(
        { error: "driver_group_id is required" },
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
      driver_id: body.driver_id,
      driver_group_id: body.driver_group_id,
      effective_date: body.effective_date,
      expires_date: body.expires_date || null,
    }

    // Use service client for insert
    const { data: assignment, error: createError } = await serviceSupabase
      .from("driver_group_assignments")
      .insert(insertData)
      .select()
      .single()

    if (createError || !assignment) {
      console.error("Create error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create assignment" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "driver_group_assignment",
      entity_id: assignment.id,
      action: "created",
      user_id: auth.user!.id,
      details: {
        driver_id: assignment.driver_id,
        driver_group_id: assignment.driver_group_id,
        effective_date: assignment.effective_date,
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error("Error creating assignment:", error)
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
    const assignmentId = url.searchParams.get("id")

    if (!assignmentId) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      )
    }

    // Use service client for delete
    const { error: deleteError } = await serviceSupabase
      .from("driver_group_assignments")
      .delete()
      .eq("id", assignmentId)

    if (deleteError) {
      console.error("Delete error:", deleteError)
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete assignment" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "driver_group_assignment",
      entity_id: assignmentId,
      action: "deleted",
      user_id: auth.user!.id,
      details: {
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting assignment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
