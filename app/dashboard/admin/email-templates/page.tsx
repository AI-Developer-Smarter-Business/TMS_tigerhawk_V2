// app/dashboard/admin/email-templates/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { EmailTemplatesView } from "@/components/admin/EmailTemplatesView"

export default async function EmailTemplatesPage() {
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
      <EmailTemplatesView />
    </DashboardLayout>
  )
}
