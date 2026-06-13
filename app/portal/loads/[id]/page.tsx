// app/portal/loads/[id]/page.tsx
// Single load detail view for customer portal
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect, notFound } from "next/navigation"
import { PortalLoadDetail } from "@/components/portal/PortalLoadDetail"

const LOAD_SELECT = `
  *,
  containers (
    id,
    container_number,
    bol_number,
    size,
    type,
    status,
    last_free_day,
    shipping_line,
    transit_state,
    seal_number,
    time_in,
    time_out,
    stopped_road,
    stopped_vessel,
    stopped_rail,
    impediment_road,
    equipment_type,
    ph_synced_at,
    vessel_id,
    vessels (
      id, name, voyage_number, eta, terminal, shipping_line
    )
  ),
  customers (
    id, name, email, phone, address, city, state, zip_code
  ),
  drivers (
    id, name, phone, status
  )
`

export default async function PortalLoadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/portal/login")

  // Fetch load (RLS scopes to customer automatically)
  const { data: load, error } = await supabase
    .from("loads")
    .select(LOAD_SELECT)
    .eq("id", id)
    .single()

  if (error || !load) {
    notFound()
  }

  // Fetch documents for this load
  const { data: documents } = await supabase
    .from("load_documents")
    .select("*")
    .eq("load_id", id)
    .order("uploaded_at", { ascending: false })

  // Generate fresh signed URLs (per-doc try/catch so one failure doesn't break all)
  const adminSupabase = createAdminClient()
  const documentsWithUrls = await Promise.all(
    (documents || []).map(async (doc) => {
      if (doc.storage_path) {
        try {
          const { data: signedData } = await adminSupabase.storage
            .from("load-documents")
            .createSignedUrl(doc.storage_path, 3600)
          return { ...doc, url: signedData?.signedUrl || doc.url }
        } catch (e) {
          console.error(`Failed to sign URL for ${doc.storage_path}:`, e)
          return doc
        }
      }
      return doc
    })
  )

  return <PortalLoadDetail load={load} documents={documentsWithUrls} />
}
