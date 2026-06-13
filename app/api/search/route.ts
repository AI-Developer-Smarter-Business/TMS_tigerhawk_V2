// app/api/search/route.ts
// Unified global search across all major entities
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type SearchResult = {
  id: string
  type: "load" | "container" | "driver" | "vessel" | "customer"
  title: string
  subtitle: string | null
  url: string
}

const MAX_PER_CATEGORY = 5

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pattern = `%${q}%`

  // Run all searches in parallel
  const [loadsRes, containersRes, driversRes, vesselsRes, customersRes] =
    await Promise.all([
      // Loads — search reference #, BOL, container #, customer name, PO, vessel
      supabase
        .from("loads")
        .select(
          "id, reference_number, status, load_type, pickup_location, delivery_location, container_number, mbol, house_bol, vessel_name, purchase_order, shipment_number, customers(name)"
        )
        .or(
          `reference_number.ilike.${pattern},container_number.ilike.${pattern},mbol.ilike.${pattern},house_bol.ilike.${pattern},vessel_name.ilike.${pattern},purchase_order.ilike.${pattern},shipment_number.ilike.${pattern},pickup_location.ilike.${pattern},delivery_location.ilike.${pattern}`
        )
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(MAX_PER_CATEGORY),

      // Containers — search container #, BOL, booking #
      supabase
        .from("containers")
        .select(
          "id, container_number, bol_number, booking_number, status, size, type, vessels(name, terminal)"
        )
        .or(
          `container_number.ilike.${pattern},bol_number.ilike.${pattern},booking_number.ilike.${pattern},seal_number.ilike.${pattern}`
        )
        .order("created_at", { ascending: false })
        .limit(MAX_PER_CATEGORY),

      // Drivers — search name, phone, username, email
      supabase
        .from("drivers")
        .select("id, name, first_name, last_name, phone, username, email, status, truck_number")
        .or(
          `name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},username.ilike.${pattern},email.ilike.${pattern}`
        )
        .order("name", { ascending: true })
        .limit(MAX_PER_CATEGORY),

      // Vessels — search name, voyage #, shipping line
      supabase
        .from("vessels")
        .select("id, name, voyage_number, shipping_line, terminal, eta")
        .or(
          `name.ilike.${pattern},voyage_number.ilike.${pattern},shipping_line.ilike.${pattern}`
        )
        .order("eta", { ascending: false, nullsFirst: false })
        .limit(MAX_PER_CATEGORY),

      // Customers — search name, email, phone
      supabase
        .from("customers")
        .select("id, name, email, phone, city, state")
        .or(
          `name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
        )
        .order("name", { ascending: true })
        .limit(MAX_PER_CATEGORY),
    ])

  const results: SearchResult[] = []

  // Map loads
  if (loadsRes.data) {
    for (const l of loadsRes.data) {
      const customer = (l.customers as unknown as { name: string } | null)?.name
      const parts = [l.status, l.load_type, customer].filter(Boolean)
      results.push({
        id: l.id,
        type: "load",
        title: l.reference_number || "Load",
        subtitle: parts.join(" · ") || null,
        url: `/dashboard/dispatcher`,
      })
    }
  }

  // Map containers
  if (containersRes.data) {
    for (const c of containersRes.data) {
      const vessel = (c.vessels as unknown as { name: string; terminal: string } | null)
      const parts = [c.status, c.size, vessel?.name, vessel?.terminal].filter(Boolean)
      results.push({
        id: c.id,
        type: "container",
        title: c.container_number || "Container",
        subtitle: parts.join(" · ") || null,
        url: `/dashboard/containers`,
      })
    }
  }

  // Map drivers
  if (driversRes.data) {
    for (const d of driversRes.data) {
      const displayName =
        [d.first_name, d.last_name].filter(Boolean).join(" ") || d.name || "Driver"
      const parts = [d.status, d.truck_number ? `Truck ${d.truck_number}` : null, d.phone].filter(
        Boolean
      )
      results.push({
        id: d.id,
        type: "driver",
        title: displayName,
        subtitle: parts.join(" · ") || null,
        url: `/dashboard/drivers`,
      })
    }
  }

  // Map vessels
  if (vesselsRes.data) {
    for (const v of vesselsRes.data) {
      const parts = [
        v.voyage_number ? `Voyage ${v.voyage_number}` : null,
        v.shipping_line,
        v.terminal,
      ].filter(Boolean)
      results.push({
        id: v.id,
        type: "vessel",
        title: v.name || "Vessel",
        subtitle: parts.join(" · ") || null,
        url: `/dashboard/vessels`,
      })
    }
  }

  // Map customers
  if (customersRes.data) {
    for (const c of customersRes.data) {
      const parts = [c.email, c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state, c.phone].filter(Boolean)
      results.push({
        id: c.id,
        type: "customer",
        title: c.name || "Customer",
        subtitle: parts.join(" · ") || null,
        url: `/dashboard/organizations`,
      })
    }
  }

  return NextResponse.json({ results })
}
