"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const COLORS = ["#E8700A", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2330] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color || "#fff" }}>
          {entry.name}: {typeof entry.value === "number" && entry.name?.toLowerCase().includes("charge")
            ? `$${entry.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : entry.value}
        </p>
      ))}
    </div>
  )
}

interface WaitingEvent {
  id: string
  load_id: string | null
  event_name: string
  event_date: string | null
  duration_minutes: number
  billable: boolean
  rate_per_hour: number | null
  charge_amount: number | null
  notes: string | null
  created_at: string
  loads?: { id: string; reference_number: string; customer_id: string | null; customers?: { id: string; name: string } }
}

export function WaitingTimeReport({ events }: { events: WaitingEvent[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => events.filter(e => {
    const d = (e.event_date || e.created_at)?.split("T")[0]
    return d && d >= startDate && d <= endDate
  }), [events, startDate, endDate])

  const totalMinutes = filtered.reduce((s, e) => s + (e.duration_minutes || 0), 0)
  const totalCharges = filtered.reduce((s, e) => s + (e.charge_amount || 0), 0)
  const billableEvents = filtered.filter(e => e.billable)
  const billableCharges = billableEvents.reduce((s, e) => s + (e.charge_amount || 0), 0)

  // By event type
  const byEventType = useMemo(() => {
    const map: Record<string, { name: string; count: number; minutes: number; charges: number }> = {}
    filtered.forEach(e => {
      const name = e.event_name || "Unknown"
      if (!map[name]) map[name] = { name, count: 0, minutes: 0, charges: 0 }
      map[name].count += 1
      map[name].minutes += e.duration_minutes || 0
      map[name].charges += e.charge_amount || 0
    })
    return Object.values(map).sort((a, b) => b.charges - a.charges)
  }, [filtered])

  // By customer
  const byCustomer = useMemo(() => {
    const map: Record<string, { name: string; count: number; minutes: number; charges: number }> = {}
    filtered.forEach(e => {
      const name = e.loads?.customers?.name || "Unknown"
      if (!map[name]) map[name] = { name, count: 0, minutes: 0, charges: 0 }
      map[name].count += 1
      map[name].minutes += e.duration_minutes || 0
      map[name].charges += e.charge_amount || 0
    })
    return Object.values(map).sort((a, b) => b.charges - a.charges).slice(0, 10)
  }, [filtered])

  const customerChartData = byCustomer.map(c => ({
    name: c.name.length > 18 ? c.name.substring(0, 18) + "…" : c.name,
    Charges: Number(c.charges.toFixed(2)),
    Events: c.count,
  }))

  const pieData = byEventType.map(e => ({ name: e.name, value: Number(e.charges.toFixed(2)) }))

  const handleExport = () => {
    const headers = ["Event", "Date", "Load #", "Customer", "Duration (min)", "Billable", "Charge"]
    const rows = filtered.map(e => [
      e.event_name, e.event_date || "", e.loads?.reference_number || "", e.loads?.customers?.name || "",
      (e.duration_minutes || 0).toString(), e.billable ? "Yes" : "No", (e.charge_amount || 0).toFixed(2)
    ])
    downloadCSV(headers, rows, `waiting-time-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Waiting Time Summary</h1>
          <p className="text-sm text-gray-400 mt-1">Waiting time charges by customer and event type</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard title="Total Events" value={filtered.length.toLocaleString()} />
        <KPICard title="Total Hours" value={`${(totalMinutes / 60).toFixed(1)} hrs`} />
        <KPICard title="Total Charges" value={`$${totalCharges.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-orange-900/20" />
        <KPICard title="Billable Charges" value={`$${billableCharges.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-green-900/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Event Type Pie */}
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Charges by Event Type</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={{ stroke: "#9CA3AF" }}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">No event data</div>
          )}
        </div>

        {/* By Customer Bar */}
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Charges by Customer (Top 10)</h3>
          {customerChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={customerChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 }} width={130} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Charges" fill="#E8700A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">No customer data</div>
          )}
        </div>
      </div>

      {/* Event Type Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Event Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Count</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total Hours</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total Charges</th>
            </tr>
          </thead>
          <tbody>
            {byEventType.map((e, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white">{e.name}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{e.count}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{(e.minutes / 60).toFixed(1)}</td>
                <td className="px-4 py-3 text-sm text-orange-400 text-right font-medium">${e.charges.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
