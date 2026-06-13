import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NotificationCenterView } from "@/components/notifications/NotificationCenterView"

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "dispatcher", "accounting", "finance"].includes(profile.role)) {
    redirect("/dashboard")
  }

  return <NotificationCenterView />
}
