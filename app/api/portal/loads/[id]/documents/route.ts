// app/api/portal/loads/[id]/documents/route.ts
// Customer portal API: list documents for a specific load
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { attachLoadDocumentUrls } from "@/lib/load-documents/resolve-document-url"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify customer role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "customer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify load belongs to customer (RLS handles this, but explicit check for safety)
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id")
      .eq("id", id)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Fetch documents
    const { data: documents, error: docsError } = await supabase
      .from("load_documents")
      .select("*")
      .eq("load_id", id)
      .order("uploaded_at", { ascending: false })

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 })
    }

    const adminSupabase = createAdminClient()
    const documentsWithUrls = await attachLoadDocumentUrls(
      adminSupabase,
      documents || [],
    )

    return NextResponse.json({ documents: documentsWithUrls })
  } catch (error) {
    console.error("Portal documents API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
