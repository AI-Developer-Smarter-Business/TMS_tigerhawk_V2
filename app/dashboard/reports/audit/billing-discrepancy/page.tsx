import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { BillingDiscrepancyView } from "@/components/reports/audit/BillingDiscrepancyView"
import { format, subDays, parseISO } from "date-fns"

interface BillingDiscrepancyPageProps {
  searchParams: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function BillingDiscrepancyPage({ searchParams }: BillingDiscrepancyPageProps) {
  const params = await searchParams
  const today = new Date()
  const defaultStartDate = format(subDays(today, 90), "yyyy-MM-dd")
  const defaultEndDate = format(today, "yyyy-MM-dd")

  const startDate = params.startDate || defaultStartDate
  const endDate = params.endDate || defaultEndDate

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch delivered/completed loads
  const { data: deliveredLoads } = await supabase
    .from("loads")
    .select(`
      id,
      load_number,
      status,
      actual_delivery_date,
      customer_id,
      load_billing,
      rate,
      customers (
        id,
        name
      )
    `)
    .in("status", ["Delivered", "Completed"])
    .gte("actual_delivery_date", `${startDate}T00:00:00`)
    .lte("actual_delivery_date", `${endDate}T23:59:59`)

  // Fetch invoices
  const { data: invoices } = await supabase
    .from("ar_invoices")
    .select(`
      id,
      invoice_number,
      load_id,
      amount,
      billing_status,
      customer_id,
      customers (
        id,
        name
      ),
      loads (
        id,
        load_number,
        status
      )
    `)
    .gte("created_at", `${startDate}T00:00:00`)
    .lte("created_at", `${endDate}T23:59:59`)

  // Find unbilled loads (delivered but no invoice)
  const unbilledLoads = (deliveredLoads || []).filter((load: any) => {
    const hasInvoice = (invoices || []).some((inv: any) => inv.load_id === load.id)
    return !hasInvoice
  })

  const unbilledTableData = unbilledLoads.map((load: any) => ({
    loadId: load.id,
    loadNumber: load.load_number,
    customerName: load.customers?.name || "Unknown",
    deliveryDate: load.actual_delivery_date,
    estimatedRevenue: load.load_billing || load.rate || 0,
  }))

  // Find premature billings (invoiced but load not delivered/completed yet)
  // Note: This would be invoices where load status is NOT in ["Delivered", "Completed"]
  const { data: allLoads } = await supabase
    .from("loads")
    .select("id, status")

  const prematurfBillingTableData = (invoices || [])
    .filter((inv: any) => {
      const load = allLoads?.find((l: any) => l.id === inv.load_id)
      return load && !["Delivered", "Completed"].includes(load.status)
    })
    .map((inv: any) => ({
      invoiceId: inv.id,
      invoiceNumber: inv.invoice_number,
      customerName: inv.customers?.name || "Unknown",
      amount: inv.amount,
      loadStatus: inv.loads?.status || "Unknown",
    }))

  // Summary metrics
  const unbilledCount = unbilledTableData.length
  const prematureCount = prematurfBillingTableData.length
  const totalUnbilledRevenue = unbilledTableData.reduce((sum, row) => sum + row.estimatedRevenue, 0)

  return (
    <BillingDiscrepancyView
      startDate={startDate}
      endDate={endDate}
      unbilledLoads={unbilledCount}
      prematureBillings={prematureCount}
      totalUnbilledRevenue={totalUnbilledRevenue}
      unbilledTableData={unbilledTableData}
      prematurfBillingTableData={prematurfBillingTableData}
    />
  )
}
