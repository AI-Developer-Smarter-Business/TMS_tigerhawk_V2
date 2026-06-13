import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Short CDN/browser cache; list changes rarely. Auth required — use private cache. */
export const revalidate = 120

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: terminals, error } = await supabase
      .from("terminals")
      .select("id, name")
      .order("name")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { terminals: terminals ?? [] },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
