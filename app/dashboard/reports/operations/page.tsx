import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OperationsLanding } from "@/components/reports/operations/OperationsLanding"

export default async function OperationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return <OperationsLanding />
}
