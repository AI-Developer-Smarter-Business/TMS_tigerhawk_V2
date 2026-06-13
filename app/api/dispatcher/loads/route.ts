// app/api/dispatcher/loads/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { createLoadSchema } from "@/lib/validations/schemas"
import { validateBody } from "@/lib/validations/validate"

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check role — dispatcher and admin can list loads
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
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status")
    const load_type = searchParams.get("load_type")
    const driver_id = searchParams.get("driver_id")
    const customer_id = searchParams.get("customer_id")
    const date_from = searchParams.get("date_from")
    const date_to = searchParams.get("date_to")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    let query = supabase
      .from("loads")
      .select(`
        *,
        customers ( id, name, email, phone, address, city, state, zip_code ),
        containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, seal_number, ph_synced_at, vessel_id, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ),
        drivers ( id, name, phone, status )
      `, { count: "exact" })

    // Apply filters
    if (search) {
      query = query.or(
        `reference_number.ilike.%${search}%,ssl.ilike.%${search}%,mbol.ilike.%${search}%,pickup_location.ilike.%${search}%,delivery_location.ilike.%${search}%`
      )
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (load_type) {
      query = query.eq("load_type", load_type)
    }

    if (driver_id) {
      query = query.eq("driver_id", driver_id)
    }

    if (customer_id) {
      query = query.eq("customer_id", customer_id)
    }

    if (date_from) {
      query = query.gte("created_at", date_from)
    }

    if (date_to) {
      query = query.lte("created_at", date_to)
    }

    // Apply pagination
    const offset = (page - 1) * limit
    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

    const { data: loads, error: loadError, count } = await query

    if (loadError) {
      console.error("Loads fetch error:", loadError)
      return NextResponse.json(
        { error: loadError.message || "Failed to fetch loads" },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        data: loads,
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
    console.error("Error fetching loads:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check role — only admin/dispatcher can create loads
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await req.json()

    const result = validateBody(body, createLoadSchema)
    if (!result.success) return result.response
    const data = result.data

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", data.customer_id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "Invalid customer" }, { status: 400 })
    }

    // Verify container if provided
    if (data.container_id) {
      const { data: container, error: containerError } = await supabase
        .from("containers")
        .select("id")
        .eq("id", data.container_id)
        .single()

      if (containerError || !container) {
        return NextResponse.json({ error: "Invalid container" }, { status: 400 })
      }
    }

    // Verify driver if provided
    if (data.driver_id) {
      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("id, status")
        .eq("id", data.driver_id)
        .single()

      if (driverError || !driver) {
        return NextResponse.json({ error: "Invalid driver" }, { status: 400 })
      }

      if (driver.status !== "Available") {
        return NextResponse.json({ error: "Driver is not available" }, { status: 400 })
      }
    }

    // Build load record
    const loadData: Record<string, unknown> = {
      customer_id: data.customer_id,
      container_id: data.container_id || null,
      driver_id: data.driver_id || null,
      pickup_location: data.pickup_location,
      delivery_location: data.delivery_location,
      return_location: data.return_location || null,
      scheduled_pickup: data.scheduled_pickup || null,
      chassis_number: data.chassis_number || null,
      rate: data.rate,
      notes: data.notes || null,
      load_type: data.load_type,
      route_type: data.route_type || null,
      status: data.driver_id ? "Assigned" : "Created",
      pickup_apt_from: data.pickup_apt_from || null,
      pickup_apt_to: data.pickup_apt_to || null,
      delivery_apt_from: data.delivery_apt_from || null,
      delivery_apt_to: data.delivery_apt_to || null,
      ssl: data.ssl || null,
      mbol: data.mbol || null,
      house_bol: data.house_bol || null,
      is_hazmat: data.is_hazmat,
      is_hot: data.is_hot,
      is_overweight: data.is_overweight,
      is_oog: data.is_oog,
      is_street_turn: data.is_street_turn,
      is_tanker: data.is_tanker,
      is_bonded: data.is_bonded,
      is_liquor: data.is_liquor,
      is_ev: data.is_ev,
      is_double: data.is_double,
      is_genset: data.is_genset,
      is_scale: data.is_scale,
    }

    // Insert load using admin client (auth/role validated above)
    const adminSupabase = createAdminClient()

    const { data: load, error: insertError } = await adminSupabase
      .from("loads")
      .insert(loadData)
      .select(`
        *,
        customers ( id, name, email, phone, address, city, state, zip_code ),
        containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state ),
        drivers ( id, name, phone, status )
      `)
      .single()

    if (insertError) {
      console.error("Load insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create load" },
        { status: 500 }
      )
    }

    // Update driver status if assigned
    if (data.driver_id) {
      await adminSupabase
        .from("drivers")
        .update({ status: "On Job" })
        .eq("id", data.driver_id)
    }

    // Log activity
    const { error: auditError } = await adminSupabase.from("activity_log").insert({
      entity_type: "load",
      entity_id: load.id,
      action: "created",
      user_id: user.id,
      details: {
        reference_number: load.reference_number,
        customer_id: data.customer_id,
        status: load.status,
        load_type: load.load_type,
        route_type: load.route_type,
        driver_assigned: !!data.driver_id,
        created_by: user.email,
      },
    })
    if (auditError) console.error("Audit log insert error (create):", auditError)

    return NextResponse.json(load, { status: 201 })
  } catch (error) {
    console.error("Load creation error:", error)
    const message = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
