import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AccessorialReport } from "@/components/reports/financial/AccessorialReport"

export default async function AccessorialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: billingItems } = await supabase
    .from("load_billing")
    .select("id, load_id, amount, created_at")
    .order("created_at", { ascending: false })

  const { data: chargeCodes } = await supabase
    .from("charge_codes")
    .select("code, name, category")

  return <AccessorialReport billingItems={billingItems || []} chargeCodes={chargeCodes || []} />
}
