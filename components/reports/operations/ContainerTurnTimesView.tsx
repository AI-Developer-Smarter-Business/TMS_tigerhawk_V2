"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"
import { useRouter } from "next/navigation"

interface ContainerTurnTimesViewProps {
  startDate: string
  endDate: string
  totalContainers: number
  avgTurnDays: number
  minTurnDays: number
  maxTurnDays: number
  chartData: Array<{ customer: string; avgDays: number }>
  tableData: Array<{
    loadId: string
    loadNumber: string
    containerId: string
    containerNumber: string
    customerName: string
    pickupDate: string
    returnDate: string
    turnDays: number
  }>
}

export function ContainerTurnTimesView({
  startDate: initialStartDate,
  endDate: initialEndDate,
  totalContainers,
  avgTurnDays,
  minTurnDays,
  maxTurnDays,
  chartData,
  tableData,
}: ContainerTurnTimesViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    router.push(
      `/dashboard/reports/operations/turn-times?startDate=${newStart}&endDate=${newEnd}`
    )
  }

  const handleExport = () => {
    const headers = [
      "Load #",
      "Container #",
      "Customer",
      "Pickup Date",
      "Return Date",
      "Turn Days",
    ]
    const rows: string[][] = tableData.map((row) => [
      row.loadNumber,
      row.containerNumber,
      row.customerName,
      format(parseISO(row.pickupDate), "MMM dd, yyyy"),
      format(parseISO(row.returnDate), "MMM dd, yyyy"),
      row.turnDays.toString(),
    ])
    downloadCSV(headers, rows, "container-turn-times.csv")
  }

  const getTurnDayColor = (days: number) => {
    if (days <= 3) return "text-green-400"
    if (days <= 5) return "text-yellow-400"
    if (days <= 7) return "text-orange-400"
    return "text-red-400"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Container Turn Times</h1>
        <p className="text-gray-400 text-sm">
          Track average container turnaround time from pickup to return
        </p>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateRangeChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Containers" value={totalContainers.toLocaleString()} />
        <KPICard
          title="Average Turn Days"
          value={avgTurnDays.toFixed(1)}
          subtitle="days"
        />
        <KPICard title="Minimum Turn" value={minTurnDays.toString()} subtitle="days" />
        <KPICard title="Maximum Turn" value={maxTurnDays.toString()} subtitle="days" />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">
            Average Turn Time by Customer (Top 10)
          </h2>
          <ReportExportButton onClick={handleExport} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="customer"
              stroke="#6B7280"
              tick={{ fill: "#9CA3AF", fontSize: 12 } as any}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis stroke="#6B7280" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e2330",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value: any) => `${value.toFixed(1)} days`}
            />
            <Bar dataKey="avgDays" fill="#E8700A" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Container Details</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Load #
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Container #
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Customer
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Pickup Date
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Return Date
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Turn Days
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-300">{row.loadNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.containerNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.customerName}</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {format(parseISO(row.pickupDate), "MMM dd, yyyy")}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {format(parseISO(row.returnDate), "MMM dd, yyyy")}
                </td>
                <td className={`px-4 py-3 text-sm font-semibold text-right ${getTurnDayColor(row.turnDays)}`}>
                  {row.turnDays}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
