import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const category = url.searchParams.get("category")
    const allParam = url.searchParams.get("all")

    let query = supabase
      .from("charge_codes")
      .select("code, name, category, description, is_active")
      .order("code")

    // Filter by active unless ?all=true
    if (!allParam || allParam !== "true") {
      query = query.eq("is_active", true)
    }

    // Filter by category if provided
    if (category) {
      query = query.eq("category", category)
    }

    const { data: chargeCodes, error } = await query

    if (error) {
      console.error("Charge codes fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch charge codes" },
        { status: 500 }
      )
    }

    return NextResponse.json({ charge_codes: chargeCodes || [] }, { status: 200 })
  } catch (error) {
    console.error("Error fetching charge codes:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
