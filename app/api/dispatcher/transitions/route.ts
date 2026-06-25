// GET effective load status transitions for driver mobile + dispatcher UI (read-only).
import { NextRequest, NextResponse } from "next/server"

import { getEffectiveTransitions } from "@/lib/transitions"
import { getUserFromRequest } from "@/lib/supabase/get-user-from-request"

export async function GET(request: NextRequest) {
  try {
    const { user } = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const transitions = await getEffectiveTransitions()
    return NextResponse.json({ transitions })
  } catch (error) {
    console.error("Error fetching dispatcher transitions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
