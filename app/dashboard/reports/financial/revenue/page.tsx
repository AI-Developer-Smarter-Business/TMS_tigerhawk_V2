import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RevenueReport } from "@/components/reports/financial/RevenueReport"

export default async function RevenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: invoices } = await supabase
    .from("ar_invoices")
    .select("id, amount, amount_paid, billing_status, customer_id, created_at, customers(id, name)")
    .order("created_at", { ascending: false })

  return <RevenueReport invoices={(invoices || []) as any} />
}
