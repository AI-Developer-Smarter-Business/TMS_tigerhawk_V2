"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"

interface DemurrageItem {
  containerId: string
  containerNumber: string
  loadId: string
  loadNumber: string
  customerName: string
  lastFreeDay: string
  daysOver: number
  estimatedCost: number
  status: string
}

interface DemurrageExposureViewProps {
  startDate: string
  endDate: string
  totalAtRisk: number
  totalDaysOver: number
  estimatedExposure: number
  chartData: Array<{ range: string; count: number }>
  tableData: DemurrageItem[]
}

export function DemurrageExposureView({
  startDate: initialStartDate,
  endDate: initialEndDate,
  totalAtRisk,
  totalDaysOver,
  estimatedExposure,
  chartData,
  tableData,
}: DemurrageExposureViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    router.push(
      `/dashboard/reports/operations/demurrage?startDate=${newStart}&endDate=${newEnd}`
    )
  }

  const handleExport = () => {
    const headers = [
      "Container #",
      "Load #",
      "Customer",
      "Last Free Day",
      "Days Over",
      "Est. Cost",
      "Status",
    ]
    const rows: string[][] = tableData.map((row) => [
      row.containerNumber,
      row.loadNumber,
      row.customerName,
      format(parseISO(row.lastFreeDay), "MMM dd, yyyy"),
      row.daysOver.toString(),
      `$${row.estimatedCost.toFixed(2)}`,
      row.status,
    ])
    downloadCSV(headers, rows, "demurrage-exposure.csv")
  }

  const getDaysOverColor = (days: number) => {
    if (days <= 3) return "text-yellow-400"
    if (days <= 7) return "text-orange-400"
    return "text-red-400"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Demurrage & Per Diem Exposure</h1>
        <p className="text-gray-400 text-sm">
          Identify containers at risk and quantify exposure costs
        </p>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateRangeChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total At Risk"
          value={totalAtRisk.toString()}
          subtitle="containers"
          icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
        />
        <KPICard title="Total Days Over" value={totalDaysOver.toString()} subtitle="days" />
        <KPICard
          title="Estimated Exposure"
          value={`$${(estimatedExposure / 1000).toFixed(1)}K`}
          subtitle={`$${estimatedExposure.toFixed(0)} @ $150/day`}
        />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">
            Containers by Days Over LFD
          </h2>
          <ReportExportButton onClick={handleExport} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="range"
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
              formatter={(value: any) => `${value} containers`}
            />
            <Bar dataKey="count" fill="#EF4444" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white mb-4">At-Risk Containers</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Container #
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Load #
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Customer
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Last Free Day
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Days Over
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Est. Cost
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-300">{row.containerNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.loadNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.customerName}</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {format(parseISO(row.lastFreeDay), "MMM dd, yyyy")}
                </td>
                <td className={`px-4 py-3 text-sm font-semibold text-right ${getDaysOverColor(row.daysOver)}`}>
                  {row.daysOver}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">
                  ${row.estimatedCost.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
