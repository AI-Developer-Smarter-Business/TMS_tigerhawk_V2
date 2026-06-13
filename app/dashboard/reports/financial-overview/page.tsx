// app/dashboard/reports/financial-overview/page.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FinancialOverviewView } from "@/components/admin/FinancialOverviewView"

export default async function FinancialOverviewPage() {
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
    redirect("/dashboard/reports")
  }

  return <FinancialOverviewView />
}
