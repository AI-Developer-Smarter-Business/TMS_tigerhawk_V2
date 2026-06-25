// POST — POD signed/submitted → auto-close open delivery_wait (WT.28).
import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getUserFromRequest } from "@/lib/supabase/get-user-from-request"
import { resolveWaitTimeAccess } from "@/lib/wait-time/access"
import { handlePodSignedSubmitted } from "@/lib/wait-time/handle-pod-signed-submitted"

export const runtime = "nodejs"

type Props = { params: Promise<{ id: string }> }

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    },
  })
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id: loadId } = await params
    const { user, supabase } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await resolveWaitTimeAccess(supabase, user, loadId)
    if (!access.canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let body: Record<string, unknown> = {}
    try {
      const raw = await request.text()
      if (raw.trim()) {
        body = JSON.parse(raw) as Record<string, unknown>
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const submittedAt =
      typeof body.submitted_at === "string" ? body.submitted_at : undefined
    const documentId =
      typeof body.document_id === "string" ? body.document_id : undefined

    const adminSupabase = createAdminClient()
    const result = await handlePodSignedSubmitted(adminSupabase, {
      loadId,
      submittedAt,
      source: "api",
      actorUserId: user.id,
      documentId,
    })

    if (!result.ok) {
      const status = result.reason === "load_not_found" ? 404 : 500
      return NextResponse.json(
        { error: result.message ?? "Failed to process POD signed event" },
        { status },
      )
    }

    return NextResponse.json({
      closed: result.closed,
      load_id: result.loadId,
      event_id: result.eventId ?? null,
      reason: result.reason ?? null,
    })
  } catch (error) {
    console.error("[pod-signed POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
