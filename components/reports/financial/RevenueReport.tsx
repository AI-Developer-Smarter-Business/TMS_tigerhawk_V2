"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const COLORS = ["#E8700A", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#14B8A6", "#A855F7", "#F43F5E", "#0EA5E9", "#22C55E"]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2330] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm text-white">{entry.name}: ${Number(entry.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      ))}
    </div>
  )
}

interface Invoice {
  id: string
  amount: number
  amount_paid: number
  billing_status: string
  customer_id: string | null
  created_at: string
  customers?: { id: string; name: string }
}

export function RevenueReport({ invoices }: { invoices: Invoice[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => invoices.filter(inv => {
    const d = inv.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [invoices, startDate, endDate])

  const totalRevenue = useMemo(() => filtered.reduce((s, inv) => s + (inv.amount || 0), 0), [filtered])
  const totalCollected = useMemo(() => filtered.reduce((s, inv) => s + (inv.amount_paid || 0), 0), [filtered])

  const byCustomer = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; collected: number; count: number }> = {}
    filtered.forEach(inv => {
      const name = inv.customers?.name || "Unknown"
      if (!map[name]) map[name] = { name, revenue: 0, collected: 0, count: 0 }
      map[name].revenue += inv.amount || 0
      map[name].collected += inv.amount_paid || 0
      map[name].count += 1
    })
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 15)
  }, [filtered])

  const chartData = byCustomer.map(c => ({
    name: c.name.length > 18 ? c.name.substring(0, 18) + "…" : c.name,
    revenue: Number(c.revenue.toFixed(2))
  }))

  const handleExport = () => {
    const headers = ["Customer", "Invoices", "Revenue", "Collected", "Outstanding"]
    const rows: string[][] = byCustomer.map(c => [c.name, c.count.toString(), c.revenue.toFixed(2), c.collected.toFixed(2), (c.revenue - c.collected).toFixed(2)])
    downloadCSV(headers, rows, `revenue-by-customer-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Revenue by Customer</h1>
          <p className="text-sm text-gray-400 mt-1">Customer revenue breakdown and collection rates</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Revenue" value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-green-900/20" />
        <KPICard title="Total Collected" value={`$${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-blue-900/20" />
        <KPICard title="Outstanding" value={`$${(totalRevenue - totalCollected).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-orange-900/20" />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Revenue by Customer (Top 15)</h3>
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
              <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">No revenue data</div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Invoices</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Collected</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Outstanding</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Collection %</th>
            </tr>
          </thead>
          <tbody>
            {byCustomer.map((c, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white">{c.name}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{c.count}</td>
                <td className="px-4 py-3 text-sm text-white text-right font-medium">${c.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-green-400 text-right">${c.collected.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-orange-400 text-right">${(c.revenue - c.collected).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{c.revenue > 0 ? Math.round((c.collected / c.revenue) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
