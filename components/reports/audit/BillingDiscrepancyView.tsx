"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"

interface UnbilledItem {
  loadId: string
  loadNumber: string
  customerName: string
  deliveryDate: string
  estimatedRevenue: number
}

interface PrematureBillingItem {
  invoiceId: string
  invoiceNumber: string
  customerName: string
  amount: number
  loadStatus: string
}

interface BillingDiscrepancyViewProps {
  startDate: string
  endDate: string
  unbilledLoads: number
  prematureBillings: number
  totalUnbilledRevenue: number
  unbilledTableData: UnbilledItem[]
  prematurfBillingTableData: PrematureBillingItem[]
}

export function BillingDiscrepancyView({
  startDate: initialStartDate,
  endDate: initialEndDate,
  unbilledLoads,
  prematureBillings,
  totalUnbilledRevenue,
  unbilledTableData,
  prematurfBillingTableData,
}: BillingDiscrepancyViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    router.push(
      `/dashboard/reports/audit/billing-discrepancy?startDate=${newStart}&endDate=${newEnd}`
    )
  }

  const handleExportUnbilled = () => {
    const headers = ["Load #", "Customer", "Delivery Date", "Est. Revenue"]
    const rows = unbilledTableData.map((row) => [
      row.loadNumber,
      row.customerName,
      format(parseISO(row.deliveryDate), "MMM dd, yyyy"),
      `$${row.estimatedRevenue.toFixed(2)}`,
    ])
    downloadCSV(headers, rows, "unbilled-loads.csv")
  }

  const handleExportPremature = () => {
    const headers = ["Invoice #", "Customer", "Amount", "Load Status"]
    const rows = prematurfBillingTableData.map((row) => [
      row.invoiceNumber,
      row.customerName,
      `$${row.amount.toFixed(2)}`,
      row.loadStatus,
    ])
    downloadCSV(headers, rows, "premature-billings.csv")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Billing Discrepancies</h1>
        <p className="text-gray-400 text-sm">
          Identify unbilled deliveries and premature billings
        </p>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateRangeChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Unbilled Loads"
          value={unbilledLoads.toString()}
          icon={<AlertCircle className="w-6 h-6 text-red-500" />}
        />
        <KPICard title="Premature Billings" value={prematureBillings.toString()} />
        <KPICard
          title="Total Unbilled Revenue"
          value={`$${(totalUnbilledRevenue / 1000).toFixed(1)}K`}
          subtitle={`$${totalUnbilledRevenue.toFixed(0)}`}
        />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Delivered but Not Billed</h2>
          <ReportExportButton onClick={handleExportUnbilled} label="Export CSV" />
        </div>
        {unbilledTableData.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                  Load #
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                  Customer
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                  Delivery Date
                </th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                  Est. Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {unbilledTableData.map((row, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-300">{row.loadNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{row.customerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {format(parseISO(row.deliveryDate), "MMM dd, yyyy")}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 text-right font-medium">
                    ${row.estimatedRevenue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-sm py-4">No unbilled loads found</p>
        )}
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Billed but Not Delivered</h2>
          <ReportExportButton onClick={handleExportPremature} label="Export CSV" />
        </div>
        {prematurfBillingTableData.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                  Invoice #
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                  Customer
                </th>
                <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                  Load Status
                </th>
              </tr>
            </thead>
            <tbody>
              {prematurfBillingTableData.map((row, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-300">{row.invoiceNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{row.customerName}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 text-right font-medium">
                    ${row.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-yellow-400">{row.loadStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-sm py-4">No premature billings found</p>
        )}
      </div>
    </div>
  )
}
