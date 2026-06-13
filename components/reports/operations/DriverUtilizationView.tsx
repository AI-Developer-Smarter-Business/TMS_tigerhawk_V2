"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"
import { useRouter } from "next/navigation"

interface DriverData {
  driverId: string
  driverName: string
  truckNumber: string
  loadCount: number
  totalRevenue: number
}

interface DriverUtilizationViewProps {
  startDate: string
  endDate: string
  totalActiveDrivers: number
  avgLoadsPerDriver: number
  totalRevenue: number
  chartData: DriverData[]
  tableData: DriverData[]
}

export function DriverUtilizationView({
  startDate: initialStartDate,
  endDate: initialEndDate,
  totalActiveDrivers,
  avgLoadsPerDriver,
  totalRevenue,
  chartData,
  tableData,
}: DriverUtilizationViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    router.push(
      `/dashboard/reports/operations/driver-utilization?startDate=${newStart}&endDate=${newEnd}`
    )
  }

  const handleExport = () => {
    const headers = ["Driver", "Truck #", "Load Count", "Total Revenue", "Revenue per Load"]
    const rows: string[][] = tableData.map((row) => [
      row.driverName,
      row.truckNumber,
      row.loadCount.toString(),
      `$${row.totalRevenue.toFixed(2)}`,
      row.loadCount > 0 ? `$${(row.totalRevenue / row.loadCount).toFixed(2)}` : "$0.00",
    ])
    downloadCSV(headers, rows, "driver-utilization.csv")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Driver Utilization</h1>
        <p className="text-gray-400 text-sm">
          Monitor driver productivity, load counts, and revenue generation
        </p>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateRangeChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Active Drivers" value={totalActiveDrivers.toString()} />
        <KPICard
          title="Average Loads per Driver"
          value={avgLoadsPerDriver.toFixed(1)}
          subtitle="loads"
        />
        <KPICard
          title="Total Revenue"
          value={`$${(totalRevenue / 1000).toFixed(1)}K`}
          subtitle={`$${totalRevenue.toFixed(0)}`}
        />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Loads per Driver (Top 15)</h2>
          <ReportExportButton onClick={handleExport} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData.map((d) => ({
              driver: d.driverName.split(" ")[0],
              loadCount: d.loadCount,
            }))}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="driver"
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
              formatter={(value: any) => `${value} loads`}
            />
            <Bar dataKey="loadCount" fill="#E8700A" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Driver Performance</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Driver
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Truck #
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Load Count
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Total Revenue
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Revenue per Load
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-300">{row.driverName}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.truckNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{row.loadCount}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">
                  ${row.totalRevenue.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right font-medium">
                  ${row.loadCount > 0 ? (row.totalRevenue / row.loadCount).toFixed(2) : "0.00"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
