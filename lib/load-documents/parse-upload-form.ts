/**
 * Multipart contract (must match dispatcher DocumentsTab + Tigerhawk Mobile):
 * - `file` — file body (browser File or RN { uri, name, type })
 * - `document_type` — e.g. Driver, Other, POD (see documentTypeSchema)
 * - `access_token` — mobile only; Supabase JWT (dispatcher uses cookies instead)
 */
export function parseMultipartFile(formData: FormData): File | null {
  const entry = formData.get("file")
  if (entry instanceof File && entry.size > 0) {
    return entry
  }

  if (entry instanceof Blob && entry.size > 0) {
    const name =
      (typeof formData.get("filename") === "string"
        ? (formData.get("filename") as string)
        : null) || "upload.jpg"
    const type = entry.type || "application/octet-stream"
    return new File([entry], name, { type })
  }

  return null
}

export function getDocumentTypeFromForm(formData: FormData): string {
  const raw = formData.get("document_type")
  return typeof raw === "string" && raw.trim() ? raw.trim() : "Other"
}
