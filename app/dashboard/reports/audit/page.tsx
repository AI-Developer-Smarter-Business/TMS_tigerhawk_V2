import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AuditLanding } from "@/components/reports/audit/AuditLanding"

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  return <AuditLanding />
}
