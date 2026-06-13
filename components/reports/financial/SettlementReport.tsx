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
        <p key={i} className="text-sm" style={{ color: entry.color }}>{entry.name}: ${Number(entry.value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      ))}
    </div>
  )
}

interface Settlement {
  id: string
  settlement_number: string
  driver_id: string | null
  total_driver_pay: number
  total_deductions: number
  net_pay: number
  status: string
  period_start: string | null
  period_end: string | null
  created_at: string
  drivers?: { id: string; name: string }
}

export function SettlementReport({ settlements }: { settlements: Settlement[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => settlements.filter(s => {
    const d = s.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [settlements, startDate, endDate])

  const totals = useMemo(() => ({
    pay: filtered.reduce((s, r) => s + (r.total_driver_pay || 0), 0),
    deductions: filtered.reduce((s, r) => s + (r.total_deductions || 0), 0),
    net: filtered.reduce((s, r) => s + (r.net_pay || 0), 0),
  }), [filtered])

  const byDriver = useMemo(() => {
    const map: Record<string, { name: string; pay: number; deductions: number; net: number; count: number }> = {}
    filtered.forEach(s => {
      const name = s.drivers?.name || "Unknown"
      if (!map[name]) map[name] = { name, pay: 0, deductions: 0, net: 0, count: 0 }
      map[name].pay += s.total_driver_pay || 0
      map[name].deductions += s.total_deductions || 0
      map[name].net += s.net_pay || 0
      map[name].count += 1
    })
    return Object.values(map).sort((a, b) => b.pay - a.pay)
  }, [filtered])

  const chartData = byDriver.slice(0, 15).map(d => ({
    name: d.name.length > 15 ? d.name.substring(0, 15) + "…" : d.name,
    "Gross Pay": Number(d.pay.toFixed(2)),
    Deductions: Number(d.deductions.toFixed(2)),
  }))

  const handleExport = () => {
    const headers = ["Driver", "Settlements", "Gross Pay", "Deductions", "Net Pay"]
    const rows: string[][] = byDriver.map(d => [d.name, d.count.toString(), d.pay.toFixed(2), d.deductions.toFixed(2), d.net.toFixed(2)])
    downloadCSV(headers, rows, `settlement-summary-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Settlement Summary</h1>
          <p className="text-sm text-gray-400 mt-1">Driver settlement totals with deductions</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Gross Pay" value={`$${totals.pay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-blue-900/20" />
        <KPICard title="Total Deductions" value={`$${totals.deductions.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-red-900/20" />
        <KPICard title="Total Net Pay" value={`$${totals.net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-green-900/20" />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Gross Pay & Deductions by Driver</h3>
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
              <Bar dataKey="Gross Pay" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Deductions" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-gray-500">No settlement data</div>
        )}
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Driver</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Settlements</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Gross Pay</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Deductions</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {byDriver.map((d, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white">{d.name}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{d.count}</td>
                <td className="px-4 py-3 text-sm text-blue-400 text-right">${d.pay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-red-400 text-right">${d.deductions.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-green-400 text-right font-medium">${d.net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
