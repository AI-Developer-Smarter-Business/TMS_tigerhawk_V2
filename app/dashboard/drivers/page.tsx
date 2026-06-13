// app/dashboard/drivers/page.tsx
import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { DriverPageTabs } from "@/components/drivers/DriverPageTabs"
import { redirect } from "next/navigation"

async function getDriverData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "driver"

  if (!["admin", "dispatcher"].includes(role)) {
    redirect("/dashboard")
  }

  // Get all drivers with their current assignments
  const { data: drivers } = await supabase
    .from("drivers")
    .select(`
      *,
      loads:loads!driver_id(
        id,
        reference_number,
        status,
        pickup_location,
        delivery_location,
        scheduled_pickup
      )
    `)
    .order("name", { ascending: true })

  // Fetch all trucks for the Truck Assignments tab
  const { data: trucks } = await supabase
    .from("trucks")
    .select("truck_number, truck_owner, enabled")
    .eq("enabled", true)
    .order("truck_number", { ascending: true })

  const enrichedDrivers = (drivers || []).map((driver) => {
    const activeLoads = driver.loads?.filter((s: { status: string }) =>
      ["Assigned", "Dispatched", "In Transit"].includes(s.status)
    ) || []

    const completedLoads = driver.loads?.filter((s: { status: string }) =>
      s.status === "Completed"
    ) || []

    return {
      ...driver,
      activeShipmentCount: activeLoads.length,
      completedShipmentCount: completedLoads.length,
      currentShipment: activeLoads[0] || null,
    }
  })

  const statusCounts = {
    total: enrichedDrivers.length,
    available: enrichedDrivers.filter((d) => d.status === "Available").length,
    dispatched: enrichedDrivers.filter((d) => d.status === "On Assignment").length,
    enabled: enrichedDrivers.filter((d) => d.enabled !== false).length,
    disabled: enrichedDrivers.filter((d) => d.enabled === false).length,
  }

  return { drivers: enrichedDrivers, statusCounts, trucks: trucks || [] }
}

export default async function DriversPage() {
  const { drivers, statusCounts, trucks } = await getDriverData()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Drivers</h2>
            <p className="mt-1 text-sm text-gray-400">
              Manage driver profiles, assignments, and compliance
            </p>
          </div>
        </div>

        {/* Tabs + Content */}
        <DriverPageTabs drivers={drivers} statusCounts={statusCounts} trucks={trucks} />
      </div>
    </DashboardLayout>
  )
}

