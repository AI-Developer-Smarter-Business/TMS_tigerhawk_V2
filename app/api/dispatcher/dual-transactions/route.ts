import { createClient } from "@/lib/supabase/server"
import { rowToDualPairSlice } from "@/lib/dual-transaction-load-adapter"
import {
  dualPairCompatible,
  pairEmptyMilesSaved,
  potentialSavingsUsdGreedy,
  sumPairSavingsUsd,
} from "@/lib/dual-transaction-savings"
import { buildLocationCoordMap, collectLocationStringsFromLoads } from "@/lib/dual-transaction-resolve-server"
import { NextRequest, NextResponse } from "next/server"
import { isoDateSchema } from "@/lib/validations/schemas"
import type { LoadWithRelations } from "@/types/dispatcher"

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
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const sslFilter = searchParams.get("ssl")
    const terminalFilter = searchParams.get("terminal")

    // Validate date params if provided
    if (dateFrom && !isoDateSchema.safeParse(dateFrom).success) {
      return NextResponse.json({ error: "Invalid dateFrom format — expected ISO date" }, { status: 400 })
    }
    if (dateTo && !isoDateSchema.safeParse(dateTo).success) {
      return NextResponse.json({ error: "Invalid dateTo format — expected ISO date" }, { status: 400 })
    }

    // Fetch import loads that have been delivered and need return
    let importReturnsQuery = supabase
      .from("loads")
      .select(`
        *,
        customers ( id, name, email, phone ),
        containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line ),
        drivers ( id, name, phone, status )
      `)
      .eq("load_type", "Import")
      .eq("status", "Delivered")
      .is("street_turn_match_id", null)

    if (dateFrom) {
      importReturnsQuery = importReturnsQuery.gte("actual_delivery", dateFrom)
    }
    if (dateTo) {
      importReturnsQuery = importReturnsQuery.lte("actual_delivery", dateTo)
    }
    if (sslFilter) {
      importReturnsQuery = importReturnsQuery.eq("ssl", sslFilter)
    }

    const { data: importReturns } = await importReturnsQuery.order("actual_delivery", { ascending: false })

    // Fetch export loads that need pickup and don't have a matched import return
    let exportPickupsQuery = supabase
      .from("loads")
      .select(`
        *,
        customers ( id, name, email, phone ),
        containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line ),
        drivers ( id, name, phone, status )
      `)
      .eq("load_type", "Export")
      .in("status", ["Available", "Pending", "Created", "Assigned"])
      .is("street_turn_match_id", null)

    if (dateFrom) {
      exportPickupsQuery = exportPickupsQuery.gte("created_at", dateFrom)
    }
    if (dateTo) {
      exportPickupsQuery = exportPickupsQuery.lte("created_at", dateTo)
    }
    if (sslFilter) {
      exportPickupsQuery = exportPickupsQuery.eq("ssl", sslFilter)
    }
    if (terminalFilter) {
      exportPickupsQuery = exportPickupsQuery.eq("pickup_location", terminalFilter)
    }

    const { data: exportPickups } = await exportPickupsQuery.order("created_at", { ascending: false })

    // Calculate stats
    const importReturnsCount = importReturns?.length || 0
    const exportPickupsCount = exportPickups?.length || 0

    const importReturnsList = importReturns || []
    const exportPickupsList = exportPickups || []

    const allRows = [...importReturnsList, ...exportPickupsList]
    const coordMap = await buildLocationCoordMap(collectLocationStringsFromLoads(allRows))

    const potentialMatches: Array<{
      import: (typeof importReturnsList)[0]
      export: (typeof exportPickupsList)[0]
      estimatedSavings: number
      estimatedSavedMiles: number
    }> = []

    importReturnsList.forEach((importLoad) => {
      exportPickupsList.forEach((exportLoad) => {
        const imp = rowToDualPairSlice(importLoad as LoadWithRelations)
        const exp = rowToDualPairSlice(exportLoad as LoadWithRelations)
        if (!dualPairCompatible(imp, exp)) return
        const { savedMiles, savingsUsd } = pairEmptyMilesSaved(imp, exp, coordMap)
        potentialMatches.push({
          import: importLoad,
          export: exportLoad,
          estimatedSavings: savingsUsd,
          estimatedSavedMiles: savedMiles,
        })
      })
    })

    potentialMatches.sort((a, b) => b.estimatedSavings - a.estimatedSavings)

    const importSlices = importReturnsList.map((r) => rowToDualPairSlice(r as LoadWithRelations))
    const exportSlices = exportPickupsList.map((r) => rowToDualPairSlice(r as LoadWithRelations))
    const { totalUsd: totalPotentialSavingsUsd } = potentialSavingsUsdGreedy(
      importSlices,
      exportSlices,
      coordMap
    )
    const { totalUsd: sumPairwiseUsd } = sumPairSavingsUsd(
      potentialMatches.map((m) => ({
        returnLoad: rowToDualPairSlice(m.import as LoadWithRelations),
        pickupLoad: rowToDualPairSlice(m.export as LoadWithRelations),
      })),
      coordMap
    )

    return NextResponse.json({
      data: {
        importReturns: importReturns || [],
        exportPickups: exportPickups || [],
        potentialMatches,
        summary: {
          importReturnsCount,
          exportPickupsCount,
          potentialMatchesCount: potentialMatches.length,
          totalPotentialSavingsUsd,
          /** Sum of per-pair estimates (pairs can share loads — informational). */
          sumPairwisePotentialSavingsUsd: sumPairwiseUsd,
        },
      },
    })
  } catch (error) {
    console.error("Error fetching dual transactions:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
