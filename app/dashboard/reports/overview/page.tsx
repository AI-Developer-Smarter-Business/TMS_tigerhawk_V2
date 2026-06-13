import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OverviewDashboard } from "@/components/reports/OverviewDashboard"

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Get date range - last 30 days default
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startDate = thirtyDaysAgo.toISOString()

  // Fetch loads
  const { data: loads, error: loadsError } = await supabase
    .from("loads")
    .select("id, status, created_at, actual_pickup, completed_date, delivery_apt_to, customer_id, driver_id, pickup_location, delivery_location")
    .gte("created_at", startDate)
    .order("created_at", { ascending: false })

  // Fetch invoices
  const { data: invoices, error: invoicesError } = await supabase
    .from("ar_invoices")
    .select("id, amount, amount_paid, billing_status, customer_id, created_at, customers(id, name)")
    .gte("created_at", startDate)

  // Fetch all open invoices (regardless of date) for open A/R
  const { data: openInvoices } = await supabase
    .from("ar_invoices")
    .select("id, amount, amount_paid, billing_status")
    .not("billing_status", "in", '("Paid","Cancelled","Write-off")')

  // Fetch customers for revenue chart
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")

  return (
    <OverviewDashboard
      loads={loads || []}
      invoices={(invoices || []) as any}
      openInvoices={openInvoices || []}
      customers={customers || []}
      error={loadsError?.message || invoicesError?.message || null}
    />
  )
}
