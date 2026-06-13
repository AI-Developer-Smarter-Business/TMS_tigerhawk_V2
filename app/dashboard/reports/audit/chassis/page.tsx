import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ChassisAuditReport } from "@/components/reports/audit/ChassisAuditReport"

export default async function ChassisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: uploads } = await supabase
    .from("chassis_audit_uploads")
    .select("*")
    .order("created_at", { ascending: false })

  return <ChassisAuditReport uploads={uploads || []} />
}
