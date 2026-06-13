// app/api/drivers/[id]/documents/[docId]/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const supabase = await createClient()
    const { id, docId } = await context.params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { data: doc, error: fetchError } = await supabase
      .from("driver_documents")
      .select("*")
      .eq("id", docId)
      .eq("driver_id", id)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const adminSupabase = createAdminClient()

    if (doc.storage_path) {
      await adminSupabase.storage.from("driver-documents").remove([doc.storage_path])
    }

    const { error: deleteError } = await supabase
      .from("driver_documents")
      .delete()
      .eq("id", docId)
      .eq("driver_id", id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    await adminSupabase.from("activity_log").insert({
      entity_type: "driver_document",
      entity_id: docId,
      action: "deleted",
      user_id: user.id,
      details: {
        driver_id: id,
        filename: doc.filename,
        document_type: doc.document_type,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting driver document:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
