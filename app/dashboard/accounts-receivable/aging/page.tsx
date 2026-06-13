import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AgingView } from "@/components/accounts-receivable/AgingView"

async function getAgingData() {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch invoices for aging calculation (exclude Paid, Voided, Consolidated line items)
  const { data: invoices, error: invoicesError } = await supabase
    .from("ar_invoices")
    .select(`
      *,
      customers (id, name)
    `)
    .not("billing_status", "in", '("Paid","Voided","Consolidated")')

  // Fetch customers
  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, name")
    .order("name", { ascending: true })

  if (invoicesError || customersError) {
    const error = invoicesError?.message || customersError?.message
    return { invoices: [], customers: [], error }
  }

  return {
    invoices: invoices || [],
    customers: customers || [],
    error: null,
  }
}

export default async function AgingPage() {
  const { invoices, customers, error } = await getAgingData()

  return (
    <AgingView
      initialInvoices={invoices}
      initialCustomers={customers}
      error={error ?? null}
    />
  )
}
