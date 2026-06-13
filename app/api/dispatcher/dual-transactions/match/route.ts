import { createClient } from "@/lib/supabase/server"
import { rowToDualPairSlice } from "@/lib/dual-transaction-load-adapter"
import { dualPairCompatible, pairEmptyMilesSaved } from "@/lib/dual-transaction-savings"
import { buildLocationCoordMap, collectLocationStringsFromLoads } from "@/lib/dual-transaction-resolve-server"
import {
  isExportStatusOnDualBoard,
  isImportStatusOnDualBoard,
} from "@/lib/dual-transactions-board-constants"
import { NextRequest, NextResponse } from "next/server"
import { auditLog } from "@/lib/auditLog"
import type { LoadWithRelations } from "@/types/dispatcher"

export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { importLoadId, exportLoadId } = body

    if (!importLoadId || !exportLoadId) {
      return NextResponse.json(
        { error: "Missing importLoadId or exportLoadId" },
        { status: 400 }
      )
    }

    // Fetch both loads
    const { data: importLoad } = await supabase
      .from("loads")
      .select("*")
      .eq("id", importLoadId)
      .single()

    const { data: exportLoad } = await supabase
      .from("loads")
      .select("*")
      .eq("id", exportLoadId)
      .single()

    if (!importLoad || !exportLoad) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Verify they're import/export pair
    if (importLoad.load_type !== "Import" || exportLoad.load_type !== "Export") {
      return NextResponse.json(
        { error: "Invalid load pair: must be Import and Export" },
        { status: 400 }
      )
    }

    if (importLoad.street_turn_match_id || exportLoad.street_turn_match_id) {
      return NextResponse.json(
        { error: "One or both loads are already linked to another match" },
        { status: 400 }
      )
    }

    if (!isImportStatusOnDualBoard(importLoad.status)) {
      return NextResponse.json(
        {
          error:
            "Import load status is not eligible for dual linking on this board (see Dual Transactions eligibility)",
        },
        { status: 400 }
      )
    }

    if (!isExportStatusOnDualBoard(exportLoad.status)) {
      return NextResponse.json(
        {
          error:
            "Export load must be Available or Available At Port to link from this board",
        },
        { status: 400 }
      )
    }

    const impSlice = rowToDualPairSlice(importLoad as LoadWithRelations)
    const expSlice = rowToDualPairSlice(exportLoad as LoadWithRelations)
    if (!dualPairCompatible(impSlice, expSlice)) {
      return NextResponse.json(
        {
          error:
            "Loads must have same SSL and container size category, and import return_location must match export pickup_location",
        },
        { status: 400 }
      )
    }

    const coordMap = await buildLocationCoordMap(
      collectLocationStringsFromLoads([importLoad, exportLoad])
    )
    const { savedMiles, savingsUsd } = pairEmptyMilesSaved(impSlice, expSlice, coordMap)

    // Generate dual transaction match ID
    const matchId = `DT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Update both loads with match ID
    const { error: updateError } = await supabase
      .from("loads")
      .update({
        street_turn_match_id: matchId,
        updated_at: new Date().toISOString(),
      })
      .in("id", [importLoadId, exportLoadId])

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to match loads" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit logs for both loads
    auditLog({
      entity_type: "load",
      entity_id: importLoadId,
      action: "matched_dual_transaction",
      user_id: user.id,
      details: {
        match_id: matchId,
        import_load_id: importLoadId,
        export_load_id: exportLoadId,
        changed_by: user.email,
      },
    })

    auditLog({
      entity_type: "load",
      entity_id: exportLoadId,
      action: "matched_dual_transaction",
      user_id: user.id,
      details: {
        match_id: matchId,
        import_load_id: importLoadId,
        export_load_id: exportLoadId,
        changed_by: user.email,
      },
    })

    return NextResponse.json({
      data: {
        matchId,
        importLoadId,
        exportLoadId,
        message: "Dual transaction matched successfully",
        estimatedSavedMiles: savedMiles,
        estimatedSavingsUsd: savingsUsd,
      },
    })
  } catch (error) {
    console.error("Error matching dual transactions:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
