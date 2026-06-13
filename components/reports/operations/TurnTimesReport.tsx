"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const COLORS = ["#E8700A", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316"]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2330] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm text-white">{entry.name}: {entry.value.toFixed(1)} days</p>
      ))}
    </div>
  )
}

interface Load {
  id: string
  reference_number: string
  status: string
  actual_pickup: string
  completed_date: string
  pickup_location: string | null
  delivery_location: string | null
  created_at: string
  customer_id: string | null
  customers?: { id: string; name: string }
}

export function TurnTimesReport({ loads }: { loads: Load[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => loads.filter(l => {
    const d = l.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [loads, startDate, endDate])

  const withTurnTime = useMemo(() => filtered.map(l => {
    const pickup = new Date(l.actual_pickup).getTime()
    const completed = new Date(l.completed_date).getTime()
    const turnDays = (completed - pickup) / (1000 * 60 * 60 * 24)
    return { ...l, turnDays: Math.max(0, turnDays) }
  }), [filtered])

  const avgTurnTime = useMemo(() => {
    if (withTurnTime.length === 0) return 0
    return withTurnTime.reduce((s, l) => s + l.turnDays, 0) / withTurnTime.length
  }, [withTurnTime])

  const minTurn = useMemo(() => withTurnTime.length > 0 ? Math.min(...withTurnTime.map(l => l.turnDays)) : 0, [withTurnTime])
  const maxTurn = useMemo(() => withTurnTime.length > 0 ? Math.max(...withTurnTime.map(l => l.turnDays)) : 0, [withTurnTime])

  // By delivery location
  const byLocation = useMemo(() => {
    const map: Record<string, { location: string; totalDays: number; count: number }> = {}
    withTurnTime.forEach(l => {
      const loc = l.delivery_location || "Unknown"
      if (!map[loc]) map[loc] = { location: loc, totalDays: 0, count: 0 }
      map[loc].totalDays += l.turnDays
      map[loc].count += 1
    })
    return Object.values(map)
      .map(loc => ({ ...loc, avgDays: loc.count > 0 ? loc.totalDays / loc.count : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
  }, [withTurnTime])

  const chartData = byLocation.map(loc => ({
    name: loc.location.length > 20 ? loc.location.substring(0, 20) + "…" : loc.location,
    "Avg Days": Number(loc.avgDays.toFixed(1)),
  }))

  const handleExport = () => {
    const headers = ["Location", "Loads", "Avg Turn Time (days)", "Total Days"]
    const rows = byLocation.map(loc => [loc.location, loc.count.toString(), loc.avgDays.toFixed(1), loc.totalDays.toFixed(1)])
    downloadCSV(headers, rows, `turn-times-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Container Turn Times</h1>
          <p className="text-sm text-gray-400 mt-1">Average days from pickup to completion by location</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard title="Completed Loads" value={withTurnTime.length.toLocaleString()} />
        <KPICard title="Avg Turn Time" value={`${avgTurnTime.toFixed(1)} days`} bg={avgTurnTime <= 3 ? "bg-green-900/20" : avgTurnTime <= 5 ? "bg-yellow-900/20" : "bg-red-900/20"} />
        <KPICard title="Fastest" value={`${minTurn.toFixed(1)} days`} bg="bg-green-900/20" />
        <KPICard title="Slowest" value={`${maxTurn.toFixed(1)} days`} bg="bg-red-900/20" />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Avg Turn Time by Delivery Location</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 12 }} unit=" days" />
              <YAxis type="category" dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 }} width={150} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Avg Days" name="Avg Turn Time" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">No turn time data</div>
        )}
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Location</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Loads</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Avg Days</th>
            </tr>
          </thead>
          <tbody>
            {byLocation.map((loc, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white">{loc.location}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{loc.count}</td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${loc.avgDays <= 3 ? "text-green-400" : loc.avgDays <= 5 ? "text-yellow-400" : "text-red-400"}`}>{loc.avgDays.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
