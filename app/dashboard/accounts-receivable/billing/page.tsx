import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BillingView } from "@/components/accounts-receivable/BillingView"

async function getBillingData() {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch ar_invoices joined with customers and loads
  const { data: invoices, error } = await supabase
    .from("ar_invoices")
    .select(`
      *,
      customers (id, name, email),
      loads (
        id,
        reference_number,
        status,
        container_id,
        driver_id,
        delivery_location,
        created_at,
        drivers (id, name)
      )
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching invoices:", error)
    return { invoices: [], error: error.message }
  }

  return { invoices: invoices || [], error: null }
}

export default async function BillingPage() {
  const { invoices, error } = await getBillingData()

  return <BillingView initialData={invoices} error={error} />
}
