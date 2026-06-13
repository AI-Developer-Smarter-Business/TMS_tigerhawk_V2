// app/dashboard/shipments/page.tsx
import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { ShipmentTable } from "@/components/tables/ShipmentTable"
import { redirect } from "next/navigation"

async function getShipmentData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "driver"

  // RLS automatically filters: drivers only see their assigned shipments
  const { data: shipments } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( container_number, bol_number, size, type, status, last_free_day ),
      drivers ( id, name, phone, status )
    `)
    .order("created_at", { ascending: false })

  const { data: availableDrivers } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("status", "Available")

  const enriched = (shipments || []).map((s) => {
    let urgency: "normal" | "warning" | "critical" = "normal"
    if (s.containers?.last_free_day) {
      const daysLeft = Math.ceil(
        (new Date(s.containers.last_free_day).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      if (daysLeft <= 1) urgency = "critical"
      else if (daysLeft <= 3) urgency = "warning"
    }
    if (s.status === "Created" && !s.driver_id) urgency = "warning"
    return { ...s, urgency }
  })

  const statusCounts = {
    total: enriched.length,
    created: enriched.filter((s) => s.status === "Created").length,
    assigned: enriched.filter((s) => s.status === "Assigned").length,
    dispatched: enriched.filter((s) => s.status === "Dispatched").length,
    inTransit: enriched.filter((s) => s.status === "In Transit").length,
    delivered: enriched.filter((s) => s.status === "Delivered").length,
    completed: enriched.filter((s) => s.status === "Completed").length,
  }

  return { shipments: enriched, statusCounts, availableDrivers: availableDrivers || [], role }
}

export default async function ShipmentsPage() {
  const { shipments, statusCounts, availableDrivers, role } = await getShipmentData()
  const isStaff = role === "admin" || role === "dispatcher"

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {role === "driver" ? "My Shipments" : "Shipments"}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {role === "driver"
                ? "Your assigned drayage orders"
                : "Manage drayage orders from creation to delivery"}
            </p>
          </div>
          {isStaff && (
            <a
              href="/dashboard/shipments/new"
              className="inline-flex px-4 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors shadow-lg shadow-[#E8700A]/20"
            >
              + New Shipment
            </a>
          )}
        </div>

        {/* Status Pipeline — staff only */}
        {isStaff && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <PipelineStep label="Created" count={statusCounts.created} color="gray" />
            <PipelineArrow />
            <PipelineStep label="Assigned" count={statusCounts.assigned} color="blue" />
            <PipelineArrow />
            <PipelineStep label="Dispatched" count={statusCounts.dispatched} color="purple" />
            <PipelineArrow />
            <PipelineStep label="In Transit" count={statusCounts.inTransit} color="orange" />
            <PipelineArrow />
            <PipelineStep label="Delivered" count={statusCounts.delivered} color="emerald" />
            <PipelineArrow />
            <PipelineStep label="Completed" count={statusCounts.completed} color="emerald" filled />
          </div>
        )}

        {/* Shipment Table */}
        <div className="bg-[#111827] rounded-xl border border-white/5">
          <ShipmentTable shipments={shipments} availableDrivers={availableDrivers} />
        </div>
      </div>
    </DashboardLayout>
  )
}

function PipelineStep({
  label,
  count,
  color,
  filled,
}: {
  label: string
  count: number
  color: string
  filled?: boolean
}) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    gray: { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
    orange: { bg: "bg-[#E8700A]/10", text: "text-[#FF8C21]", border: "border-[#E8700A]/20" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  }
  const c = colors[color] || colors.gray

  return (
    <div className={`flex-1 min-w-[100px] ${c.bg} border ${c.border} rounded-lg px-4 py-3 text-center`}>
      <p className={`text-2xl font-bold ${c.text}`}>{count}</p>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  )
}

function PipelineArrow() {
  return (
    <div className="flex items-center text-gray-600 flex-shrink-0">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </div>
  )
}
