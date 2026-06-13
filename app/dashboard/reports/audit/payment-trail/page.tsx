import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PaymentTrailView } from "@/components/reports/audit/PaymentTrailView"
import { format, subDays } from "date-fns"

interface PaymentTrailPageProps {
  searchParams: Promise<{
    startDate?: string
    endDate?: string
  }>
}

export default async function PaymentTrailPage({ searchParams }: PaymentTrailPageProps) {
  const params = await searchParams
  const today = new Date()
  const defaultStartDate = format(subDays(today, 90), "yyyy-MM-dd")
  const defaultEndDate = format(today, "yyyy-MM-dd")

  const startDate = params.startDate || defaultStartDate
  const endDate = params.endDate || defaultEndDate

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Fetch payments with related invoices and customers
  const { data: payments } = await supabase
    .from("ar_payments")
    .select(`
      id,
      payment_date,
      amount_paid,
      customer_id,
      unapplied_balance,
      customers (
        id,
        name
      ),
      ar_payment_applications (
        id,
        invoice_id,
        amount_applied,
        ar_invoices (
          id,
          invoice_number
        )
      )
    `)
    .gte("payment_date", `${startDate}T00:00:00`)
    .lte("payment_date", `${endDate}T23:59:59`)
    .order("payment_date", { ascending: false })

  // Process payment trail data
  const tableData = (payments || []).flatMap((payment: any) => {
    const applications = payment.ar_payment_applications || []

    if (applications.length === 0) {
      // Show unapplied payment
      return [
        {
          paymentId: payment.id,
          paymentDate: payment.payment_date,
          customerName: payment.customers?.name || "Unknown",
          paymentAmount: payment.amount_paid,
          invoiceNumber: "Unapplied",
          appliedAmount: 0,
          balance: payment.unapplied_balance,
        },
      ]
    }

    // Show each application
    return applications.map((app: any) => ({
      paymentId: payment.id,
      paymentDate: payment.payment_date,
      customerName: payment.customers?.name || "Unknown",
      paymentAmount: payment.amount_paid,
      invoiceNumber: app.ar_invoices?.invoice_number || "N/A",
      appliedAmount: app.amount_applied,
      balance: payment.unapplied_balance,
    }))
  })

  // Summary metrics
  const totalPayments = (payments || []).length
  const totalAmountPaid = (payments || []).reduce((sum: number, p: any) => sum + p.amount_paid, 0)
  const totalApplied = tableData.reduce((sum, row) => sum + row.appliedAmount, 0)
  const unappliedBalance = tableData.reduce((sum, row) => sum + row.balance, 0)

  return (
    <PaymentTrailView
      startDate={startDate}
      endDate={endDate}
      totalPayments={totalPayments}
      totalAmountPaid={totalAmountPaid}
      totalApplied={totalApplied}
      unappliedBalance={unappliedBalance}
      tableData={tableData}
    />
  )
}
