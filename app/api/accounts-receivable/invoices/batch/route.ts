import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateBody } from "@/lib/validations/validate"
import { arBatchInvoicesCommitSchema } from "@/lib/validations/schemas"

const FINANCE_ROLES = ["admin", "accounting", "finance"] as const

type InvoiceRow = {
  id: string
  invoice_number: string
  customer_id: string
  amount: number
  amount_paid: number | null
  billing_status: string | null
  load_id: string | null
}

function assertFinanceRole(role: string | undefined): boolean {
  return !!role && (FINANCE_ROLES as readonly string[]).includes(role)
}

/** GET — preview groups of Approved (or custom) invoices eligible for batch consolidation. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!assertFinanceRole(profile?.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const url = new URL(request.url)
    const sourceStatus = url.searchParams.get("source_status") || "Approved"

    const { data: rows, error } = await supabase
      .from("ar_invoices")
      .select(`
        id,
        invoice_number,
        customer_id,
        amount,
        amount_paid,
        billing_status,
        load_id,
        customers!inner(id, name)
      `)
      .eq("billing_status", sourceStatus)
      .or("amount_paid.is.null,amount_paid.eq.0")

    if (error) {
      console.error("[ar batch preview]", error)
      return NextResponse.json(
        { error: error.message || "Failed to load invoices" },
        { status: 500 }
      )
    }

    const list = ((rows || []) as unknown as (InvoiceRow & {
      customers: { id: string; name: string } | { id: string; name: string }[]
    })[]).filter((r) => !String(r.invoice_number || "").toUpperCase().startsWith("BATCH-"))

    const byCustomer = new Map<
      string,
      {
        customer_id: string
        customer_name: string
        invoice_count: number
        total_amount: number
        invoice_ids: string[]
        invoices: Array<{ id: string; invoice_number: string; amount: number; load_id: string | null }>
      }
    >()

    for (const inv of list) {
      const paid = Number(inv.amount_paid) || 0
      if (paid > 0) continue

      const cust = inv.customers
      const cname =
        (Array.isArray(cust) ? cust[0]?.name : cust?.name) || "Unknown"
      const g = byCustomer.get(inv.customer_id)
      const amt = Number(inv.amount) || 0
      const line = {
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: amt,
        load_id: inv.load_id,
      }
      if (g) {
        g.invoice_count += 1
        g.total_amount += amt
        g.invoice_ids.push(inv.id)
        g.invoices.push(line)
      } else {
        byCustomer.set(inv.customer_id, {
          customer_id: inv.customer_id,
          customer_name: cname,
          invoice_count: 1,
          total_amount: amt,
          invoice_ids: [inv.id],
          invoices: [line],
        })
      }
    }

    const groups = Array.from(byCustomer.values()).filter((g) => g.invoice_count > 0)

    return NextResponse.json({
      source_status: sourceStatus,
      group_count: groups.length,
      invoice_count: list.length,
      groups,
    })
  } catch (e) {
    console.error("[ar batch preview]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST — consolidate per-customer: one Billed batch invoice + mark lines Consolidated. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!assertFinanceRole(profile?.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const validation = validateBody(body, arBatchInvoicesCommitSchema)
    if (!validation.success) {
      return validation.response
    }

    const { customer_ids, source_billing_status } = validation.data

    const { data: rows, error: fetchError } = await supabase
      .from("ar_invoices")
      .select("id, invoice_number, customer_id, amount, amount_paid, billing_status, load_id")
      .eq("billing_status", source_billing_status)
      .or("amount_paid.is.null,amount_paid.eq.0")

    if (fetchError) {
      console.error("[ar batch commit] fetch", fetchError)
      return NextResponse.json(
        { error: fetchError.message || "Failed to load invoices" },
        { status: 500 }
      )
    }

    const list = ((rows || []) as InvoiceRow[]).filter(
      (r) => !String(r.invoice_number || "").toUpperCase().startsWith("BATCH-")
    )

    const byCustomer = new Map<string, InvoiceRow[]>()
    for (const inv of list) {
      const paid = Number(inv.amount_paid) || 0
      if (paid > 0) continue
      if (customer_ids && customer_ids.length > 0 && !customer_ids.includes(inv.customer_id)) {
        continue
      }
      const arr = byCustomer.get(inv.customer_id) || []
      arr.push(inv)
      byCustomer.set(inv.customer_id, arr)
    }

    const admin = createAdminClient()
    const created: Array<{
      customer_id: string
      batch_invoice_id: string
      batch_invoice_number: string
      charge_set_number: string
      line_count: number
      total_amount: number
    }> = []
    const errors: Array<{ customer_id: string; error: string }> = []

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "")

    for (const [customerId, invoices] of byCustomer) {
      if (invoices.length === 0) continue

      const total = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0)
      if (total <= 0) {
        errors.push({ customer_id: customerId, error: "Total amount must be greater than zero" })
        continue
      }

      const batchSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
      const batchRef = `BATCH-${today}-${batchSuffix}`
      const invoiceNumber = `${batchRef}-${customerId.slice(0, 8)}`

      const { data: batchInvoice, error: insErr } = await admin
        .from("ar_invoices")
        .insert({
          invoice_number: invoiceNumber,
          customer_id: customerId,
          load_id: null,
          invoice_date: new Date().toISOString(),
          due_date: null,
          amount: total,
          amount_paid: 0,
          billing_status: "Billed",
          charge_set_number: batchRef,
        })
        .select("id, invoice_number")
        .single()

      if (insErr || !batchInvoice) {
        console.error("[ar batch commit] insert", insErr)
        errors.push({
          customer_id: customerId,
          error: insErr?.message || "Failed to create batch invoice",
        })
        continue
      }

      const childIds = invoices.map((i) => i.id)
      const { error: updErr } = await admin
        .from("ar_invoices")
        .update({
          billing_status: "Consolidated",
          charge_set_number: batchRef,
          updated_at: new Date().toISOString(),
        })
        .in("id", childIds)

      if (updErr) {
        console.error("[ar batch commit] update children", updErr)
        await admin.from("ar_invoices").delete().eq("id", batchInvoice.id)
        errors.push({
          customer_id: customerId,
          error: updErr.message || "Failed to update line invoices — batch rolled back",
        })
        continue
      }

      await admin.from("activity_log").insert({
        entity_type: "ar_invoice",
        entity_id: batchInvoice.id,
        action: "batch_consolidated",
        user_id: user.id,
        details: {
          batch_invoice_number: invoiceNumber,
          charge_set_number: batchRef,
          customer_id: customerId,
          consolidated_invoice_ids: childIds,
          total_amount: total,
          performed_by: user.email,
        },
      })

      created.push({
        customer_id: customerId,
        batch_invoice_id: batchInvoice.id,
        batch_invoice_number: batchInvoice.invoice_number,
        charge_set_number: batchRef,
        line_count: invoices.length,
        total_amount: total,
      })
    }

    return NextResponse.json({
      batches_created: created.length,
      batches: created,
      errors: errors.length ? errors : undefined,
    })
  } catch (e) {
    console.error("[ar batch commit]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
