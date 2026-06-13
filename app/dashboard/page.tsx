// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { DashboardClient, type DashboardData } from "@/components/dashboard/DashboardClient"
import { redirect } from "next/navigation"

// ─── Non-terminal statuses for pipeline counting ───────────
const NON_TERMINAL_STATUSES = [
  "Available",
  "Available At Port",
  "Pending",
  "Customs Hold",
  "Freight Released",
  "Created",
  "Assigned",
  "Dispatched",
  "In Transit",
  "Arrived At Pickup",
  "Arrived At Delivery",
  "Arrived At Return Empty",
  "Arrived To Hook Container",
  "At Warehouse",
  "Dropped - Empty",
  "Dropped - Loaded",
  "Enroute To Drop Container",
  "Enroute To Return Empty",
  "Delivered",
]

// ─── Select constants for targeted queries ──────────────────
const PER_DIEM_SELECT = `
  id, reference_number, per_diem_free_day, status,
  containers ( container_number, last_free_day ),
  customers ( name )
`

const HOLDS_SELECT = `
  id, reference_number,
  containers ( container_number ),
  freight_hold, customs_hold, terminal_hold, fees_hold, carrier_hold, other_hold,
  customers ( name )
`

const APPOINTMENTS_SELECT = `
  id, reference_number, status,
  containers ( container_number ),
  pickup_apt_from, pickup_apt_to,
  delivery_apt_from, delivery_apt_to,
  return_apt_from, return_apt_to,
  customers ( name ),
  drivers ( name )
`

const RECENT_SELECT = `
  id, reference_number, status, created_at,
  customers ( name ),
  containers ( container_number ),
  drivers ( name )
`

async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Get user role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single()

  const role = profile?.role || "driver"
  const userName = profile?.full_name || user.email || "User"
  const isStaff = role === "admin" || role === "dispatcher"

  // Today's date boundaries for appointment filtering
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // ─── Run all queries in parallel ──────────────────────────
  const [
    // Stats: parallel count queries
    activeResult,
    vesselResult,
    containerResult,
    demurrageResult,
    // Module data
    perDiemResult,
    holdsResult,
    appointmentsResult,
    arResult,
    pipelineResult,
    driverResult,
    recentResult,
    warehouseResult,
  ] = await Promise.all([
    // Active shipments count
    supabase
      .from("loads")
      .select("id, created_at", { count: "exact" })
      .in("status", ["Created", "Assigned", "Dispatched", "In Transit"]),

    // Vessels
    supabase.from("vessels").select("id, name, terminal, eta, shipping_line").order("eta", { ascending: true }),

    // Available containers count
    supabase
      .from("containers")
      .select("id", { count: "exact", head: true })
      .eq("status", "Available"),

    // Demurrage alerts — containers with LFD within 3 days
    supabase
      .from("containers")
      .select("id", { count: "exact", head: true })
      .not("last_free_day", "is", null)
      .gte("last_free_day", new Date(Date.now() - 0).toISOString().split("T")[0])
      .lte(
        "last_free_day",
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      ),

    // Per Diem / LFD — loads with per_diem_free_day set, not completed/cancelled
    isStaff
      ? supabase
          .from("loads")
          .select(PER_DIEM_SELECT)
          .in("status", NON_TERMINAL_STATUSES)
          .order("per_diem_free_day", { ascending: true, nullsFirst: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),

    // Holds — loads with any hold active
    isStaff
      ? supabase
          .from("loads")
          .select(HOLDS_SELECT)
          .in("status", NON_TERMINAL_STATUSES)
          .limit(50)
      : Promise.resolve({ data: [], error: null }),

    // Today's appointments — loads with any apt today
    isStaff
      ? supabase
          .from("loads")
          .select(APPOINTMENTS_SELECT)
          .in("status", NON_TERMINAL_STATUSES)
          .or(
            `and(pickup_apt_from.gte.${todayStart.toISOString()},pickup_apt_from.lte.${todayEnd.toISOString()}),and(delivery_apt_from.gte.${todayStart.toISOString()},delivery_apt_from.lte.${todayEnd.toISOString()}),and(return_apt_from.gte.${todayStart.toISOString()},return_apt_from.lte.${todayEnd.toISOString()})`
          )
          .limit(50)
      : Promise.resolve({ data: [], error: null }),

    // AR invoices — outstanding
    isStaff
      ? supabase
          .from("ar_invoices")
          .select("id, invoice_number, amount, amount_paid, due_date, billing_status, customers ( name )")
          .not("billing_status", "in", '("Paid","Voided","Consolidated")')
          .limit(200)
      : Promise.resolve({ data: [], error: null }),

    // Load pipeline — all non-terminal loads for status counting
    isStaff
      ? supabase
          .from("loads")
          .select("status")
          .in("status", NON_TERMINAL_STATUSES)
      : Promise.resolve({ data: [], error: null }),

    // Drivers
    isStaff
      ? supabase.from("drivers").select("id, name, status")
      : Promise.resolve({ data: [], error: null }),

    // Recent shipments
    supabase
      .from("loads")
      .select(RECENT_SELECT)
      .order("created_at", { ascending: false })
      .limit(5),

    // Warehouse
    isStaff
      ? supabase.from("warehouse_inventory").select("*")
      : Promise.resolve({ data: [], error: null }),
  ])

  // ─── Log errors ───────────────────────────────────────────
  const queryResults = [
    { name: "active", ...activeResult },
    { name: "vessels", ...vesselResult },
    { name: "containers", ...containerResult },
    { name: "demurrage", ...demurrageResult },
    { name: "perDiem", ...perDiemResult },
    { name: "holds", ...holdsResult },
    { name: "appointments", ...appointmentsResult },
    { name: "ar", ...arResult },
    { name: "pipeline", ...pipelineResult },
    { name: "drivers", ...driverResult },
    { name: "recent", ...recentResult },
    { name: "warehouse", ...warehouseResult },
  ]
  for (const qr of queryResults) {
    if (qr.error) {
      const err = qr.error as { message?: string; code?: string; details?: string | null }
      console.error(
        `Dashboard query error (${qr.name}):`,
        err.message || err.code || err.details || JSON.stringify(qr.error)
      )
    }
  }

  // ─── Stats computation ────────────────────────────────────
  const activeShipments = activeResult.data || []
  const todayStr = new Date().toDateString()
  const newToday = activeShipments.filter(
    (s: { created_at: string }) =>
      new Date(s.created_at).toDateString() === todayStr
  ).length

  const vessels = vesselResult.data || []
  const arrivingToday = vessels.filter((v: { eta: string | null }) => {
    if (!v.eta) return false
    return new Date(v.eta).toDateString() === todayStr
  }).length

  // ─── Per Diem data shaping ────────────────────────────────
  const perDiemLoads = (perDiemResult.data || [])
    .filter(
      (l: any) =>
        l.per_diem_free_day ||
        (l.containers && (l.containers as any).last_free_day)
    )
    .map((l: any) => ({
      id: l.id,
      reference_number: l.reference_number,
      per_diem_free_day: l.per_diem_free_day,
      container_number: l.containers?.container_number ?? null,
      container_lfd: l.containers?.last_free_day || null,
      customer_name: l.customers?.name || null,
      status: l.status,
    }))

  // ─── Holds data shaping ───────────────────────────────────
  const holdLoads = (holdsResult.data || [])
    .filter((l: any) => {
      return (
        l.freight_hold === "hold" ||
        l.customs_hold === "hold" ||
        l.terminal_hold === "hold" ||
        l.fees_hold === "hold" ||
        l.carrier_hold === true ||
        l.other_hold === "hold"
      )
    })
    .map((l: any) => ({
      id: l.id,
      reference_number: l.reference_number,
      container_number: l.containers?.container_number ?? null,
      customer_name: l.customers?.name || null,
      freight_hold: l.freight_hold,
      customs_hold: l.customs_hold,
      terminal_hold: l.terminal_hold,
      fees_hold: l.fees_hold,
      carrier_hold: l.carrier_hold,
      other_hold: l.other_hold,
    }))

  // ─── Appointments data shaping ────────────────────────────
  const appointmentLoads = (appointmentsResult.data || []).map((l: any) => ({
    id: l.id,
    reference_number: l.reference_number,
    container_number: l.containers?.container_number ?? null,
    customer_name: l.customers?.name || null,
    driver_name: l.drivers?.name || null,
    pickup_apt_from: l.pickup_apt_from,
    pickup_apt_to: l.pickup_apt_to,
    delivery_apt_from: l.delivery_apt_from,
    delivery_apt_to: l.delivery_apt_to,
    return_apt_from: l.return_apt_from,
    return_apt_to: l.return_apt_to,
    status: l.status,
  }))

  // ─── AR data shaping ──────────────────────────────────────
  const arInvoices = (arResult.data || []).map((inv: any) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    customer_name: inv.customers?.name || null,
    amount: inv.amount || 0,
    amount_paid: inv.amount_paid || 0,
    due_date: inv.due_date,
    billing_status: inv.billing_status,
  }))

  // ─── Pipeline status counts ───────────────────────────────
  const statusCounts: Record<string, number> = {}
  for (const load of pipelineResult.data || []) {
    const s = (load as any).status
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }

  // ─── Warehouse computation ────────────────────────────────
  const warehouseItems = warehouseResult.data || []
  const totalPallets =
    warehouseItems.reduce((sum: number, item: any) => {
      if (item.unit === "pallets") return sum + (item.quantity || 0)
      return sum
    }, 0) || 0

  // ─── Recent shipments shaping ─────────────────────────────
  const recentShipments = (recentResult.data || []).map((s: any) => ({
    id: s.id,
    reference_number: s.reference_number,
    status: s.status,
    customers: s.customers,
    containers: s.containers,
    drivers: s.drivers,
  }))

  return {
    role,
    userName,
    stats: {
      activeShipments: activeResult.count ?? activeShipments.length,
      newToday,
      vesselCount: vessels.length,
      arrivingToday,
      availableContainers: containerResult.count ?? 0,
      demurrageAlerts: demurrageResult.count ?? 0,
    },
    perDiemLoads,
    holdLoads,
    appointmentLoads,
    arInvoices,
    statusCounts,
    drivers: (driverResult.data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      status: d.status,
    })),
    recentShipments,
    vessels: vessels.map((v: any) => ({
      id: v.id,
      name: v.name,
      terminal: v.terminal,
      eta: v.eta,
      shipping_line: v.shipping_line,
    })),
    warehouse: {
      totalPallets,
      capacity: 500,
      pendingTransloads:
        warehouseItems.filter((w: any) => w.status === "Transload").length || 0,
      outboundToday:
        warehouseItems.filter((w: any) => {
          if (!w.release_date) return false
          return new Date(w.release_date).toDateString() === todayStr
        }).length || 0,
      inboundExpected:
        warehouseItems.filter((w: any) => {
          if (!w.received_date) return false
          return new Date(w.received_date).toDateString() === todayStr
        }).length || 0,
    },
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <DashboardLayout>
      <DashboardClient data={data} />
    </DashboardLayout>
  )
}
