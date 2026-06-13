import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { WaitingTimeAuditView } from "@/components/accounts-receivable/WaitingTimeAuditView"

async function getWaitingTimeAuditData() {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch waiting time events with direct joins
  const { data: events, error: eventsError } = await supabase
    .from("waiting_time_events")
    .select(`
      *,
      loads (id, reference_number),
      customers (id, name),
      drivers (id, name)
    `)
    .order("arrived_at", { ascending: false })

  // Fetch customers for filtering
  const { data: customers, error: customersError } = await supabase
    .from("customers")
    .select("id, name")
    .order("name", { ascending: true })

  if (eventsError || customersError) {
    const error = eventsError?.message || customersError?.message
    return { events: [], customers: [], error }
  }

  return {
    events: events || [],
    customers: customers || [],
    error: null,
  }
}

export default async function WaitingTimeAuditPage() {
  const { events, customers, error } = await getWaitingTimeAuditData()

  return (
    <WaitingTimeAuditView
      initialEvents={events}
      initialCustomers={customers}
      error={error ?? null}
    />
  )
}
