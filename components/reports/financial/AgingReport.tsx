"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const BUCKET_COLORS: Record<string, string> = {
  "Current": "#10B981",
  "1-30": "#3B82F6",
  "31-60": "#F59E0B",
  "61-90": "#F97316",
  "90+": "#EF4444",
}

interface Invoice {
  id: string
  invoice_number: string
  amount: number
  amount_paid: number
  billing_status: string
  due_date: string | null
  created_at: string
  customer_id: string | null
  customers?: { id: string; name: string }
}

function getAgingBucket(dueDate: string | null): string {
  if (!dueDate) return "Current"
  const today = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "Current"
  if (diffDays <= 30) return "1-30"
  if (diffDays <= 60) return "31-60"
  if (diffDays <= 90) return "61-90"
  return "90+"
}

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

export function AgingReport({ invoices }: { invoices: Invoice[] }) {
  const agingData = useMemo(() => {
    const buckets: Record<string, number> = { "Current": 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }
    invoices.forEach(inv => {
      const outstanding = (inv.amount || 0) - (inv.amount_paid || 0)
      if (outstanding > 0) {
        const bucket = getAgingBucket(inv.due_date)
        buckets[bucket] += outstanding
      }
    })
    return Object.entries(buckets).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
  }, [invoices])

  const totalOutstanding = agingData.reduce((s, b) => s + b.value, 0)
  const overdue = agingData.filter(b => b.name !== "Current").reduce((s, b) => s + b.value, 0)

  // By customer aging
  const customerAging = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    invoices.forEach(inv => {
      const name = inv.customers?.name || "Unknown"
      const outstanding = (inv.amount || 0) - (inv.amount_paid || 0)
      if (outstanding <= 0) return
      if (!map[name]) map[name] = { "Current": 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }
      map[name][getAgingBucket(inv.due_date)] += outstanding
    })
    return Object.entries(map)
      .map(([name, buckets]) => ({
        name: name.length > 25 ? name.substring(0, 25) + "…" : name,
        fullName: name,
        ...buckets,
        total: Object.values(buckets).reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
  }, [invoices])

  const handleExport = () => {
    const headers = ["Customer", "Current", "1-30 Days", "31-60 Days", "61-90 Days", "90+ Days", "Total"]
    const rows: string[][] = customerAging.map(c => [
      c.fullName, (c as any)["Current"].toFixed(2), (c as any)["1-30"].toFixed(2), (c as any)["31-60"].toFixed(2), (c as any)["61-90"].toFixed(2), (c as any)["90+"].toFixed(2), c.total.toFixed(2)
    ])
    downloadCSV(headers, rows, `ar-aging-report.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">A/R Aging Report</h1>
          <p className="text-sm text-gray-400 mt-1">Outstanding receivables by aging bucket</p>
        </div>
        <ReportExportButton onClick={handleExport} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Outstanding" value={`$${totalOutstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <KPICard title="Total Overdue" value={`$${overdue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-red-900/20" />
        <KPICard title="Open Invoices" value={invoices.length.toString()} />
      </div>

      {/* Aging Buckets Chart */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Outstanding by Aging Bucket</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={agingData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Outstanding" radius={[4, 4, 0, 0]}>
              {agingData.map((entry) => (
                <Cell key={entry.name} fill={BUCKET_COLORS[entry.name] || "#E8700A"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked by Customer */}
      {customerAging.length > 0 && (
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Aging by Customer (Top 15)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={customerAging} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 }} width={150} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 12 }} />
              <Bar dataKey="Current" stackId="a" fill="#10B981" />
              <Bar dataKey="1-30" stackId="a" fill="#3B82F6" />
              <Bar dataKey="31-60" stackId="a" fill="#F59E0B" />
              <Bar dataKey="61-90" stackId="a" fill="#F97316" />
              <Bar dataKey="90+" stackId="a" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Customer</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-green-400 uppercase">Current</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-blue-400 uppercase">1-30</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-yellow-400 uppercase">31-60</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-orange-400 uppercase">61-90</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-red-400 uppercase">90+</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {customerAging.map((c, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white">{c.fullName}</td>
                <td className="px-4 py-3 text-sm text-right text-green-400">${(c as any)["Current"].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-right text-blue-400">${(c as any)["1-30"].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-right text-yellow-400">${(c as any)["31-60"].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-right text-orange-400">${(c as any)["61-90"].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-right text-red-400">${(c as any)["90+"].toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-sm text-right text-white font-medium">${c.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
