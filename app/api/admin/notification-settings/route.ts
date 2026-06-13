// app/api/admin/notification-settings/route.ts
// Admin API for managing system-wide notification preferences
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

// GET — List all notification settings
export async function GET() {
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

    if (!profile || !["admin", "dispatcher", "accounting"].includes(profile.role)) {
      return NextResponse.json({ error: "Staff access required" }, { status: 403 })
    }

    const { data: settings, error: settingsError } = await supabase
      .from("notification_settings")
      .select("*")
      .order("setting_key")

    if (settingsError) {
      console.error("Error fetching notification settings:", settingsError)
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
    }

    return NextResponse.json({ settings: settings || [] })
  } catch (error) {
    console.error("Error in GET /api/admin/notification-settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH — Update a notification setting (toggle enabled, update config)
export async function PATCH(request: NextRequest) {
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

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { id, enabled, config } = body

    if (!id) {
      return NextResponse.json({ error: "Setting ID is required" }, { status: 400 })
    }

    // Build update object — only include fields that were provided
    const updates: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }
    if (typeof enabled === "boolean") updates.enabled = enabled
    if (config && typeof config === "object") updates.config = config

    const adminClient = createAdminClient()

    const { data: updated, error: updateError } = await adminClient
      .from("notification_settings")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating notification setting:", updateError)
      return NextResponse.json({ error: "Failed to update setting" }, { status: 500 })
    }

    // Audit log
    try {
      await adminClient.from("activity_log").insert({
        entity_type: "notification_settings",
        entity_id: id,
        action: "updated",
        user_id: user.id,
        details: {
          setting_key: updated.setting_key,
          changes: { enabled, config },
          changed_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ setting: updated })
  } catch (error) {
    console.error("Error in PATCH /api/admin/notification-settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
