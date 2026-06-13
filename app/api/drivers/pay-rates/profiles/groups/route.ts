import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { auditLog } from "@/lib/auditLog"

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { authorized: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
    return { authorized: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { authorized: true as const, user }
}

// GET: Fetch group assignments for a profile
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const profileId = url.searchParams.get("profile_id")

  if (profileId) {
    // Get groups for a specific profile
    const { data, error } = await serviceSupabase
      .from("rate_profile_driver_groups")
      .select("driver_group_id, driver_groups(id, name, pay_type)")
      .eq("rate_profile_id", profileId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const groups = (data || []).map((row: any) => row.driver_groups).filter(Boolean)
    return NextResponse.json({ groups })
  }

  // Get all assignments (for building the full picture)
  const { data, error } = await serviceSupabase
    .from("rate_profile_driver_groups")
    .select("rate_profile_id, driver_group_id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data || [] })
}

// PUT: Replace all group assignments for a profile (idempotent)
export async function PUT(request: NextRequest) {
  const auth = await checkAuth()
  if (!auth.authorized) return auth.response

  const body = await request.json()
  const { profile_id, group_ids } = body

  if (!profile_id) return NextResponse.json({ error: "profile_id is required" }, { status: 400 })
  if (!Array.isArray(group_ids)) return NextResponse.json({ error: "group_ids must be an array" }, { status: 400 })

  try {
    // Delete existing assignments for this profile
    const { error: deleteError } = await serviceSupabase
      .from("rate_profile_driver_groups")
      .delete()
      .eq("rate_profile_id", profile_id)

    if (deleteError) throw deleteError

    // Insert new assignments
    if (group_ids.length > 0) {
      const rows = group_ids.map((gid: string) => ({
        rate_profile_id: profile_id,
        driver_group_id: gid,
      }))
      const { error: insertError } = await serviceSupabase
        .from("rate_profile_driver_groups")
        .insert(rows)

      if (insertError) throw insertError
    }

    // Fire-and-forget audit log
    auditLog({
      entity_type: "rate_profile_groups",
      entity_id: profile_id,
      action: "updated",
      user_id: auth.user!.id,
      details: {
        group_count: group_ids.length,
        group_ids: group_ids,
        changed_by: auth.user!.email,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error updating profile groups:", error)
    return NextResponse.json({ error: error.message || "Failed to update groups" }, { status: 500 })
  }
}
