// app/dashboard/shipments/new/page.tsx
import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { NewShipmentForm } from "@/components/forms/NewShipmentForm"
import { redirect } from "next/navigation"

type Customer = { id: string; name: string }
type Container = {
  id: string
  container_number: string
  bol_number: string | null
  size: string | null
  type: string | null
  status: string
  vessels: { name: string; terminal: string } | null
}
type Driver = { id: string; name: string; phone: string; status: string }

async function getFormData(): Promise<{
  customers: Customer[]
  containers: Container[]
  drivers: Driver[]
}> {
  const supabase = await createClient()

  // Verify user is authenticated and has permission (admin/dispatcher)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  // Only admin/dispatcher can create shipments
  if (profile?.role === "driver") {
    redirect("/dashboard/shipments")
  }

  const [
    { data: rawCustomers },
    { data: rawContainers },
    { data: rawDrivers },
  ] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase
      .from("containers")
      .select("id, container_number, bol_number, size, type, status, vessels ( name, terminal )")
      .in("status", ["Available", "Released", "On Vessel", "In Transit"])
      .order("container_number"),
    supabase
      .from("drivers")
      .select("id, name, phone, status")
      .order("name"),
  ])

  // Supabase returns joined relations as arrays — flatten to single object
  const containers: Container[] = (rawContainers || []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    container_number: c.container_number as string,
    bol_number: (c.bol_number as string) || null,
    size: (c.size as string) || null,
    type: (c.type as string) || null,
    status: c.status as string,
    vessels: Array.isArray(c.vessels) && c.vessels.length > 0
      ? { name: c.vessels[0].name as string, terminal: c.vessels[0].terminal as string }
      : null,
  }))

  return {
    customers: (rawCustomers || []) as Customer[],
    containers,
    drivers: (rawDrivers || []) as Driver[],
  }
}

export default async function NewShipmentPage() {
  const { customers, containers, drivers } = await getFormData()

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <a
            href="/dashboard/shipments"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </a>
          <div>
            <h2 className="text-2xl font-bold text-white">New Shipment</h2>
            <p className="mt-1 text-sm text-gray-400">
              Create a new drayage order
            </p>
          </div>
        </div>

        {/* Form */}
        <NewShipmentForm
          customers={customers}
          containers={containers}
          drivers={drivers}
        />
      </div>
    </DashboardLayout>
  )
}
