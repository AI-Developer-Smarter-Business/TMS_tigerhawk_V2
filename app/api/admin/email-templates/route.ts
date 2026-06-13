// app/api/admin/email-templates/route.ts
// Admin API for managing editable email templates
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

// GET — List all email templates
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher", "accounting"].includes(profile.role)) {
      return NextResponse.json({ error: "Staff access required" }, { status: 403 })
    }

    const { data: templates, error: templatesError } = await supabase
      .from("email_templates")
      .select("*")
      .order("name")

    if (templatesError) {
      console.error("Error fetching email templates:", templatesError)
      return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 })
    }

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    console.error("Error in GET /api/admin/email-templates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH — Update an email template (subject, body, active state)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { id, subject, body_html, is_active, name } = body

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 })
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }
    if (typeof subject === "string") updates.subject = subject
    if (typeof body_html === "string") updates.body_html = body_html
    if (typeof is_active === "boolean") updates.is_active = is_active
    if (typeof name === "string") updates.name = name

    if (Object.keys(updates).length <= 2) {
      // Only updated_by and updated_at — no actual changes
      return NextResponse.json({ error: "No changes provided" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: updated, error: updateError } = await adminClient
      .from("email_templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating email template:", updateError)
      return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
    }

    // Audit log
    try {
      await adminClient.from("activity_log").insert({
        entity_type: "email_template",
        entity_id: id,
        action: "updated",
        user_id: user.id,
        details: {
          template_key: updated.template_key,
          template_name: updated.name,
          fields_changed: Object.keys(updates).filter((k) => k !== "updated_by" && k !== "updated_at"),
          changed_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ template: updated })
  } catch (error) {
    console.error("Error in PATCH /api/admin/email-templates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST — Create a new custom email template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { template_key, name, subject, body_html, variables } = body

    if (!template_key?.trim() || !name?.trim() || !subject?.trim() || !body_html?.trim()) {
      return NextResponse.json(
        { error: "template_key, name, subject, and body_html are all required" },
        { status: 400 }
      )
    }

    // Validate template_key format (lowercase, underscores, no spaces)
    if (!/^[a-z][a-z0-9_]*$/.test(template_key.trim())) {
      return NextResponse.json(
        { error: "template_key must be lowercase with underscores only (e.g. my_template)" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Check for duplicate key
    const { data: existing } = await adminClient
      .from("email_templates")
      .select("id")
      .eq("template_key", template_key.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Template key "${template_key}" already exists` },
        { status: 409 }
      )
    }

    const { data: created, error: createError } = await adminClient
      .from("email_templates")
      .insert({
        template_key: template_key.trim(),
        name: name.trim(),
        subject: subject.trim(),
        body_html: body_html.trim(),
        variables: variables || [],
        updated_by: user.id,
      })
      .select()
      .single()

    if (createError) {
      console.error("Error creating email template:", createError)
      return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
    }

    // Audit log
    try {
      await adminClient.from("activity_log").insert({
        entity_type: "email_template",
        entity_id: created.id,
        action: "created",
        user_id: user.id,
        details: {
          template_key: created.template_key,
          template_name: created.name,
          created_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ template: created })
  } catch (error) {
    console.error("Error in POST /api/admin/email-templates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
