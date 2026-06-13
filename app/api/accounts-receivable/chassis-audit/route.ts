import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch previous chassis audit uploads
    const { data, error } = await supabase
      .from("chassis_audit_uploads")
      .select(`
        id,
        file_name,
        file_size,
        row_count,
        upload_date,
        status,
        processed_at,
        error_message,
        created_by,
        created_at
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Chassis audits fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch chassis audits" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("Error fetching chassis audits:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission - accounting staff only
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "accounting"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported" },
        { status: 400 }
      )
    }

    // Read file content
    const fileContent = await file.text()
    const lines = fileContent.split("\n").filter(line => line.trim())

    if (lines.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 })
    }

    // Parse CSV (basic parsing - adjust as needed for your CSV format)
    const rows = lines.slice(1) // Skip header
    let processedCount = 0
    const errors: string[] = []

    // Validate and process rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.trim()) continue

      const columns = row.split(",").map(col => col.trim())
      if (columns.length < 3) {
        errors.push(`Row ${i + 2}: Invalid format (expected at least 3 columns)`)
        continue
      }

      // Assuming CSV format: chassis_number, status, notes
      const [chassisNumber, status, notes] = columns
      if (!chassisNumber) {
        errors.push(`Row ${i + 2}: Chassis number is empty`)
        continue
      }

      // Verify chassis exists
      const { data: chassis, error: chassisError } = await supabase
        .from("chassis")
        .select("id")
        .eq("chassis_number", chassisNumber)
        .single()

      if (chassisError || !chassis) {
        errors.push(`Row ${i + 2}: Chassis ${chassisNumber} not found`)
        continue
      }

      // Update chassis status if needed
      if (status) {
        const { error: updateError } = await supabase
          .from("chassis")
          .update({
            status: status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", chassis.id)

        if (updateError) {
          errors.push(`Row ${i + 2}: Failed to update chassis ${chassisNumber}: ${updateError.message}`)
          continue
        }
      }

      processedCount++
    }

    // Create upload record
    const { data: upload, error: insertError } = await supabase
      .from("chassis_audit_uploads")
      .insert({
        file_name: file.name,
        file_size: file.size,
        row_count: processedCount,
        upload_date: new Date().toISOString(),
        status: errors.length === 0 ? "Success" : "Partial",
        processed_at: new Date().toISOString(),
        error_message: errors.length > 0 ? errors.join("; ") : null,
        created_by: user.email,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("Upload record insert error:", insertError)
      return NextResponse.json(
        { error: "Failed to create upload record" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "chassis_audit_upload",
      entity_id: upload.id,
      action: "created",
      user_id: user.id,
      details: {
        file_name: file.name,
        file_size: file.size,
        rows_processed: processedCount,
        errors_count: errors.length,
        uploaded_by: user.email,
      },
    })

    return NextResponse.json(
      {
        data: upload,
        summary: {
          processed: processedCount,
          errors: errors.length,
          error_details: errors,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error uploading chassis audit:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
