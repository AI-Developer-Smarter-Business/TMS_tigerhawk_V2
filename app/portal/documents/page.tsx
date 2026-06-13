// app/portal/documents/page.tsx
// Cross-load document browser for customer portal
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import { PortalDocumentsClient } from "@/components/portal/PortalDocumentsClient"

export default async function PortalDocumentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/portal/login")

  // Fetch all loads for this customer (RLS scopes automatically)
  // We need load IDs to query documents
  const { data: loads, error: loadsError } = await supabase
    .from("loads")
    .select("id, reference_number")
    .order("created_at", { ascending: false })

  if (loadsError) {
    console.error("[Portal Documents] Loads query error:", loadsError.message)
  }

  const loadList = loads || []
  const loadIds = loadList.map((l) => l.id)

  // Build a lookup map: load_id -> reference_number
  const loadRefMap: Record<string, string> = {}
  loadList.forEach((l) => {
    loadRefMap[l.id] = l.reference_number
  })

  // Fetch documents for all customer loads
  let documents: Array<Record<string, unknown>> = []
  if (loadIds.length > 0) {
    const { data: docs, error: docsError } = await supabase
      .from("load_documents")
      .select("*")
      .in("load_id", loadIds)
      .order("uploaded_at", { ascending: false })

    if (docsError) {
      console.error("[Portal Documents] Docs query error:", docsError.message)
    }
    documents = docs || []
  }

  // Generate signed URLs — use try/catch per document so one failure doesn't break the page
  const adminSupabase = createAdminClient()
  const documentsWithUrls = await Promise.all(
    documents.map(async (doc) => {
      let url = doc.url as string
      if (doc.storage_path) {
        try {
          const { data: signedData } = await adminSupabase.storage
            .from("load-documents")
            .createSignedUrl(doc.storage_path as string, 3600)
          url = signedData?.signedUrl || url
        } catch (e) {
          console.error(`Failed to sign URL for ${doc.storage_path}:`, e)
        }
      }
      return {
        id: doc.id as string,
        load_id: doc.load_id as string,
        filename: doc.filename as string,
        url,
        storage_path: doc.storage_path as string | null,
        document_type: doc.document_type as string,
        file_size: doc.file_size as number | null,
        uploaded_at: doc.uploaded_at as string,
        uploaded_by: doc.uploaded_by as string | null,
        load_reference_number: loadRefMap[doc.load_id as string] || "—",
      }
    })
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="text-sm text-gray-400 mt-1">
          All documents across your loads ({documentsWithUrls.length})
        </p>
      </div>
      <PortalDocumentsClient documents={documentsWithUrls} />
    </div>
  )
}
