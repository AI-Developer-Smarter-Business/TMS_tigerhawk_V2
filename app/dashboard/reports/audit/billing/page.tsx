import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { BillingDiscrepancyReport } from "@/components/reports/audit/BillingDiscrepancyReport"

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: invoices } = await supabase
    .from("ar_invoices")
    .select("id, invoice_number, amount, amount_paid, billing_status, customer_id, created_at, due_date, customers(id, name)")
    .order("created_at", { ascending: false })

  return <BillingDiscrepancyReport invoices={(invoices || []) as any} />
}
