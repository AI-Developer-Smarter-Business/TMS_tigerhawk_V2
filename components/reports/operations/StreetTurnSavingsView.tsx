"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"
import { useRouter } from "next/navigation"
import { TrendingUp } from "lucide-react"

interface SavingsItem {
  loadId: string
  loadNumber: string
  type: string
  savingsAmount: number
  date: string
}

interface StreetTurnSavingsViewProps {
  startDate: string
  endDate: string
  streetTurnsCompleted: number
  savingsRealized: number
  potentialSavings: number
  chartData: Array<{ date: string; cumulativeSavings: number }>
  tableData: SavingsItem[]
}

export function StreetTurnSavingsView({
  startDate: initialStartDate,
  endDate: initialEndDate,
  streetTurnsCompleted,
  savingsRealized,
  potentialSavings,
  chartData,
  tableData,
}: StreetTurnSavingsViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    router.push(
      `/dashboard/reports/operations/savings?startDate=${newStart}&endDate=${newEnd}`
    )
  }

  const handleExport = () => {
    const headers = ["Load #", "Type", "Savings Amount", "Date"]
    const rows: string[][] = tableData.map((row) => [
      row.loadNumber,
      row.type,
      `$${row.savingsAmount.toFixed(2)}`,
      format(parseISO(row.date), "MMM dd, yyyy"),
    ])
    downloadCSV(headers, rows, "street-turn-savings.csv")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Street Turn & Dual Savings</h1>
        <p className="text-gray-400 text-sm">
          Measure savings from street turns and dual operations
        </p>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateRangeChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Street Turns Completed"
          value={streetTurnsCompleted.toString()}
          icon={<TrendingUp className="w-6 h-6 text-green-500" />}
        />
        <KPICard
          title="Savings Realized"
          value={`$${(savingsRealized / 1000).toFixed(1)}K`}
          subtitle={`$${savingsRealized.toFixed(0)} total`}
        />
        <KPICard
          title="Potential Savings"
          value={`$${(potentialSavings / 1000).toFixed(1)}K`}
          subtitle={`$${potentialSavings.toFixed(0)} if optimized`}
        />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Cumulative Savings Over Time</h2>
          <ReportExportButton onClick={handleExport} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
            />
            <YAxis stroke="#6B7280" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e2330",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value: any) => `$${value.toFixed(2)}`}
            />
            <Area
              type="monotone"
              dataKey="cumulativeSavings"
              stroke="#22C55E"
              fill="rgba(34,197,94,0.2)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Savings Details</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Load #
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Type
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Savings Amount
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-300">{row.loadNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.type}</td>
                <td className="px-4 py-3 text-sm text-green-400 font-semibold text-right">
                  ${row.savingsAmount.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {format(parseISO(row.date), "MMM dd, yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
