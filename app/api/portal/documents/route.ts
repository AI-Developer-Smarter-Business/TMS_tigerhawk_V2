// app/api/portal/documents/route.ts
// Customer portal API: list all documents across all customer loads
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

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

    // Get all load IDs for this customer (RLS scopes automatically)
    const { data: loads } = await supabase
      .from("loads")
      .select("id, reference_number")

    const loadList = loads || []
    const loadIds = loadList.map((l) => l.id)
    const loadRefMap: Record<string, string> = {}
    loadList.forEach((l) => {
      loadRefMap[l.id] = l.reference_number
    })

    if (loadIds.length === 0) {
      return NextResponse.json({ documents: [] })
    }

    // Fetch documents for all customer loads
    const { data: documents, error: docsError } = await supabase
      .from("load_documents")
      .select("*")
      .in("load_id", loadIds)
      .order("uploaded_at", { ascending: false })

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 })
    }

    // Generate signed URLs
    const adminSupabase = createAdminClient()
    const documentsWithUrls = await Promise.all(
      (documents || []).map(async (doc) => {
        let url = doc.url
        if (doc.storage_path) {
          const { data: signedData } = await adminSupabase.storage
            .from("load-documents")
            .createSignedUrl(doc.storage_path, 3600)
          url = signedData?.signedUrl || url
        }
        return {
          ...doc,
          url,
          load_reference_number: loadRefMap[doc.load_id] || "—",
        }
      })
    )

    return NextResponse.json({ documents: documentsWithUrls })
  } catch (error) {
    console.error("Portal all documents API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
