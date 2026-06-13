// app/api/dispatcher/loads/[id]/audit/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission - staff only
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify load exists
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id")
      .eq("id", id)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Fetch audit log entries
    const { data: auditLog, error: auditError } = await supabase
      .from("load_audit_log")
      .select("*")
      .eq("load_id", id)
      .order("changed_at", { ascending: false })

    if (auditError) {
      console.error("Audit log fetch error:", auditError)
      return NextResponse.json(
        { error: auditError.message || "Failed to fetch audit log" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: auditLog,
      total: auditLog.length,
    })
  } catch (error) {
    console.error("Error fetching audit log:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
