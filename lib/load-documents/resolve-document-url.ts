import type { SupabaseClient } from "@supabase/supabase-js"

export const LOAD_DOCUMENTS_BUCKET = "load-documents"

/** ~10 years — practical permanent access; avoids 1h Supabase signed URL expiry. */
export const LOAD_DOCUMENT_SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 365 * 10

/**
 * Resolves a view/download URL from `storage_path`.
 * Prefer this over persisting short-lived signed URLs in `load_documents.url`.
 */
export async function resolveLoadDocumentUrl(
  adminSupabase: SupabaseClient,
  storagePath: string | null | undefined,
  fallbackUrl?: string | null,
  bucket: string = LOAD_DOCUMENTS_BUCKET,
): Promise<string> {
  const trimmedFallback = fallbackUrl?.trim() ?? ""

  if (!storagePath?.trim()) {
    return trimmedFallback
  }

  const { data, error } = await adminSupabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, LOAD_DOCUMENT_SIGNED_URL_TTL_SEC)

  if (error) {
    console.error("[resolveLoadDocumentUrl]", storagePath, error.message)
    return trimmedFallback
  }

  return data?.signedUrl?.trim() || trimmedFallback
}

export async function attachLoadDocumentUrls<T extends { storage_path?: string | null; url?: string | null }>(
  adminSupabase: SupabaseClient,
  documents: T[],
): Promise<(T & { url: string })[]> {
  return Promise.all(
    documents.map(async (doc) => {
      const url = await resolveLoadDocumentUrl(
        adminSupabase,
        doc.storage_path,
        doc.url,
      )
      return { ...doc, url }
    }),
  )
}
