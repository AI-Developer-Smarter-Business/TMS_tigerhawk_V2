// app/api/drivers/[id]/documents/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  resolveLoadDocumentUrl,
} from "@/lib/load-documents/resolve-document-url"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: documents, error } = await supabase
      .from("driver_documents")
      .select("*")
      .eq("driver_id", id)
      .order("uploaded_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const adminSupabase = createAdminClient()
    const docsWithUrls = await Promise.all(
      (documents || []).map(async (doc) => {
        if (!doc.storage_path) return doc
        const url = await resolveLoadDocumentUrl(
          adminSupabase,
          doc.storage_path,
          doc.url,
          "driver-documents",
        )
        return { ...doc, url }
      }),
    )

    return NextResponse.json({ documents: docsWithUrls })
  } catch (error) {
    console.error("Error fetching driver documents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Verify driver exists
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, name")
      .eq("id", id)
      .single()

    if (driverError || !driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const documentType = (formData.get("document_type") as string) || "Other"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > 52428800) {
      return NextResponse.json({ error: "File exceeds 50MB limit" }, { status: 400 })
    }

    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${id}/${timestamp}_${sanitizedName}`

    const adminSupabase = createAdminClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminSupabase.storage
      .from("driver-documents")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const url = await resolveLoadDocumentUrl(
      adminSupabase,
      storagePath,
      null,
      "driver-documents",
    )

    const { data: document, error: insertError } = await supabase
      .from("driver_documents")
      .insert({
        driver_id: id,
        filename: file.name,
        url,
        storage_path: storagePath,
        document_type: documentType,
        file_size: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      await adminSupabase.storage.from("driver-documents").remove([storagePath])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await adminSupabase.from("activity_log").insert({
      entity_type: "driver_document",
      entity_id: document.id,
      action: "created",
      user_id: user.id,
      details: {
        driver_id: id,
        driver_name: driver.name,
        filename: file.name,
        document_type: documentType,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error("Error uploading driver document:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
