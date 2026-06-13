"use client"

import { useMemo } from "react"
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { downloadCSV } from "@/lib/reports/csvExport"

interface AccessorialData {
  chargeType: string
  count: number
  totalAmount: number
  avgAmount: number
}

interface AccessorialAnalysisViewProps {
  accessorialData: AccessorialData[]
  totalRevenue: number
}

const COLORS = ["#E8700A", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"]

export function AccessorialAnalysisView({
  accessorialData,
  totalRevenue,
}: AccessorialAnalysisViewProps) {
  // Sort by total amount descending
  const sortedData = useMemo(() => {
    return [...accessorialData].sort((a, b) => b.totalAmount - a.totalAmount)
  }, [accessorialData])

  // Chart data - top 10 charge types
  const chartData = useMemo(() => {
    return sortedData.slice(0, 10).map(item => ({
      name: item.chargeType,
      value: item.totalAmount,
    }))
  }, [sortedData])

  const handleExport = () => {
    const headers = ["Charge Type", "Count", "Total Amount", "Avg Amount", "% of Total Revenue"]
    const rows: string[][] = sortedData.map(item => [
      item.chargeType,
      item.count.toString(),
      item.totalAmount.toString(),
      item.avgAmount.toFixed(2),
      totalRevenue > 0 ? ((item.totalAmount / totalRevenue) * 100).toFixed(2) : "0.00",
    ])
    downloadCSV(headers, rows, "accessorial-analysis.csv")
  }

  const totalAccessorial = sortedData.reduce((sum, item) => sum + item.totalAmount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Accessorial Analysis</h1>
          <p className="text-gray-400 mt-1">
            Breakdown of accessorial charges by type
          </p>
        </div>
        <ReportExportButton onClick={handleExport} label="Export CSV" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Accessorial Charges
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            ${totalAccessorial.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Charge Types
          </p>
          <p className="text-2xl font-bold text-white mt-1">{sortedData.length}</p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            % of Total Revenue
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            {totalRevenue > 0 ? ((totalAccessorial / totalRevenue) * 100).toFixed(2) : "0.00"}%
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Accessorial Charges by Type (Top 10)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => {
                const percentage = totalRevenue > 0 ? ((value / totalRevenue) * 100).toFixed(1) : "0"
                return `${percentage}%`
              }}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
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
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                  Charge Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Avg Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  % of Total Revenue
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, index) => (
                <tr key={`${item.chargeType}-${index}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-300">{item.chargeType}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">{item.count}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${item.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${item.avgAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    {totalRevenue > 0 ? ((item.totalAmount / totalRevenue) * 100).toFixed(2) : "0.00"}%
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
