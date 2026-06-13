import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PaymentTrailReport } from "@/components/reports/audit/PaymentTrailReport"

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: payments } = await supabase
    .from("ar_payments")
    .select("id, payment_number, customer_id, payment_date, payment_method, amount, created_at, customers(id, name)")
    .order("payment_date", { ascending: false })

  const { data: applications } = await supabase
    .from("ar_payment_applications")
    .select("id, payment_id, invoice_id, amount, ar_invoices(id, invoice_number)")

  return <PaymentTrailReport payments={(payments || []) as any} applications={(applications || []) as any} />
}
