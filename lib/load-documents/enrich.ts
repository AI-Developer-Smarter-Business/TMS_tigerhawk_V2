import type { SupabaseClient } from "@supabase/supabase-js"

import type { LoadDocument } from "@/types/dispatcher"

export type EnrichedLoadDocument = LoadDocument & {
  is_driver_upload: boolean
  uploaded_by_name: string | null
}

const DRIVER_DOCUMENT_TYPE = "Driver"

export function isDriverUploadDocument(doc: {
  document_type?: string | null
  is_driver_upload?: boolean
}): boolean {
  if (doc.is_driver_upload === true) return true
  return doc.document_type === DRIVER_DOCUMENT_TYPE
}

export async function enrichLoadDocuments(
  adminSupabase: SupabaseClient,
  documents: LoadDocument[],
): Promise<EnrichedLoadDocument[]> {
  if (documents.length === 0) return []

  const uploaderIds = [
    ...new Set(
      documents
        .map((doc) => doc.uploaded_by)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const profileById = new Map<
    string,
    { role: string; full_name: string | null; email: string | null }
  >()

  if (uploaderIds.length > 0) {
    const { data: profiles } = await adminSupabase
      .from("user_profiles")
      .select("id, role, full_name, email")
      .in("id", uploaderIds)

    for (const profile of profiles ?? []) {
      profileById.set(profile.id, profile)
    }
  }

  return documents.map((doc) => {
    const profile = doc.uploaded_by ? profileById.get(doc.uploaded_by) : null
    const is_driver_upload =
      doc.document_type === DRIVER_DOCUMENT_TYPE || profile?.role === "driver"

    const uploaded_by_name =
      profile?.full_name?.trim() ||
      profile?.email?.trim() ||
      (is_driver_upload ? "Driver" : null)

    return {
      ...doc,
      is_driver_upload,
      uploaded_by_name,
    }
  })
}
