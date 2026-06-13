import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { InvoicesView } from "@/components/accounts-receivable/InvoicesView"

async function getInvoicesData() {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch ar_invoices with related data
  const { data: invoices, error } = await supabase
    .from("ar_invoices")
    .select(`
      *,
      customers (id, name),
      ar_credit_memos (id, amount)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching invoices:", error)
    return { invoices: [], error: error.message }
  }

  return { invoices: invoices || [], error: null }
}

export default async function InvoicesPage() {
  const { invoices, error } = await getInvoicesData()

  return <InvoicesView initialData={invoices} error={error} />
}
