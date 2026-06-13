// app/api/portal/loads/route.ts
// Customer portal API: list loads for the authenticated customer
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify customer role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, customer_id")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "customer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse query params
    const { searchParams } = request.nextUrl
    const status = searchParams.get("status") // "active" | "completed" | null (all)
    const search = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    // Build query (RLS scopes to customer automatically)
    let query = supabase
      .from("loads")
      .select(`
        id,
        reference_number,
        status,
        load_type,
        container_size,
        ssl,
        pickup_location,
        delivery_location,
        vessel_eta,
        actual_delivery,
        created_at,
        updated_at,
        containers (
          id, container_number, size, shipping_line, last_free_day, type, status
        )
      `)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Status filter
    if (status === "active") {
      query = query.not("status", "in", '("Completed","Cancelled")')
    } else if (status === "completed") {
      query = query.in("status", ["Completed", "Cancelled"])
    }

    // Search filter
    if (search) {
      query = query.or(
        `reference_number.ilike.%${search}%,pickup_location.ilike.%${search}%,delivery_location.ilike.%${search}%`
      )
    }

    const { data: loads, error } = await query

    if (error) {
      console.error("Portal loads fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ loads: loads || [] })
  } catch (error) {
    console.error("Portal loads API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
