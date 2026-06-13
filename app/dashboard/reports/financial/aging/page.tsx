import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AgingReport } from "@/components/reports/financial/AgingReport"

export default async function AgingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: invoices } = await supabase
    .from("ar_invoices")
    .select("id, invoice_number, amount, amount_paid, billing_status, due_date, created_at, customer_id, customers(id, name)")
    .not("billing_status", "in", '("Paid","Cancelled","Write-off")')

  return <AgingReport invoices={(invoices || []) as any} />
}
