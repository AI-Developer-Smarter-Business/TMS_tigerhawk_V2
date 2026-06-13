import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { SavingsReport } from "@/components/reports/operations/SavingsReport"

export default async function SavingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: loads } = await supabase
    .from("loads")
    .select("id, reference_number, load_type, status, created_at, customer_id, customers(id, name), containers(id, container_number)")
    .order("created_at", { ascending: false })

  return <SavingsReport loads={(loads || []) as any} />
}
