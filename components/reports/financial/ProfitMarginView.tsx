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
  Cell,
} from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { downloadCSV } from "@/lib/reports/csvExport"

interface ProfitData {
  loadId: string
  loadNumber: string
  customerName: string
  revenue: number
  driverPay: number
  margin: number
  marginPercent: number
}

interface ProfitMarginViewProps {
  startDate: string
  endDate: string
  profitData: ProfitData[]
  totals: {
    totalRevenue: number
    totalDriverPay: number
    totalMargin: number
    avgMarginPercent: number
  }
}

export function ProfitMarginView({
  startDate,
  endDate,
  profitData,
  totals,
}: ProfitMarginViewProps) {
  const router = useRouter()

  const handleDateRangeChange = (start: string, end: string) => {
    const newParams = new URLSearchParams()
    newParams.set("startDate", start)
    newParams.set("endDate", end)
    router.push(`?${newParams.toString()}`)
  }

  // Sort by margin ascending to show problem loads first
  const sortedData = useMemo(() => {
    return [...profitData].sort((a, b) => a.margin - b.margin)
  }, [profitData])

  // Chart data - top 20 loads for visualization
  const chartData = useMemo(() => {
    return sortedData.slice(0, 20).map(load => ({
      name: load.loadNumber,
      margin: load.margin,
      isPositive: load.margin >= 0,
    }))
  }, [sortedData])

  const handleExport = () => {
    const headers = ["Load #", "Customer", "Revenue", "Driver Pay", "Margin", "Margin %"]
    const rows: string[][] = sortedData.map(load => [
      load.loadNumber,
      load.customerName,
      load.revenue.toString(),
      load.driverPay.toString(),
      load.margin.toString(),
      load.marginPercent.toFixed(2),
    ])
    downloadCSV(headers, rows, `profit-margin-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Profit Margin per Load</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Revenue
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            ${totals.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Driver Pay
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            ${totals.totalDriverPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`bg-[#111827] border rounded-lg p-5 ${totals.totalMargin >= 0 ? "border-green-500/30" : "border-red-500/30"}`}>
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Margin
          </p>
          <p className={`text-2xl font-bold mt-1 ${totals.totalMargin >= 0 ? "text-green-500" : "text-red-500"}`}>
            ${totals.totalMargin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`bg-[#111827] border rounded-lg p-5 ${totals.avgMarginPercent >= 0 ? "border-green-500/30" : "border-red-500/30"}`}>
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Avg Margin %
          </p>
          <p className={`text-2xl font-bold mt-1 ${totals.avgMarginPercent >= 0 ? "text-green-500" : "text-red-500"}`}>
            {totals.avgMarginPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Margin by Load (sorted lowest to highest)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
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
            <Bar dataKey="margin" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isPositive ? "#10B981" : "#EF4444"}
                />
              ))}
            </Bar>
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
                  Load #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Revenue
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Driver Pay
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Margin
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Margin %
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((load) => (
                <tr
                  key={load.loadId}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                    load.margin < 0 ? "bg-red-950/10" : ""
                  }`}
                >
                  <td className="px-6 py-4 text-sm text-gray-300">{load.loadNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{load.customerName}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${load.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${load.driverPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-6 py-4 text-sm text-right font-semibold ${
                    load.margin >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    ${load.margin.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-6 py-4 text-sm text-right font-semibold ${
                    load.marginPercent >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {load.marginPercent.toFixed(2)}%
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
