"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2330] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.name === "Revenue" ? `$${Number(entry.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : entry.value}
        </p>
      ))}
    </div>
  )
}

interface Load { id: string; driver_id: string | null; status: string; created_at: string; drivers?: { id: string; name: string } }
interface Invoice { id: string; amount: number; load_id: string | null; created_at: string }

export function DriverUtilizationReport({ loads, invoices }: { loads: Load[]; invoices: Invoice[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filteredLoads = useMemo(() => loads.filter(l => {
    const d = l.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [loads, startDate, endDate])

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const d = inv.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [invoices, startDate, endDate])

  // Revenue by load_id
  const revenueByLoad = useMemo(() => {
    const map: Record<string, number> = {}
    filteredInvoices.forEach(inv => {
      if (inv.load_id) map[inv.load_id] = (map[inv.load_id] || 0) + (inv.amount || 0)
    })
    return map
  }, [filteredInvoices])

  const byDriver = useMemo(() => {
    const map: Record<string, { name: string; loads: number; revenue: number; completed: number }> = {}
    filteredLoads.forEach(l => {
      if (!l.driver_id) return
      const name = l.drivers?.name || "Unknown"
      if (!map[name]) map[name] = { name, loads: 0, revenue: 0, completed: 0 }
      map[name].loads += 1
      map[name].revenue += revenueByLoad[l.id] || 0
      if (l.status === "Completed") map[name].completed += 1
    })
    return Object.values(map).sort((a, b) => b.loads - a.loads)
  }, [filteredLoads, revenueByLoad])

  const totalLoads = byDriver.reduce((s, d) => s + d.loads, 0)
  const totalRevenue = byDriver.reduce((s, d) => s + d.revenue, 0)
  const avgLoadsPerDriver = byDriver.length > 0 ? totalLoads / byDriver.length : 0

  const chartData = byDriver.slice(0, 15).map(d => ({
    name: d.name.length > 15 ? d.name.substring(0, 15) + "…" : d.name,
    Loads: d.loads,
    Revenue: Number(d.revenue.toFixed(2)),
  }))

  const handleExport = () => {
    const headers = ["Driver", "Total Loads", "Completed", "Revenue", "Avg Revenue/Load"]
    const rows: string[][] = byDriver.map(d => [d.name, d.loads.toString(), d.completed.toString(), d.revenue.toFixed(2), d.loads > 0 ? (d.revenue / d.loads).toFixed(2) : "0.00"])
    downloadCSV(headers, rows, `driver-utilization-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Driver Utilization</h1>
          <p className="text-sm text-gray-400 mt-1">Loads and revenue per driver</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard title="Active Drivers" value={byDriver.length.toString()} />
        <KPICard title="Total Loads" value={totalLoads.toLocaleString()} />
        <KPICard title="Avg Loads/Driver" value={avgLoadsPerDriver.toFixed(1)} />
        <KPICard title="Total Revenue" value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-green-900/20" />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Loads & Revenue by Driver (Top 15)</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ left: 20, right: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#9CA3AF", fontSize: 11 } as any}
                angle={-45}
                textAnchor="end"
                interval={0}
                height={100}
              />
              <YAxis yAxisId="left" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="Loads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">No driver data</div>
        )}
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Driver</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Loads</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Completed</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Avg Rev/Load</th>
            </tr>
          </thead>
          <tbody>
            {byDriver.map((d, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white">{d.name}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{d.loads}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{d.completed}</td>
                <td className="px-4 py-3 text-sm text-green-400 text-right">${d.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">${d.loads > 0 ? (d.revenue / d.loads).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
