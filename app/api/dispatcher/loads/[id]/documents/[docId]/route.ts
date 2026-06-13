// app/api/dispatcher/loads/[id]/documents/[docId]/route.ts
import { getUserFromRequest } from "@/lib/supabase/get-user-from-request"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { user, supabase } = await getUserFromRequest(request)
    const { id, docId } = await context.params

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Fetch document to get storage_path
    const { data: doc, error: fetchError } = await supabase
      .from("load_documents")
      .select("*")
      .eq("id", docId)
      .eq("load_id", id)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const adminSupabase = createAdminClient()

    // Delete from storage if storage_path exists
    if (doc.storage_path) {
      const { error: storageError } = await adminSupabase.storage
        .from("load-documents")
        .remove([doc.storage_path])

      if (storageError) {
        console.error("Storage delete error:", storageError)
        // Continue with metadata deletion even if storage delete fails
      }
    }

    // Delete metadata row
    const { error: deleteError } = await supabase
      .from("load_documents")
      .delete()
      .eq("id", docId)
      .eq("load_id", id)

    if (deleteError) {
      console.error("Document delete error:", deleteError)
      return NextResponse.json(
        { error: deleteError.message || "Failed to delete document" },
        { status: 500 }
      )
    }

    // Log activity
    await adminSupabase.from("activity_log").insert({
      entity_type: "load_document",
      entity_id: docId,
      action: "deleted",
      user_id: user.id,
      details: {
        load_id: id,
        filename: doc.filename,
        document_type: doc.document_type,
        deleted_by: user.email,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting document:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
