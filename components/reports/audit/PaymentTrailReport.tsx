"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const METHOD_COLORS: Record<string, string> = {
  check: "#3B82F6",
  ach: "#10B981",
  wire: "#8B5CF6",
  credit_card: "#F59E0B",
  cash: "#E8700A",
  other: "#6B7280",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2330] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm" style={{ color: entry.color || "#fff" }}>
          {entry.name}: {typeof entry.value === "number" && entry.name !== "Count"
            ? `$${entry.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : entry.value}
        </p>
      ))}
    </div>
  )
}

interface Payment {
  id: string
  payment_number: string
  customer_id: string | null
  payment_date: string | null
  payment_method: string | null
  amount: number
  created_at: string
  customers?: { id: string; name: string }
}

interface Application {
  id: string
  payment_id: string
  invoice_id: string
  amount: number
  ar_invoices?: { id: string; invoice_number: string }
}

export function PaymentTrailReport({ payments, applications }: { payments: Payment[]; applications: Application[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => payments.filter(p => {
    const d = (p.payment_date || p.created_at)?.split("T")[0]
    return d && d >= startDate && d <= endDate
  }), [payments, startDate, endDate])

  // Application lookup by payment_id
  const appsByPayment = useMemo(() => {
    const map: Record<string, Application[]> = {}
    applications.forEach(a => {
      if (!map[a.payment_id]) map[a.payment_id] = []
      map[a.payment_id].push(a)
    })
    return map
  }, [applications])

  const totalPayments = filtered.reduce((s, p) => s + (p.amount || 0), 0)
  const totalApplied = useMemo(() => {
    return filtered.reduce((s, p) => {
      const apps = appsByPayment[p.id] || []
      return s + apps.reduce((sum, a) => sum + (a.amount || 0), 0)
    }, 0)
  }, [filtered, appsByPayment])
  const unapplied = totalPayments - totalApplied

  // By payment method
  const byMethod = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {}
    filtered.forEach(p => {
      const method = p.payment_method || "other"
      if (!map[method]) map[method] = { name: method, amount: 0, count: 0 }
      map[method].amount += p.amount || 0
      map[method].count += 1
    })
    return Object.values(map).sort((a, b) => b.amount - a.amount)
  }, [filtered])

  const methodPieData = byMethod.map(m => ({ name: m.name, value: Number(m.amount.toFixed(2)) }))

  // Monthly payment trend
  const monthlyTrend = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(p => {
      const d = new Date(p.payment_date || p.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleDateString("en-US", { year: "numeric", month: "short" })
      if (!map[label]) map[label] = 0
      map[label] += p.amount || 0
    })
    return Object.entries(map).map(([month, amount]) => ({ month, amount: Number(amount.toFixed(2)) }))
  }, [filtered])

  const handleExport = () => {
    const headers = ["Payment #", "Customer", "Date", "Method", "Amount", "Applied To"]
    const rows = filtered.map(p => {
      const apps = appsByPayment[p.id] || []
      const appliedTo = apps.map(a => `${a.ar_invoices?.invoice_number || a.invoice_id} ($${a.amount.toFixed(2)})`).join("; ")
      return [p.payment_number, p.customers?.name || "", p.payment_date || "", p.payment_method || "", p.amount.toFixed(2), appliedTo]
    })
    downloadCSV(headers, rows, `payment-trail-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Payment Trail</h1>
          <p className="text-sm text-gray-400 mt-1">Complete payment history with invoice applications</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard title="Total Payments" value={filtered.length.toString()} />
        <KPICard title="Amount Received" value={`$${totalPayments.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-green-900/20" />
        <KPICard title="Applied" value={`$${totalApplied.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-blue-900/20" />
        <KPICard title="Unapplied" value={`$${unapplied.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg={unapplied > 0 ? "bg-orange-900/20" : "bg-[#111827]"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Method Distribution */}
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">By Payment Method</h3>
          {methodPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={methodPieData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                  label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={{ stroke: "#9CA3AF" }}>
                  {methodPieData.map((entry) => <Cell key={entry.name} fill={METHOD_COLORS[entry.name] || "#E8700A"} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">No payment data</div>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Monthly Payment Volume</h3>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="Payments" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">No payment trend data</div>
          )}
        </div>
      </div>

      {/* Payment Detail Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Payment #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Method</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Applied To</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No payments found</td></tr>
            ) : (
              filtered.slice(0, 50).map((p, i) => {
                const apps = appsByPayment[p.id] || []
                return (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-white font-medium">{p.payment_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{p.customers?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{p.payment_date || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-300 capitalize">{p.payment_method || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-green-400 text-right font-medium">${p.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {apps.length > 0 ? apps.map((a, j) => (
                        <span key={j} className="inline-block mr-2 text-xs bg-white/5 px-2 py-0.5 rounded">{a.ar_invoices?.invoice_number || "INV"}: ${a.amount.toFixed(2)}</span>
                      )) : <span className="text-gray-500">Unapplied</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
