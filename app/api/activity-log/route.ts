// app/api/activity-log/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and dispatchers can view activity logs
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const url = new URL(request.url)
    const entityType = url.searchParams.get("entity_type")
    const action = url.searchParams.get("action")
    const startDate = url.searchParams.get("start_date")
    const endDate = url.searchParams.get("end_date")
    const search = url.searchParams.get("search")
    const limit = parseInt(url.searchParams.get("limit") || "100")
    const offset = parseInt(url.searchParams.get("offset") || "0")

    let query = adminSupabase
      .from("activity_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (entityType) {
      query = query.eq("entity_type", entityType)
    }
    if (action) {
      query = query.eq("action", action)
    }
    if (startDate) {
      query = query.gte("created_at", startDate)
    }
    if (endDate) {
      // Add time to end date to include the full day
      query = query.lte("created_at", `${endDate}T23:59:59.999Z`)
    }
    if (search && search.trim()) {
      // Search by user email stored in details JSON fields
      // Use individual ilike filters joined with OR
      query = query.or(
        [
          `details->>name.ilike.%${search}%`,
          `details->>created_by.ilike.%${search}%`,
          `details->>updated_by.ilike.%${search}%`,
          `details->>deleted_by.ilike.%${search}%`,
          `details->>changed_by.ilike.%${search}%`,
        ].join(",")
      )
    }

    const { data: logs, error, count } = await query

    if (error) {
      console.error("Activity log fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch activity logs" },
        { status: 500 }
      )
    }

    // Enrich logs with user email from the details JSON (already stored on every log entry)
    const enrichedLogs = (logs || []).map((log: any) => ({
      ...log,
      user_email: log.details?.created_by || log.details?.updated_by || log.details?.deleted_by || log.details?.changed_by || log.details?.target_email || "Unknown",
    }))

    // Get distinct entity types for filter dropdown
    const { data: entityTypesRaw } = await adminSupabase
      .from("activity_log")
      .select("entity_type")

    const distinctEntityTypes = [...new Set((entityTypesRaw || []).map((e: any) => e.entity_type))].sort()

    // Get distinct actions for filter dropdown
    const { data: actionsRaw } = await adminSupabase
      .from("activity_log")
      .select("action")

    const distinctActions = [...new Set((actionsRaw || []).map((a: any) => a.action))].sort()

    return NextResponse.json({
      logs: enrichedLogs,
      total: count || 0,
      entityTypes: distinctEntityTypes,
      actions: distinctActions,
    })
  } catch (error) {
    console.error("Error fetching activity logs:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
