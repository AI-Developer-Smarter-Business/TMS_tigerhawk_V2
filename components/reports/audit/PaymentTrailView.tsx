"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"
import { useRouter } from "next/navigation"
import { DollarSign } from "lucide-react"

interface PaymentRow {
  paymentId: string
  paymentDate: string
  customerName: string
  paymentAmount: number
  invoiceNumber: string
  appliedAmount: number
  balance: number
}

interface PaymentTrailViewProps {
  startDate: string
  endDate: string
  totalPayments: number
  totalAmountPaid: number
  totalApplied: number
  unappliedBalance: number
  tableData: PaymentRow[]
}

export function PaymentTrailView({
  startDate: initialStartDate,
  endDate: initialEndDate,
  totalPayments,
  totalAmountPaid,
  totalApplied,
  unappliedBalance,
  tableData,
}: PaymentTrailViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    router.push(
      `/dashboard/reports/audit/payment-trail?startDate=${newStart}&endDate=${newEnd}`
    )
  }

  const handleExport = () => {
    const headers = [
      "Payment Date",
      "Customer",
      "Payment Amount",
      "Invoice #",
      "Applied Amount",
      "Balance",
    ]
    const rows = tableData.map((row) => [
      format(parseISO(row.paymentDate), "MMM dd, yyyy"),
      row.customerName,
      `$${row.paymentAmount.toFixed(2)}`,
      row.invoiceNumber,
      `$${row.appliedAmount.toFixed(2)}`,
      `$${row.balance.toFixed(2)}`,
    ])
    downloadCSV(headers, rows, "payment-trail.csv")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Payment Application Trail</h1>
        <p className="text-gray-400 text-sm">
          Track payment application and account receivable activity
        </p>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateRangeChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Payments"
          value={totalPayments.toString()}
          icon={<DollarSign className="w-6 h-6 text-green-500" />}
        />
        <KPICard
          title="Total Paid"
          value={`$${(totalAmountPaid / 1000).toFixed(1)}K`}
          subtitle={`$${totalAmountPaid.toFixed(0)}`}
        />
        <KPICard
          title="Total Applied"
          value={`$${(totalApplied / 1000).toFixed(1)}K`}
          subtitle={`$${totalApplied.toFixed(0)}`}
        />
        <KPICard
          title="Unapplied Balance"
          value={`$${(unappliedBalance / 1000).toFixed(1)}K`}
          subtitle={`$${unappliedBalance.toFixed(0)}`}
        />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Payment Applications</h2>
          <ReportExportButton onClick={handleExport} />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Payment Date
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Customer
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Payment Amount
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Invoice #
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Applied Amount
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-400">
                  {format(parseISO(row.paymentDate), "MMM dd, yyyy")}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.customerName}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right font-medium">
                  ${row.paymentAmount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {row.invoiceNumber === "Unapplied" ? (
                    <span className="text-gray-500 italic">Unapplied</span>
                  ) : (
                    row.invoiceNumber
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">
                  ${row.appliedAmount.toFixed(2)}
                </td>
                <td
                  className={`px-4 py-3 text-sm font-medium text-right ${
                    row.balance > 0 ? "text-orange-400" : "text-green-400"
                  }`}
                >
                  ${row.balance.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
