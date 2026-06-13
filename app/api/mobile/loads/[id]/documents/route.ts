/**
 * Tigerhawk Mobile — load document upload (driver).
 * Same DB row as dispatcher POST /api/dispatcher/loads/[id]/documents:
 * load_documents(load_id, filename, url, storage_path, document_type, file_size, uploaded_by, uploaded_at)
 */
import { createAdminClient } from "@/lib/supabase/admin"
import {
  canUploadLoadDocument,
  normalizeDriverDocumentType,
  processLoadDocumentUpload,
} from "@/lib/load-documents/process-load-document-upload"
import {
  getDocumentTypeFromForm,
  parseMultipartFile,
} from "@/lib/load-documents/parse-upload-form"
import { extractBearerToken } from "@/lib/supabase/get-user-from-request"
import {
  extractAccessTokenFromForm,
  resolveUserFromAccessToken,
} from "@/lib/supabase/resolve-bearer-user"
import { documentTypeSchema } from "@/lib/validations/schemas"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Accept",
    },
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: loadId } = await context.params
    const formData = await request.formData()

    const accessToken =
      extractBearerToken(request) ?? extractAccessTokenFromForm(formData)

    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Missing access_token or Authorization Bearer",
          code: "MISSING_TOKEN",
        },
        { status: 401 },
      )
    }

    const { user, error: jwtError } = await resolveUserFromAccessToken(accessToken)
    if (!user) {
      return NextResponse.json(
        {
          error: "Invalid or expired session",
          code: "MOBILE_JWT_INVALID",
          detail: jwtError,
          hint:
            "Mobile EXPO_PUBLIC_SUPABASE_URL must match TMS NEXT_PUBLIC_SUPABASE_URL (same project).",
        },
        { status: jwtError?.includes("SERVICE_ROLE") ? 503 : 401 },
      )
    }

    const adminSupabase = createAdminClient()

    const { data: profile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("role, full_name, email")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: "Driver profile not found in user_profiles",
          code: "PROFILE_NOT_FOUND",
          detail: profileError?.message,
        },
        { status: 403 },
      )
    }

    if (profile.role !== "driver") {
      return NextResponse.json(
        {
          error: "Only drivers may use the mobile upload endpoint",
          code: "NOT_DRIVER",
        },
        { status: 403 },
      )
    }

    const { data: load, error: loadError } = await adminSupabase
      .from("loads")
      .select("id, reference_number, driver_id")
      .eq("id", loadId)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found", code: "LOAD_NOT_FOUND" }, { status: 404 })
    }

    if (!canUploadLoadDocument(profile, load, user.id)) {
      return NextResponse.json(
        {
          error: "You are not assigned to this load",
          code: "NOT_ASSIGNED",
          load_id: loadId,
          driver_id: user.id,
        },
        { status: 403 },
      )
    }

    const file = parseMultipartFile(formData)
    if (!file) {
      return NextResponse.json(
        {
          error: "No file provided (multipart field `file` required, same as dispatcher)",
          code: "MISSING_FILE",
        },
        { status: 400 },
      )
    }

    const docTypeResult = documentTypeSchema.safeParse(getDocumentTypeFromForm(formData))
    if (!docTypeResult.success) {
      return NextResponse.json(
        { error: "Invalid document_type", code: "INVALID_DOCUMENT_TYPE" },
        { status: 400 },
      )
    }

    const normalizedType = normalizeDriverDocumentType(profile.role, docTypeResult.data)
    if (normalizedType === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Drivers may only upload Driver, POD, or Photo", code: "DRIVER_DOCUMENT_TYPE_FORBIDDEN" },
        { status: 403 },
      )
    }

    if (file.size > 52428800) {
      return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 })
    }

    if (file.name.length > 255) {
      return NextResponse.json({ error: "Filename too long (max 255 characters)" }, { status: 400 })
    }

    const result = await processLoadDocumentUpload({
      adminSupabase,
      loadId,
      user,
      profile,
      load,
      file,
      documentType: normalizedType,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: "UPLOAD_FAILED" }, { status: result.status })
    }

    return NextResponse.json(result.document, { status: 201 })
  } catch (error) {
    console.error("[mobile documents POST]", error)
    const message =
      error instanceof Error ? error.message : "Internal server error"
    const status = message.includes("SERVICE_ROLE") ? 503 : 500
    return NextResponse.json(
      { error: message, code: "SERVER_ERROR" },
      { status },
    )
  }
}
