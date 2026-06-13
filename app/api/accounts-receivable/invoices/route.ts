import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateBody } from "@/lib/validations/validate"
import { createInvoiceSchema } from "@/lib/validations/schemas"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const url = new URL(request.url)
    const billingStatus = url.searchParams.get("billing_status")
    const customerId = url.searchParams.get("customer_id")
    const page = parseInt(url.searchParams.get("page") || "1", 10)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from("ar_invoices")
      .select(`
        id,
        invoice_number,
        customer_id,
        load_id,
        invoice_date,
        due_date,
        amount,
        amount_paid,
        billing_status,
        created_at,
        updated_at,
        customers(id, name)
      `, { count: "exact" })

    // Apply filters
    if (billingStatus) {
      query = query.eq("billing_status", billingStatus)
    }

    if (customerId) {
      query = query.eq("customer_id", customerId)
    }

    const { data, error, count } = await query
      .order("invoice_date", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Invoices fetch error:", error)
      return NextResponse.json(
        { error: error.message || "Failed to fetch invoices" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data, total: count, page, limit })
  } catch (error) {
    console.error("Error fetching invoices:", error)
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

    const body = await request.json()

    // Validate request body with Zod schema
    const validation = validateBody(body, createInvoiceSchema)
    if (!validation.success) {
      return validation.response
    }

    const data = validation.data

    // Check invoice number uniqueness
    const { data: existingInvoice } = await supabase
      .from("ar_invoices")
      .select("id")
      .eq("invoice_number", data.invoice_number)
      .maybeSingle()

    if (existingInvoice) {
      return NextResponse.json(
        { error: `Invoice number "${data.invoice_number}" already exists` },
        { status: 409 }
      )
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", data.customer_id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Create invoice
    const { data: invoice, error: insertError } = await supabase
      .from("ar_invoices")
      .insert({
        invoice_number: data.invoice_number,
        customer_id: data.customer_id,
        load_id: data.load_id || null,
        invoice_date: data.invoice_date || new Date().toISOString(),
        due_date: data.due_date || null,
        amount: Number(data.amount),
        amount_paid: 0,
        billing_status: data.billing_status || "Drafted",
      })
      .select()
      .single()

    if (insertError) {
      console.error("Invoice insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to create invoice" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "ar_invoice",
      entity_id: invoice.id,
      action: "created",
      user_id: user.id,
      details: {
        invoice_number: invoice.invoice_number,
        customer_id: data.customer_id,
        customer_name: customer.name,
        amount: data.amount,
        created_by: user.email,
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error("Error creating invoice:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
