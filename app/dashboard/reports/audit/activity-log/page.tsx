import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ActivityLogView } from "@/components/reports/audit/ActivityLogView"

export default async function ActivityLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Verify admin/dispatcher role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
    redirect("/dashboard")
  }

  return <ActivityLogView />
}
