import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WaitingTimeReport } from "@/components/reports/audit/WaitingTimeReport"

export default async function WaitingTimePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: events } = await supabase
    .from("waiting_time_events")
    .select("id, load_id, event_name, event_date, duration_minutes, billable, rate_per_hour, charge_amount, notes, created_at, loads(id, reference_number, customer_id, customers(id, name))")
    .order("event_date", { ascending: false })

  return <WaitingTimeReport events={(events || []) as any} />
}
