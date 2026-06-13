import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const STAFF_ROLES = ["admin", "dispatcher", "accounting", "finance"] as const

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !(STAFF_ROLES as readonly string[]).includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200)
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0)

    const admin = createAdminClient()
    const { data, error, count } = await admin
      .from("activity_log")
      .select("id, entity_type, entity_id, action, details, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to fetch notifications" }, { status: 500 })
    }

    return NextResponse.json({
      notifications: data || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error("GET /api/notifications error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
