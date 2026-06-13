// app/dashboard/admin/notifications/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { NotificationPreferencesView } from "@/components/admin/NotificationPreferencesView"

export default async function NotificationPreferencesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Admin only
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
      <NotificationPreferencesView />
    </DashboardLayout>
  )
}
