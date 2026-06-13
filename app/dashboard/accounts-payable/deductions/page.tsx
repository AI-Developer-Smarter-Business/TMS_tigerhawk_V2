import { createClient } from "@/lib/supabase/server"
import { DeductionsView } from "@/components/accounts-payable/DeductionsView"
import { redirect } from "next/navigation"
import { startOfWeek, endOfWeek, format, formatISO } from "date-fns"

async function getDeductionsData(startDate: Date, endDate: Date) {
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

  // Fetch deductions with driver data — filter by deduction_date within period
  const { data: deductionsData } = await supabase
    .from("ap_deductions")
    .select(`
      id,
      driver_id,
      deduction_type,
      description,
      unit_of_measure,
      math_operation,
      amount,
      final_amount,
      deduction_date,
      created_at,
      status,
      drivers(
        id,
        name,
        phone
      )
    `)
    .gte("deduction_date", formatISO(startDate))
    .lte("deduction_date", formatISO(endDate))
    .order("deduction_date", { ascending: false })

  // Fetch all drivers for filter
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name")
    .order("name", { ascending: true })

  // Calculate summary stats
  // DB constraint: status IN ('Unapproved','Approved','Settled')
  const stats = {
    unapproved: {
      count: (deductionsData || []).filter((d) => d.status === "Unapproved").length,
      amount: (deductionsData || [])
        .filter((d) => d.status === "Unapproved")
        .reduce((sum, d) => sum + (d.final_amount || d.amount || 0), 0),
    },
    approved: {
      count: (deductionsData || []).filter((d) => d.status === "Approved").length,
      amount: (deductionsData || [])
        .filter((d) => d.status === "Approved")
        .reduce((sum, d) => sum + (d.final_amount || d.amount || 0), 0),
    },
    settled: {
      count: (deductionsData || []).filter((d) => d.status === "Settled").length,
      amount: (deductionsData || [])
        .filter((d) => d.status === "Settled")
        .reduce((sum, d) => sum + (d.final_amount || d.amount || 0), 0),
    },
  }

  return {
    deductionsData: deductionsData || [],
    drivers: drivers || [],
    stats,
  }
}

export default async function DeductionsPage({
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

  // Always snap to Sun-Sat
  const startDate = params.startDate
    ? startOfWeek(parseLocal(params.startDate), { weekStartsOn: 0 })
    : weekStart
  const endDate = params.endDate
    ? endOfWeek(parseLocal(params.startDate || params.endDate!), { weekStartsOn: 0 })
    : weekEnd

  const { deductionsData, drivers, stats } = await getDeductionsData(startDate, endDate)

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Deductions</h2>
          <p className="mt-1 text-sm text-gray-400">
            Manage driver deductions and adjustments
          </p>
        </div>
      </div>

      <DeductionsView
        initialData={deductionsData as any}
        drivers={drivers}
        stats={stats}
        initialStartDate={startDate}
        initialEndDate={endDate}
      />
    </div>
  )
}
