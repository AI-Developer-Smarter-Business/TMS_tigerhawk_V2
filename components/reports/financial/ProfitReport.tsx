"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts"
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
        <p key={i} className="text-sm" style={{ color: entry.color }}>{entry.name}: ${Number(entry.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      ))}
    </div>
  )
}

interface Invoice { id: string; amount: number; load_id: string | null; customer_id: string | null; created_at: string; customers?: { id: string; name: string } }
interface DriverPay { id: string; load_id: string | null; amount: number }

export function ProfitReport({ invoices, driverPay }: { invoices: Invoice[]; driverPay: DriverPay[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => invoices.filter(inv => {
    const d = inv.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [invoices, startDate, endDate])

  // Build driver pay lookup by load_id
  const payByLoad = useMemo(() => {
    const map: Record<string, number> = {}
    driverPay.forEach(dp => {
      if (dp.load_id) map[dp.load_id] = (map[dp.load_id] || 0) + (dp.amount || 0)
    })
    return map
  }, [driverPay])

  const profitData = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; cost: number; count: number }> = {}
    filtered.forEach(inv => {
      const name = inv.customers?.name || "Unknown"
      if (!map[name]) map[name] = { name, revenue: 0, cost: 0, count: 0 }
      map[name].revenue += inv.amount || 0
      map[name].cost += inv.load_id ? (payByLoad[inv.load_id] || 0) : 0
      map[name].count += 1
    })
    return Object.values(map)
      .map(c => ({ ...c, profit: c.revenue - c.cost, margin: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15)
  }, [filtered, payByLoad])

  const totals = useMemo(() => {
    const rev = profitData.reduce((s, c) => s + c.revenue, 0)
    const cost = profitData.reduce((s, c) => s + c.cost, 0)
    return { revenue: rev, cost, profit: rev - cost, margin: rev > 0 ? ((rev - cost) / rev) * 100 : 0 }
  }, [profitData])

  const chartData = profitData.map(c => ({
    name: c.name.length > 18 ? c.name.substring(0, 18) + "…" : c.name,
    Revenue: Number(c.revenue.toFixed(2)),
    "Driver Pay": Number(c.cost.toFixed(2)),
  }))

  const handleExport = () => {
    const headers = ["Customer", "Loads", "Revenue", "Driver Pay", "Profit", "Margin %"]
    const rows: string[][] = profitData.map(c => [c.name, c.count.toString(), c.revenue.toFixed(2), c.cost.toFixed(2), c.profit.toFixed(2), c.margin.toFixed(1)])
    downloadCSV(headers, rows, `profit-margin-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Profit Margin Report</h1>
          <p className="text-sm text-gray-400 mt-1">Revenue vs driver pay per customer</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard title="Total Revenue" value={`$${totals.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-green-900/20" />
        <KPICard title="Total Driver Pay" value={`$${totals.cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-blue-900/20" />
        <KPICard title="Gross Profit" value={`$${totals.profit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg={totals.profit >= 0 ? "bg-green-900/20" : "bg-red-900/20"} />
        <KPICard title="Margin %" value={`${totals.margin.toFixed(1)}%`} bg={totals.margin >= 20 ? "bg-green-900/20" : totals.margin >= 10 ? "bg-yellow-900/20" : "bg-red-900/20"} />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Revenue vs Driver Pay by Customer</h3>
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
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 12 }} />
              <Bar dataKey="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Driver Pay" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">No profit data</div>
        )}
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Customer</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Loads</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Driver Pay</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Profit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Margin</th>
            </tr>
          </thead>
          <tbody>
            {profitData.map((c, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white">{c.name}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{c.count}</td>
                <td className="px-4 py-3 text-sm text-green-400 text-right">${c.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-blue-400 text-right">${c.cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${c.profit >= 0 ? "text-green-400" : "text-red-400"}`}>${c.profit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={`px-4 py-3 text-sm text-right ${c.margin >= 20 ? "text-green-400" : c.margin >= 10 ? "text-yellow-400" : "text-red-400"}`}>{c.margin.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
