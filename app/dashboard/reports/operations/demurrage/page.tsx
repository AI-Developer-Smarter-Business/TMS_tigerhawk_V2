import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DemurrageReport } from "@/components/reports/operations/DemurrageReport"

export default async function DemurragePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: loads } = await supabase
    .from("loads")
    .select("id, reference_number, status, delivery_location, created_at, customer_id, customers(id, name), containers(id, container_number, last_free_day, status)")
    .not("status", "eq", "Completed")
    .order("created_at", { ascending: false })

  return <DemurrageReport loads={(loads || []) as any} />
}
