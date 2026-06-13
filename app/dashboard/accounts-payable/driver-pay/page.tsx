import { createClient } from "@/lib/supabase/server"
import { DriverPayView } from "@/components/accounts-payable/DriverPayView"
import { redirect } from "next/navigation"
import { formatISO, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns"

async function getDriverPayData(startDate: Date, endDate: Date) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "driver"

  if (!["admin", "dispatcher", "finance"].includes(role)) {
    redirect("/dashboard")
  }

  // Fetch driver pay records with related data
  // Note: table columns are container_number (text), pay_date (timestamptz), created_at (timestamptz)
  // Use LEFT join (not inner) so records still show if load/driver is deleted
  const { data: driverPayData, error: fetchError } = await supabase
    .from("ap_driver_pay")
    .select(`
      id,
      driver_id,
      load_id,
      container_number,
      truck_number,
      owner,
      amount,
      from_location,
      to_location,
      pay_date,
      created_at,
      status,
      notes,
      loads(
        id,
        reference_number,
        status,
        customer_id,
        driver_id
      ),
      drivers(
        id,
        name,
        phone,
        status
      )
    `)
    .gte("pay_date", formatISO(startDate))
    .lte("pay_date", formatISO(endDate))
    .order("pay_date", { ascending: false })

  if (fetchError) {
    console.error("Driver pay fetch error:", fetchError)
  }

  // Fetch all drivers for filter
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name")
    .order("name", { ascending: true })

  // Fetch all trucks for filter
  const { data: trucks } = await supabase
    .from("trucks")
    .select("truck_number")
    .eq("enabled", true)
    .order("truck_number", { ascending: true })

  // Fetch all fleet owners for filter
  const { data: fleetOwners } = await supabase
    .from("fleet_owners")
    .select("id, name")
    .order("name", { ascending: true })

  // Calculate summary stats
  const stats = {
    unapproved: {
      count: (driverPayData || []).filter((d) => d.status === "Unapproved").length,
      amount: (driverPayData || [])
        .filter((d) => d.status === "Unapproved")
        .reduce((sum, d) => sum + (d.amount || 0), 0),
    },
    approved: {
      count: (driverPayData || []).filter((d) => d.status === "Approved").length,
      amount: (driverPayData || [])
        .filter((d) => d.status === "Approved")
        .reduce((sum, d) => sum + (d.amount || 0), 0),
    },
    settled: {
      count: (driverPayData || []).filter((d) => d.status === "Settled").length,
      amount: (driverPayData || [])
        .filter((d) => d.status === "Settled")
        .reduce((sum, d) => sum + (d.amount || 0), 0),
    },
    paid: {
      count: (driverPayData || []).filter((d) => d.status === "Paid").length,
      amount: (driverPayData || [])
        .filter((d) => d.status === "Paid")
        .reduce((sum, d) => sum + (d.amount || 0), 0),
    },
  }

  return {
    driverPayData: driverPayData || [],
    drivers: drivers || [],
    trucks: trucks || [],
    fleetOwners: fleetOwners || [],
    stats,
  }
}

export default async function DriverPayPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>
}) {
  const params = await searchParams

  // Parse "YYYY-MM-DD" as local date (not UTC) to avoid timezone shift
  const parseLocal = (s: string) => {
    const [y, m, d] = s.split("-").map(Number)
    return new Date(y, m - 1, d)
  }

  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }) // Sunday
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 })     // Saturday

  // Always snap to Sun-Sat: derive end from start + 6 days
  const startDate = params.startDate
    ? startOfWeek(parseLocal(params.startDate), { weekStartsOn: 0 })
    : weekStart
  const endDate = params.endDate
    ? endOfWeek(parseLocal(params.startDate || params.endDate!), { weekStartsOn: 0 })
    : weekEnd

  const { driverPayData, drivers, trucks, fleetOwners, stats } =
    await getDriverPayData(startDate, endDate)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Driver Pay</h2>
          <p className="mt-1 text-sm text-gray-400">
            Manage driver compensation and payments
          </p>
        </div>
      </div>

      <DriverPayView
        initialData={driverPayData as any}
        drivers={drivers}
        trucks={trucks}
        fleetOwners={fleetOwners}
        stats={stats}
        initialStartDate={startDate}
        initialEndDate={endDate}
      />
    </div>
  )
}
