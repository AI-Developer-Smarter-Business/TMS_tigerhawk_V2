"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"
import { useRouter } from "next/navigation"
import { Clock } from "lucide-react"

interface WaitingTimeEvent {
  id: string
  loadId: string
  loadNumber: string
  eventType: string
  customerName: string
  location: string
  duration: number
  isBillable: boolean
  billableAmount: number
  date: string
}

interface WaitingTimeSummaryViewProps {
  startDate: string
  endDate: string
  totalEvents: number
  totalWaitHours: number
  avgWaitPerEvent: number
  billableAmount: number
  chartData: Array<{ type: string; hours: number }>
  tableData: WaitingTimeEvent[]
}

export function WaitingTimeSummaryView({
  startDate: initialStartDate,
  endDate: initialEndDate,
  totalEvents,
  totalWaitHours,
  avgWaitPerEvent,
  billableAmount,
  chartData,
  tableData,
}: WaitingTimeSummaryViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    router.push(
      `/dashboard/reports/audit/waiting-time?startDate=${newStart}&endDate=${newEnd}`
    )
  }

  const handleExport = () => {
    const headers = [
      "Load #",
      "Event Type",
      "Customer",
      "Location",
      "Duration (hours)",
      "Billable",
      "Billable Amount",
      "Date",
    ]
    const rows = tableData.map((row) => [
      row.loadNumber,
      row.eventType,
      row.customerName,
      row.location,
      row.duration.toString(),
      row.isBillable ? "Yes" : "No",
      `$${row.billableAmount.toFixed(2)}`,
      format(parseISO(row.date), "MMM dd, yyyy"),
    ])
    downloadCSV(headers, rows, "waiting-time-summary.csv")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Waiting Time Summary</h1>
        <p className="text-gray-400 text-sm">
          Track waiting time events and billable hours at facilities
        </p>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateRangeChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Events"
          value={totalEvents.toString()}
          icon={<Clock className="w-6 h-6 text-blue-500" />}
        />
        <KPICard title="Total Wait Hours" value={totalWaitHours.toString()} subtitle="hours" />
        <KPICard
          title="Avg Wait per Event"
          value={avgWaitPerEvent.toFixed(1)}
          subtitle="hours"
        />
        <KPICard
          title="Billable Amount"
          value={`$${(billableAmount / 1000).toFixed(1)}K`}
          subtitle={`$${billableAmount.toFixed(0)}`}
        />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Waiting Hours by Event Type</h2>
          <ReportExportButton onClick={handleExport} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="type"
              stroke="#6B7280"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
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
              formatter={(value: any) => `${value.toFixed(1)} hours`}
            />
            <Bar dataKey="hours" fill="#E8700A" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Waiting Events</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Load #
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Event
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Customer
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Location
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Duration
              </th>
              <th className="text-center px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Billable
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Amount
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
                <td className="px-4 py-3 text-sm text-gray-300">{row.eventType}</td>
                <td className="px-4 py-3 text-sm text-gray-300">{row.customerName}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{row.location}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{row.duration}h</td>
                <td className="px-4 py-3 text-sm text-center">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      row.isBillable
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {row.isBillable ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">
                  ${row.billableAmount.toFixed(2)}
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
