// app/api/dispatcher/loads/[id]/documents/route.ts
// Dispatcher (browser cookies) + Tigerhawk Mobile (Bearer header and/or form access_token).
import { enrichLoadDocuments } from "@/lib/load-documents/enrich"
import {
  getDocumentTypeFromForm,
  parseMultipartFile,
} from "@/lib/load-documents/parse-upload-form"
import {
  canUploadLoadDocument,
  normalizeDriverDocumentType,
  processLoadDocumentUpload,
} from "@/lib/load-documents/process-load-document-upload"
import { createAdminClient } from "@/lib/supabase/admin"
import { getUserFromRequest } from "@/lib/supabase/get-user-from-request"
import {
  resolveAccessTokenFromUpload,
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Accept",
    },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, supabase } = await getUserFromRequest(request)
    const { id } = await context.params

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id")
      .eq("id", id)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    const { data: documents, error: docsError } = await supabase
      .from("load_documents")
      .select("*")
      .eq("load_id", id)
      .order("uploaded_at", { ascending: false })

    if (docsError) {
      console.error("Documents fetch error:", docsError)
      return NextResponse.json(
        { error: docsError.message || "Failed to fetch documents" },
        { status: 500 },
      )
    }

    const adminSupabase = createAdminClient()
    const documentsWithUrls = await Promise.all(
      (documents || []).map(async (doc) => {
        if (doc.storage_path) {
          const { data: signedData } = await adminSupabase.storage
            .from("load-documents")
            .createSignedUrl(doc.storage_path, 3600)

          return {
            ...doc,
            url: signedData?.signedUrl || doc.url,
          }
        }
        return doc
      }),
    )

    const enriched = await enrichLoadDocuments(adminSupabase, documentsWithUrls)

    return NextResponse.json({ documents: enriched })
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const formData = await request.formData()
    const accessToken = resolveAccessTokenFromUpload(request, formData)

    let user = null
    let profile: { role: string; full_name: string | null; email: string | null } | null =
      null
    let load: {
      id: string
      reference_number: string
      driver_id: string | null
    } | null = null

    const adminSupabase = createAdminClient()

    if (accessToken) {
      const { user: mobileUser, error: jwtError } =
        await resolveUserFromAccessToken(accessToken)

      if (!mobileUser) {
        console.error("[documents POST] mobile JWT rejected:", jwtError)
        return NextResponse.json(
          {
            error: jwtError?.includes("SERVICE_ROLE")
              ? "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY"
              : "Unauthorized",
            code: "MOBILE_JWT_INVALID",
          },
          { status: jwtError?.includes("SERVICE_ROLE") ? 503 : 401 },
        )
      }

      user = mobileUser

      const { data: profileRow, error: profileError } = await adminSupabase
        .from("user_profiles")
        .select("role, full_name, email")
        .eq("id", user.id)
        .single()

      if (profileError) {
        console.error("[documents POST] profile lookup:", profileError.message)
      }
      profile = profileRow

      const { data: loadRow, error: loadError } = await adminSupabase
        .from("loads")
        .select("id, reference_number, driver_id")
        .eq("id", id)
        .single()

      if (loadError || !loadRow) {
        return NextResponse.json({ error: "Load not found" }, { status: 404 })
      }
      load = loadRow
    } else {
      const { user: webUser, supabase } = await getUserFromRequest(request)
      if (!webUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      user = webUser

      const { data: profileRow } = await supabase
        .from("user_profiles")
        .select("role, full_name, email")
        .eq("id", user.id)
        .single()
      profile = profileRow

      const { data: loadRow, error: loadError } = await supabase
        .from("loads")
        .select("id, reference_number, driver_id")
        .eq("id", id)
        .single()

      if (loadError || !loadRow) {
        return NextResponse.json({ error: "Load not found" }, { status: 404 })
      }
      load = loadRow
    }

    if (!canUploadLoadDocument(profile, load, user.id)) {
      return NextResponse.json(
        { error: "You don't have permission to upload documents for this load" },
        { status: 403 },
      )
    }

    const file = parseMultipartFile(formData)
    const rawDocType = getDocumentTypeFromForm(formData)

    const docTypeResult = documentTypeSchema.safeParse(rawDocType)
    if (!docTypeResult.success) {
      return NextResponse.json(
        {
          error: "Invalid document_type",
          details: docTypeResult.error.issues.map((i) => ({
            field: "document_type",
            message: i.message,
          })),
        },
        { status: 400 },
      )
    }

    const normalizedType = normalizeDriverDocumentType(
      profile?.role,
      docTypeResult.data,
    )
    if (normalizedType === "FORBIDDEN") {
      return NextResponse.json(
        {
          error: "Drivers may only upload Driver, POD, or Photo documents.",
          code: "DRIVER_DOCUMENT_TYPE_FORBIDDEN",
        },
        { status: 403 },
      )
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > 52428800) {
      return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 })
    }

    if (file.name.length > 255) {
      return NextResponse.json(
        { error: "Filename too long (max 255 characters)" },
        { status: 400 },
      )
    }

    const result = await processLoadDocumentUpload({
      adminSupabase,
      loadId: id,
      user,
      profile,
      load,
      file,
      documentType: normalizedType,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result.document, { status: 201 })
  } catch (error) {
    console.error("Error uploading document:", error)
    const message =
      error instanceof Error && error.message.includes("SERVICE_ROLE")
        ? "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY"
        : "Internal server error"
    const status = message.includes("misconfigured") ? 503 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
