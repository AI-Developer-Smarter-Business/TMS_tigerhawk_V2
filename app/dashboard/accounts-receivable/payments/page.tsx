import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PaymentsView } from "@/components/accounts-receivable/PaymentsView"

async function getPaymentsData() {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch customers
  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, name, email")
    .order("name", { ascending: true })

  // Fetch invoices for applying payments
  const { data: invoices, error: invoicesError } = await supabase
    .from("ar_invoices")
    .select(`
      *,
      customers (id, name)
    `)
    .order("created_at", { ascending: false })

  if (customersError || invoicesError) {
    const error = customersError?.message || invoicesError?.message
    return { customers: [], invoices: [], error }
  }

  return {
    customers: customers || [],
    invoices: invoices || [],
    error: null,
  }
}

export default async function PaymentsPage() {
  const { customers, invoices, error } = await getPaymentsData()

  return (
    <PaymentsView
      initialCustomers={customers}
      initialInvoices={invoices}
      error={error ?? null}
    />
  )
}
