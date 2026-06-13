// app/api/dispatcher/street-turns/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { SSLGroup, LoadWithRelations } from "@/types/dispatcher"

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

    // Get query parameters
    const { searchParams } = new URL(req.url)
    const ssl_filter = searchParams.get("ssl")
    const container_size = searchParams.get("container_size")

    // Fetch all street turn loads (is_street_turn = true)
    let query = supabase
      .from("loads")
      .select(`
        *,
        customers ( id, name, email, phone ),
        containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state ),
        drivers ( id, name, phone, status )
      `)
      .eq("is_street_turn", true)

    // Filter by SSL if provided
    if (ssl_filter) {
      query = query.eq("ssl", ssl_filter)
    }

    // Filter by container size if provided
    if (container_size) {
      query = query.eq("container_size", container_size)
    }

    const { data: streetTurnLoads, error: loadsError } = await query.order("ssl", { ascending: true })

    if (loadsError) {
      console.error("Street turns fetch error:", loadsError)
      return NextResponse.json(
        { error: loadsError.message || "Failed to fetch street turns" },
        { status: 500 }
      )
    }

    // Group by SSL and container size
    const groupedBySSL: Record<string, SSLGroup> = {}

    streetTurnLoads.forEach((load) => {
      const ssl = load.ssl || "Unknown"
      const size = load.container_size || "Unknown"
      const key = `${ssl}-${size}`

      if (!groupedBySSL[key]) {
        groupedBySSL[key] = {
          ssl,
          containerSize: size,
          importCount: 0,
          exportCount: 0,
          imports: [],
          exports: [],
        }
      }

      const group = groupedBySSL[key]
      const typedLoad = load as LoadWithRelations

      if (load.load_type === "Import") {
        group.importCount++
        group.imports.push(typedLoad)
      } else if (load.load_type === "Export") {
        group.exportCount++
        group.exports.push(typedLoad)
      }
    })

    // Convert to array and sort
    const groupedArray = Object.values(groupedBySSL)
      .sort((a, b) => {
        if (a.ssl !== b.ssl) {
          return a.ssl.localeCompare(b.ssl)
        }
        return a.containerSize.localeCompare(b.containerSize)
      })

    // Filter for matches (where both imports and exports exist)
    const matches = groupedArray.filter(
      (group) => group.importCount > 0 && group.exportCount > 0
    )

    // Filter for unmatched
    const unmatched = groupedArray.filter(
      (group) => group.importCount === 0 || group.exportCount === 0
    )

    return NextResponse.json({
      data: {
        matches,
        unmatched,
        summary: {
          totalSSLGroups: groupedArray.length,
          matchedPairs: matches.length,
          unmatchedGroups: unmatched.length,
          totalImports: streetTurnLoads.filter((l) => l.load_type === "Import").length,
          totalExports: streetTurnLoads.filter((l) => l.load_type === "Export").length,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching street turns:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
