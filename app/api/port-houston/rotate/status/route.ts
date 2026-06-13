// app/api/port-houston/rotate/status/route.ts
// Returns the current rotation progress from port_houston_sync table.
// Polled by the client-side RotationStatus component.

import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from("port_houston_sync")
      .select("value, updated_at")
      .eq("key", "rotate_status")
      .single()

    if (error || !data?.value) {
      return NextResponse.json({ state: "idle" })
    }

    try {
      const progress = JSON.parse(data.value)
      return NextResponse.json(progress)
    } catch {
      return NextResponse.json({ state: "idle" })
    }
  } catch {
    return NextResponse.json({ state: "idle" })
  }
}
