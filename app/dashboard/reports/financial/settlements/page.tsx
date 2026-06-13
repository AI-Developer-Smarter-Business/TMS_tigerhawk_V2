import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SettlementReport } from "@/components/reports/financial/SettlementReport"

export default async function SettlementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: settlements } = await supabase
    .from("ap_settlements")
    .select("id, settlement_number, driver_id, total_driver_pay, total_deductions, net_pay, status, period_start, period_end, created_at, drivers(id, name)")
    .order("created_at", { ascending: false })

  return <SettlementReport settlements={(settlements || []) as any} />
}
