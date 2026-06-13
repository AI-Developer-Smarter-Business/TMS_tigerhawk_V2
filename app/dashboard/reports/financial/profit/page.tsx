import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ProfitReport } from "@/components/reports/financial/ProfitReport"

export default async function ProfitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: invoices } = await supabase
    .from("ar_invoices")
    .select("id, amount, load_id, customer_id, created_at, customers(id, name)")
    .order("created_at", { ascending: false })

  const { data: driverPay } = await supabase
    .from("ap_driver_pay")
    .select("id, load_id, amount")

  return <ProfitReport invoices={(invoices || []) as any} driverPay={driverPay || []} />
}
