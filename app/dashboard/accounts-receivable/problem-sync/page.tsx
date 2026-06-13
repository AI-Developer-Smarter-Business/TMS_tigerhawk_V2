import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ProblemSyncView } from "@/components/accounts-receivable/ProblemSyncView"

async function getProblemSyncData() {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch problem invoices (those with sync issues)
  // For now, we'll fetch all invoices and you can mark which ones have problems
  const { data: invoices, error: invoicesError } = await supabase
    .from("ar_invoices")
    .select(`
      *,
      customers (id, name),
      ar_credit_memos (id)
    `)
    .order("created_at", { ascending: false })

  // Fetch customers for filtering
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

export default async function ProblemSyncPage() {
  const { invoices, customers, error } = await getProblemSyncData()

  return (
    <ProblemSyncView
      initialInvoices={invoices}
      initialCustomers={customers}
      error={error ?? null}
    />
  )
}
