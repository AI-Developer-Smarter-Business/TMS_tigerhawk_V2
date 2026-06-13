import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FinancialLanding } from "@/components/reports/financial/FinancialLanding"

export default async function FinancialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return <FinancialLanding />
}
