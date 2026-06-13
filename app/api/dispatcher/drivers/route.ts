// app/api/dispatcher/drivers/route.ts
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

    if (!profile || !["admin", "dispatcher", "driver"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(req.url)
    const status_filter = searchParams.get("status")
    const search = searchParams.get("search") || ""

    // Fetch drivers with their assigned loads
    let query = supabase
      .from("drivers")
      .select(`
        id,
        name,
        phone,
        status,
        loads (
          id,
          reference_number,
          status,
          pickup_location,
          delivery_location,
          load_type
        )
      `)

    // Apply status filter if provided
    if (status_filter) {
      query = query.eq("status", status_filter)
    }

    // Apply search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data: drivers, error: driversError } = await query.order("name", { ascending: true })

    if (driversError) {
      console.error("Drivers fetch error:", driversError)
      return NextResponse.json(
        { error: driversError.message || "Failed to fetch drivers" },
        { status: 500 }
      )
    }

    // Transform response to include current load and active load count
    const driversWithDetails = drivers.map((driver) => {
      const loads = Array.isArray(driver.loads) ? driver.loads : []
      const activeLoads = loads.filter((load) =>
        ["Dispatched", "In Transit", "Assigned"].includes(load.status)
      )

      return {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        status: driver.status,
        currentLoad: activeLoads.length > 0 ? activeLoads[0] : null,
        activeLoadCount: activeLoads.length,
        allLoads: loads,
      }
    })

    return NextResponse.json({
      data: driversWithDetails,
      total: driversWithDetails.length,
    })
  } catch (error) {
    console.error("Error fetching drivers:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
