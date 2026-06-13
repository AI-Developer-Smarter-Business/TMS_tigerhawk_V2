// app/api/dispatcher/problem-containers/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url)
    const hold_type = searchParams.get("hold_type") // 'customs', 'freight', 'terminal', 'fees', 'other'
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    // Build query to find loads with holds or LFD issues
    let query = supabase
      .from("loads")
      .select(`
        *,
        customers ( id, name, email, phone ),
        containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line ),
        drivers ( id, name, phone, status )
      `, { count: "exact" })

    // Filter by hold type or get all holds
    const holdConditions = []

    if (!hold_type || hold_type === "freight") {
      holdConditions.push(`freight_hold.neq.none`)
    }
    if (!hold_type || hold_type === "terminal") {
      holdConditions.push(`terminal_hold.neq.none`)
    }
    if (!hold_type || hold_type === "fees") {
      holdConditions.push(`fees_hold.neq.none`)
    }
    if (!hold_type || hold_type === "other") {
      holdConditions.push(`other_hold.neq.none`)
    }

    // Build the OR condition
    if (holdConditions.length > 0) {
      query = query.or(holdConditions.join(","))
    }

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

    const { data: problemLoads, error: loadsError, count } = await query

    if (loadsError) {
      console.error("Problem containers fetch error:", loadsError)
      return NextResponse.json(
        { error: loadsError.message || "Failed to fetch problem containers" },
        { status: 500 }
      )
    }

    // Enhance response with hold details
    const detailedProblems = problemLoads.map((load) => ({
      ...load,
      holds: {
        freight: load.freight_hold !== "none" ? { status: load.freight_hold, note: load.freight_hold_note } : null,
        terminal: load.terminal_hold !== "none" ? { status: load.terminal_hold, note: load.terminal_hold_note } : null,
        fees: load.fees_hold !== "none" ? { status: load.fees_hold, note: load.fees_hold_note } : null,
        other: load.other_hold !== "none" ? { status: load.other_hold, note: load.other_hold_note } : null,
        carrier: load.carrier_hold || false,
      },
      lfdIssue: null as { type: string; daysOverdue: number } | null,
    }))

    // Check for LFD issues
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    detailedProblems.forEach((problem) => {
      const container = problem.containers
        ? Array.isArray(problem.containers)
          ? problem.containers[0]
          : problem.containers
        : null

      if (container?.last_free_day) {
        const lfdDate = new Date(container.last_free_day)
        lfdDate.setHours(0, 0, 0, 0)
        if (lfdDate < today) {
          const daysOverdue = Math.floor((today.getTime() - lfdDate.getTime()) / (1000 * 60 * 60 * 24))
          problem.lfdIssue = {
            type: "last_free_day_passed",
            daysOverdue,
          }
        }
      }
    })

    return NextResponse.json(
      {
        data: detailedProblems,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching problem containers:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
