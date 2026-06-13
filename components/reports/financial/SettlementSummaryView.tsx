"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { downloadCSV } from "@/lib/reports/csvExport"

interface SettlementData {
  settlementId: string
  driverId: string
  driverName: string
  periodStart: string
  periodEnd: string
  grossPay: number
  deductions: number
  netPay: number
  status: string
}

interface SettlementSummaryViewProps {
  startDate: string
  endDate: string
  settlementData: SettlementData[]
  totals: {
    totalGrossPay: number
    totalDeductions: number
    totalNetPay: number
  }
}

export function SettlementSummaryView({
  startDate,
  endDate,
  settlementData,
  totals,
}: SettlementSummaryViewProps) {
  const router = useRouter()

  const handleDateRangeChange = (start: string, end: string) => {
    const newParams = new URLSearchParams()
    newParams.set("startDate", start)
    newParams.set("endDate", end)
    router.push(`?${newParams.toString()}`)
  }

  // Chart data - top 15 drivers
  const chartData = useMemo(() => {
    return settlementData.slice(0, 15).map(settlement => ({
      name: settlement.driverName,
      pay: settlement.grossPay,
      deductions: settlement.deductions,
      net: settlement.netPay,
    }))
  }, [settlementData])

  const handleExport = () => {
    const headers = ["Driver", "Period", "Gross Pay", "Deductions", "Net Pay", "Status"]
    const rows: string[][] = settlementData.map(settlement => [
      settlement.driverName,
      `${settlement.periodStart} to ${settlement.periodEnd}`,
      settlement.grossPay.toString(),
      settlement.deductions.toString(),
      settlement.netPay.toString(),
      settlement.status,
    ])
    downloadCSV(headers, rows, `settlement-summary-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settlement Summary</h1>
          <p className="text-gray-400 mt-1">
            {startDate} to {endDate}
          </p>
        </div>
        <ReportExportButton onClick={handleExport} label="Export CSV" />
      </div>

      {/* Date Range Selector */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateRangeChange}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Gross Pay
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            ${totals.totalGrossPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5 border-red-500/30">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Deductions
          </p>
          <p className="text-2xl font-bold text-red-500 mt-1">
            ${totals.totalDeductions.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5 border-green-500/30">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Net Pay
          </p>
          <p className="text-2xl font-bold text-green-500 mt-1">
            ${totals.totalNetPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Net Pay by Driver</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              stroke="#6B7280"
              tick={{ fill: "#9CA3AF", fontSize: 12 } as any}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis stroke="#6B7280" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e2330",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value) => `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Legend />
            <Bar dataKey="pay" fill="#10B981" />
            <Bar dataKey="deductions" fill="#EF4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                  Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Gross Pay
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Deductions
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Net Pay
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {settlementData.map((settlement) => (
                <tr key={settlement.settlementId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-300">{settlement.driverName}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {settlement.periodStart} - {settlement.periodEnd}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${settlement.grossPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-500 text-right">
                    ${settlement.deductions.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-green-500 text-right">
                    ${settlement.netPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      settlement.status === "Paid"
                        ? "bg-green-500/20 text-green-500"
                        : settlement.status === "Pending"
                        ? "bg-yellow-500/20 text-yellow-500"
                        : "bg-gray-500/20 text-gray-500"
                    }`}>
                      {settlement.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
