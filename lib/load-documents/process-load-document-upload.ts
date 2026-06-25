import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import { enrichLoadDocuments } from "@/lib/load-documents/enrich"
import { resolveLoadDocumentUrl } from "@/lib/load-documents/resolve-document-url"
import { handlePodSignedSubmitted } from "@/lib/wait-time/handle-pod-signed-submitted"
import { documentTypeSchema } from "@/lib/validations/schemas"
import type { z } from "zod"

type DocumentType = z.infer<typeof documentTypeSchema>

const DRIVER_UPLOAD_DOCUMENT_TYPES = new Set(["Driver", "POD", "Photo"])

type ProcessUploadParams = {
  adminSupabase: SupabaseClient
  loadId: string
  user: User
  profile: { role: string; full_name: string | null; email: string | null } | null
  load: { id: string; reference_number: string; driver_id: string | null }
  file: File
  documentType: DocumentType
  /** Original form value before driver normalization (WT.28 POD auto-stop). */
  requestedDocumentType?: DocumentType
}

function isPodSubmission(
  documentType: DocumentType,
  requestedDocumentType?: DocumentType,
): boolean {
  return documentType === "POD" || requestedDocumentType === "POD"
}

export async function processLoadDocumentUpload(params: ProcessUploadParams) {
  const {
    adminSupabase,
    loadId,
    user,
    profile,
    load,
    file,
    documentType,
    requestedDocumentType,
  } = params

  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `${loadId}/${timestamp}_${sanitizedName}`

  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await adminSupabase.storage
    .from("load-documents")
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    return { ok: false as const, status: 500, error: `Upload failed: ${uploadError.message}` }
  }

  const url = await resolveLoadDocumentUrl(adminSupabase, storagePath)

  const { data: document, error: insertError } = await adminSupabase
    .from("load_documents")
    .insert({
      load_id: loadId,
      filename: file.name,
      url,
      storage_path: storagePath,
      document_type: documentType,
      file_size: file.size,
      uploaded_by: user.id,
      uploaded_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError) {
    await adminSupabase.storage.from("load-documents").remove([storagePath])
    return {
      ok: false as const,
      status: 500,
      error: insertError.message || "Failed to save document record",
    }
  }

  await adminSupabase.from("activity_log").insert({
    entity_type: "load_document",
    entity_id: document.id,
    action: "created",
    user_id: user.id,
    details: {
      load_id: loadId,
      load_reference: load.reference_number,
      filename: file.name,
      document_type: documentType,
      file_size: file.size,
      uploaded_by: user.email,
      source: profile?.role === "driver" ? "driver_mobile" : "dispatcher",
    },
  })

  if (isPodSubmission(documentType, requestedDocumentType)) {
    try {
      await handlePodSignedSubmitted(adminSupabase, {
        loadId,
        submittedAt: new Date().toISOString(),
        source: "document_upload",
        actorUserId: user.id,
        documentId: document.id as string,
        documentFilename: file.name,
        requestedDocumentType,
      })
    } catch (err) {
      console.error("[processLoadDocumentUpload] WT.28 pod auto-stop failed:", err)
    }
  }

  const [enriched] = await enrichLoadDocuments(adminSupabase, [document])

  return { ok: true as const, document: enriched ?? document }
}

export function normalizeDriverDocumentType(
  profileRole: string | undefined,
  documentType: DocumentType,
): DocumentType | "FORBIDDEN" {
  if (profileRole !== "driver") return documentType
  if (!DRIVER_UPLOAD_DOCUMENT_TYPES.has(documentType)) return "FORBIDDEN"
  if (documentType === "POD" || documentType === "Photo") return "Driver"
  return documentType
}

export function canUploadLoadDocument(
  profile: { role: string } | null,
  load: { driver_id: string | null },
  userId: string,
): boolean {
  const isStaff = profile && ["admin", "dispatcher"].includes(profile.role)
  const isAssignedDriver = profile?.role === "driver" && load.driver_id === userId
  return Boolean(isStaff || isAssignedDriver)
}
