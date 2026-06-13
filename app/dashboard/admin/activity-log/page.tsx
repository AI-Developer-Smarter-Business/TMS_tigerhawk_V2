// app/dashboard/admin/activity-log/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { ActivityLogView } from "@/components/reports/audit/ActivityLogView"

export default async function AdminActivityLogPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Admin only for the admin section
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <DashboardLayout>
      <ActivityLogView />
    </DashboardLayout>
  )
}
