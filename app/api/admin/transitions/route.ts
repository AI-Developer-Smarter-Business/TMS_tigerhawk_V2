// app/api/admin/transitions/route.ts
// Admin API for viewing and updating load status transition rules
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { VALID_LOAD_TRANSITIONS, LoadStatus } from "@/types/dispatcher"
import { getEffectiveTransitions } from "@/lib/transitions"

// All valid statuses for validation
const ALL_STATUSES = Object.keys(VALID_LOAD_TRANSITIONS) as LoadStatus[]
const STATUS_SET = new Set<string>(ALL_STATUSES)

// ─── GET: Return effective transitions + hardcoded defaults for diff ──────
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const effective = await getEffectiveTransitions()

    // Check if DB overrides exist
    const admin = createAdminClient()
    const { data: overrides } = await admin
      .from("load_transition_overrides")
      .select("from_status")
      .limit(1)

    return NextResponse.json({
      transitions: effective,
      defaults: VALID_LOAD_TRANSITIONS,
      hasOverrides: !!(overrides && overrides.length > 0),
      allStatuses: ALL_STATUSES,
    })
  } catch (error) {
    console.error("Error fetching transitions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── PUT: Save transition overrides ──────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const body = await request.json()
    const { transitions } = body as { transitions: Record<string, string[]> }

    if (!transitions || typeof transitions !== "object") {
      return NextResponse.json({ error: "Invalid body: expected { transitions: Record<string, string[]> }" }, { status: 400 })
    }

    // Validate every key and value is a valid LoadStatus
    for (const [fromStatus, toStatuses] of Object.entries(transitions)) {
      if (!STATUS_SET.has(fromStatus)) {
        return NextResponse.json({ error: `Invalid from_status: "${fromStatus}"` }, { status: 400 })
      }
      if (!Array.isArray(toStatuses)) {
        return NextResponse.json({ error: `to_statuses for "${fromStatus}" must be an array` }, { status: 400 })
      }
      for (const ts of toStatuses) {
        if (!STATUS_SET.has(ts)) {
          return NextResponse.json({ error: `Invalid to_status "${ts}" in transitions for "${fromStatus}"` }, { status: 400 })
        }
      }
      // Prevent self-transitions
      if (toStatuses.includes(fromStatus)) {
        return NextResponse.json({ error: `Self-transition not allowed for "${fromStatus}"` }, { status: 400 })
      }
    }

    // Upsert all rows in a transaction-like pattern (delete all + insert all)
    const admin = createAdminClient()

    // Delete existing overrides
    const { error: deleteError } = await admin
      .from("load_transition_overrides")
      .delete()
      .neq("from_status", "__never_match__") // delete all rows

    if (deleteError) {
      console.error("Failed to clear overrides:", deleteError)
      return NextResponse.json({ error: "Failed to save transitions" }, { status: 500 })
    }

    // Insert new rows
    const rows = ALL_STATUSES.map((status) => ({
      from_status: status,
      to_statuses: transitions[status] || [],
      updated_by: user.id,
    }))

    const { error: insertError } = await admin
      .from("load_transition_overrides")
      .insert(rows)

    if (insertError) {
      console.error("Failed to insert overrides:", insertError)
      return NextResponse.json({ error: "Failed to save transitions" }, { status: 500 })
    }

    // Log the change
    await admin.from("activity_log").insert({
      entity_type: "system",
      entity_id: "load_transitions",
      action: "transitions_updated",
      user_id: user.id,
      details: {
        changed_by: user.email,
        statuses_modified: Object.keys(transitions).length,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving transitions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── DELETE: Reset to hardcoded defaults (remove all overrides) ──────────
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("load_transition_overrides")
      .delete()
      .neq("from_status", "__never_match__")

    if (error) {
      console.error("Failed to reset overrides:", error)
      return NextResponse.json({ error: "Failed to reset transitions" }, { status: 500 })
    }

    await admin.from("activity_log").insert({
      entity_type: "system",
      entity_id: "load_transitions",
      action: "transitions_reset",
      user_id: user.id,
      details: { changed_by: user.email },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error resetting transitions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
