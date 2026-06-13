import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Service role client bypasses RLS
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch from all 4 organization tables in parallel using service role
    const [
      { data: customers },
      { data: terminals },
      { data: warehouses },
      { data: yards },
    ] = await Promise.all([
      serviceSupabase.from("customers").select("id, name, city, state").order("name"),
      serviceSupabase.from("terminals").select("id, name, city, state").order("name"),
      serviceSupabase.from("warehouses").select("id, name, city, state").order("name"),
      serviceSupabase.from("yards").select("id, name, city, state").order("name"),
    ])

    const locations = [
      ...(customers || []).map((o) => ({ ...o, type: "Customer" as const })),
      ...(terminals || []).map((o) => ({ ...o, type: "Terminal" as const })),
      ...(warehouses || []).map((o) => ({ ...o, type: "Warehouse" as const })),
      ...(yards || []).map((o) => ({ ...o, type: "Yard" as const })),
    ]

    // Sort alphabetically and deduplicate by name (same org can be in multiple tables)
    const seen = new Set<string>()
    const deduplicated = locations
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((loc) => {
        if (seen.has(loc.name)) return false
        seen.add(loc.name)
        return true
      })

    return NextResponse.json({ locations: deduplicated }, { status: 200 })
  } catch (error) {
    console.error("Error fetching organization locations:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
