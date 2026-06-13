import { createClient } from "@/lib/supabase/server"
import { SettlementsView } from "@/components/accounts-payable/SettlementsView"
import { redirect } from "next/navigation"
import { formatISO, startOfWeek, endOfWeek, format } from "date-fns"

async function getSettlementsData(startDate: Date, endDate: Date) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "driver"

  if (!["admin", "dispatcher", "finance", "accounting"].includes(role)) {
    redirect("/dashboard")
  }

  // Fetch driver pay aggregated by driver — only Approved+ records flow to settlements
  const { data: driverPayData } = await supabase
    .from("ap_driver_pay")
    .select(`
      id,
      driver_id,
      amount,
      pay_date,
      created_at,
      status,
      truck_number,
      owner,
      drivers(id, name, phone, email, status)
    `)
    .in("status", ["Approved", "Settled", "Paid"])
    .gte("pay_date", formatISO(startDate))
    .lte("pay_date", formatISO(endDate))

  // Fetch deductions aggregated by driver
  const { data: deductionsData } = await supabase
    .from("ap_deductions")
    .select(`
      id,
      driver_id,
      amount,
      created_at,
      status,
      drivers(id, name, phone, email, status)
    `)
    .gte("created_at", formatISO(startDate))
    .lte("created_at", formatISO(endDate))

  // Fetch all drivers for filter
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name")
    .order("name", { ascending: true })

  // Fetch all fleet owners for filter
  const { data: fleetOwners } = await supabase
    .from("fleet_owners")
    .select("id, name")
    .order("name", { ascending: true })

  // Fetch settlements whose period overlaps the selected date range
  const { data: settlementsData, error: settlementsError } = await supabase
    .from("ap_settlements")
    .select(`
      id,
      driver_id,
      settlement_number,
      period_start,
      period_end,
      total_driver_pay,
      total_deductions,
      net_pay,
      status,
      drivers(id, name, phone, email, status)
    `)
    .lte("period_start", formatISO(endDate))
    .gte("period_end", formatISO(startDate))
    .order("created_at", { ascending: false })

  if (settlementsError) {
    console.error("[Settlements] Fetch error:", settlementsError)
  }

  // Aggregate pay by driver
  const driverPayAgg: Record<
    string,
    { driver: any; totalPay: number; records: any[]; truck_number: string | null; owner: string | null }
  > = {}
  driverPayData?.forEach((record: any) => {
    if (!driverPayAgg[record.driver_id]) {
      driverPayAgg[record.driver_id] = {
        driver: record.drivers,
        totalPay: 0,
        records: [],
        truck_number: record.truck_number || null,
        owner: record.owner || null,
      }
    }
    driverPayAgg[record.driver_id].totalPay += record.amount || 0
    driverPayAgg[record.driver_id].records.push(record)
    // Keep latest truck_number/owner
    if (record.truck_number) driverPayAgg[record.driver_id].truck_number = record.truck_number
    if (record.owner) driverPayAgg[record.driver_id].owner = record.owner
  })

  // Aggregate deductions by driver
  const deductionsAgg: Record<
    string,
    { driver: any; totalDeductions: number; records: any[] }
  > = {}
  deductionsData?.forEach((record) => {
    if (!deductionsAgg[record.driver_id]) {
      deductionsAgg[record.driver_id] = {
        driver: record.drivers,
        totalDeductions: 0,
        records: [],
      }
    }
    deductionsAgg[record.driver_id].totalDeductions += record.amount || 0
    deductionsAgg[record.driver_id].records.push(record)
  })

  // Merge both aggregations
  const allDriverIds = new Set([
    ...Object.keys(driverPayAgg),
    ...Object.keys(deductionsAgg),
  ])

  // Also include drivers from settlements that might not have pay records in the date range
  const settlementDriverIds = (settlementsData || []).map((s: any) => s.driver_id)
  settlementDriverIds.forEach((dId: string) => allDriverIds.add(dId))

  const settlements = Array.from(allDriverIds).map((driverId, index) => {
    const payData = driverPayAgg[driverId]
    const deductionData = deductionsAgg[driverId]
    const totalPay = payData?.totalPay || 0
    const totalDeductions = deductionData?.totalDeductions || 0

    // Find settlement record if exists
    const settlement = (settlementsData || []).find((s: any) => s.driver_id === driverId)

    // Build driver info from available sources
    const driverFromPay = payData?.driver
    const driverFromDeduction = deductionData?.driver
    const driverFromSettlement = settlement?.drivers
    const driverInfo = driverFromPay || driverFromDeduction || driverFromSettlement

    return {
      id: settlement?.id || `settlement-${index}`,
      driver_id: driverId,
      driver: {
        id: driverInfo?.id || driverId,
        name: driverInfo?.name || "Unknown Driver",
        phone: driverInfo?.phone || "",
        email: driverInfo?.email || "",
      },
      truck_number: payData?.truck_number || null,
      owner: payData?.owner || null,
      total_driver_pay: settlement ? (settlement.total_driver_pay || totalPay) : totalPay,
      total_deductions: settlement ? (settlement.total_deductions || totalDeductions) : totalDeductions,
      net_pay: settlement ? (settlement.net_pay || (totalPay - totalDeductions)) : (totalPay - totalDeductions),
      status: settlement?.status || "Pending",
      period_start: settlement?.period_start || format(startDate, "yyyy-MM-dd"),
      period_end: settlement?.period_end || format(endDate, "yyyy-MM-dd"),
      settlement_record: settlement,
    }
  })

  // Calculate summary stats
  const stats = {
    pending: {
      count: (settlements || []).filter((s) => s.status === "Pending").length,
    },
    reviewed: {
      count: (settlements || []).filter((s) => s.status === "Reviewed").length,
    },
    finalized: {
      count: (settlements || []).filter((s) => s.status === "Finalized").length,
    },
  }

  return {
    settlements,
    drivers: drivers || [],
    fleetOwners: fleetOwners || [],
    stats,
  }
}

export default async function SettlementsPage({
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

  const { settlements, drivers, fleetOwners, stats } = await getSettlementsData(
    startDate,
    endDate
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Driver Settlements</h2>
          <p className="mt-1 text-sm text-gray-400">
            Review and finalize driver settlements
          </p>
        </div>
      </div>

      <SettlementsView
        initialData={settlements}
        drivers={drivers}
        fleetOwners={fleetOwners}
        stats={stats}
        initialStartDate={startDate}
        initialEndDate={endDate}
      />
    </div>
  )
}
