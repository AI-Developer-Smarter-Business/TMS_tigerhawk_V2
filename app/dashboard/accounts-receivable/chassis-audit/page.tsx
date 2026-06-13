import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ChassisAuditView } from "@/components/accounts-receivable/ChassisAuditView"

async function getChassisAuditData() {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch existing chassis audit uploads
  const { data: uploads, error } = await supabase
    .from("chassis_audit_uploads")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching chassis audits:", error)
    return { uploads: [], error: error.message }
  }

  return { uploads: uploads || [], error: null }
}

export default async function ChassisAuditPage() {
  const { uploads, error } = await getChassisAuditData()

  return <ChassisAuditView initialUploads={uploads} error={error} />
}
