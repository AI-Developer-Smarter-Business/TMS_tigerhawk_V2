import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DriverUtilizationReport } from "@/components/reports/operations/DriverUtilizationReport"

export default async function DriverUtilizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: loads } = await supabase
    .from("loads")
    .select("id, driver_id, status, created_at, drivers(id, name)")
    .order("created_at", { ascending: false })

  const { data: invoices } = await supabase
    .from("ar_invoices")
    .select("id, amount, load_id, created_at")

  return <DriverUtilizationReport loads={(loads || []) as any} invoices={invoices || []} />
}
