import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { auditLog } from "@/lib/auditLog"

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

    // Verify same SSL and container size
    if (
      importLoad.ssl !== exportLoad.ssl ||
      importLoad.container_size !== exportLoad.container_size
    ) {
      return NextResponse.json(
        { error: "Loads must have same SSL and container size" },
        { status: 400 }
      )
    }

    // Generate street turn match ID
    const matchId = `ST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Update both loads with street turn match ID
    const { error: updateError } = await supabase
      .from("loads")
      .update({
        street_turn_match_id: matchId,
        is_street_turn: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", [importLoadId, exportLoadId])

    if (updateError) {
      console.error("Update error:", updateError)
      return NextResponse.json(
        { error: "Failed to link loads" },
        { status: 500 }
      )
    }

    // Fire-and-forget audit logs for both loads
    auditLog({
      entity_type: "load",
      entity_id: importLoadId,
      action: "linked_street_turn",
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
      action: "linked_street_turn",
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
        message: "Street turn pair linked successfully",
      },
    })
  } catch (error) {
    console.error("Error linking street turns:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
