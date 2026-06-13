// app/api/port-houston/sync/route.ts
// Manual sync trigger — called by "Sync Now" button on vessels/containers page

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { fullSync } from "@/lib/port-houston/sync"

// Vercel Hobby = 10s, Pro = 60s.  Set maxDuration for Pro if available.
export const maxDuration = 60

export async function POST() {
  const startTime = Date.now()

  try {
    // Auth check
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Role check — admin or dispatcher only
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    console.log("[PH Sync] Starting manual sync for user:", user.id)

    // Run full sync (vessels then containers)
    const result = await fullSync()

    const durationMs = Date.now() - startTime
    console.log(
      `[PH Sync] Complete in ${durationMs}ms — ${result.vessels} vessels, ${result.containers} containers, ${result.errors.length} errors`
    )

    return NextResponse.json({
      success: true,
      vessels: result.vessels,
      containers: result.containers,
      errors: result.errors,
      syncedAt: new Date().toISOString(),
      durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    console.error(`[PH Sync] Failed after ${durationMs}ms:`, error)

    const message =
      error instanceof Error ? error.message : "Sync failed unexpectedly"

    return NextResponse.json(
      { error: message, durationMs },
      { status: 500 }
    )
  }
}
