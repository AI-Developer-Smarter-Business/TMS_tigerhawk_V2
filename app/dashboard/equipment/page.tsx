// app/dashboard/equipment/page.tsx
import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { EquipmentPageTabs } from "@/components/equipment/EquipmentPageTabs"
import { redirect } from "next/navigation"

async function getEquipmentData() {
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

  // Fetch trucks
  const { data: trucks } = await supabase
    .from("trucks")
    .select("*")
    .order("truck_number", { ascending: true })

  // Fetch chassis
  const { data: chassisList } = await supabase
    .from("chassis")
    .select("*")
    .order("chassis_number", { ascending: true })

  const allTrucks = trucks || []
  const allChassis = chassisList || []

  const truckStatusCounts = {
    total: allTrucks.length,
    available: allTrucks.filter((t) => t.status === "Available").length,
    dispatched: allTrucks.filter((t) => t.status === "Dispatched").length,
    enabled: allTrucks.filter((t) => t.enabled !== false).length,
    disabled: allTrucks.filter((t) => t.enabled === false).length,
  }

  const chassisStatusCounts = {
    total: allChassis.length,
    enabled: allChassis.filter((c) => c.enabled !== false).length,
    disabled: allChassis.filter((c) => c.enabled === false).length,
  }

  return { trucks: allTrucks, chassisList: allChassis, truckStatusCounts, chassisStatusCounts }
}

export default async function EquipmentPage() {
  const { trucks, chassisList, truckStatusCounts, chassisStatusCounts } = await getEquipmentData()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Equipment</h2>
            <p className="mt-1 text-sm text-gray-400">
              Manage trucks, chassis, and fleet equipment
            </p>
          </div>
        </div>

        {/* Tabs + Content */}
        <EquipmentPageTabs
          trucks={trucks}
          chassisList={chassisList}
          truckStatusCounts={truckStatusCounts}
          chassisStatusCounts={chassisStatusCounts}
        />
      </div>
    </DashboardLayout>
  )
}
