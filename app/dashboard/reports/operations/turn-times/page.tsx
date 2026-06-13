import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TurnTimesReport } from "@/components/reports/operations/TurnTimesReport"

export default async function TurnTimesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: loads } = await supabase
    .from("loads")
    .select("id, reference_number, status, actual_pickup, completed_date, pickup_location, delivery_location, created_at, customer_id, customers(id, name)")
    .not("actual_pickup", "is", null)
    .not("completed_date", "is", null)
    .order("created_at", { ascending: false })
    .limit(1000)

  return <TurnTimesReport loads={(loads || []) as any} />
}
