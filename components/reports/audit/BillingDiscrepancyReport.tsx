"use client"

import { useState, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
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
        <p key={i} className="text-sm text-white">{entry.name}: {entry.value}</p>
      ))}
    </div>
  )
}

interface Invoice {
  id: string
  invoice_number: string
  amount: number
  amount_paid: number
  billing_status: string
  customer_id: string | null
  created_at: string
  due_date: string | null
  customers?: { id: string; name: string }
}

type DiscrepancyType = "Overpayment" | "Partial Payment" | "Zero Amount" | "Overdue"

interface Discrepancy extends Invoice {
  type: DiscrepancyType
  variance: number
}

export function BillingDiscrepancyReport({ invoices }: { invoices: Invoice[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => invoices.filter(inv => {
    const d = inv.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [invoices, startDate, endDate])

  const discrepancies = useMemo(() => {
    const results: Discrepancy[] = []
    filtered.forEach(inv => {
      const paid = inv.amount_paid || 0
      const amount = inv.amount || 0

      // Overpayment
      if (paid > amount && amount > 0) {
        results.push({ ...inv, type: "Overpayment", variance: paid - amount })
      }
      // Partial payment on non-pending
      if (paid > 0 && paid < amount && inv.billing_status !== "Partial") {
        results.push({ ...inv, type: "Partial Payment", variance: amount - paid })
      }
      // Zero amount invoice
      if (amount === 0 && inv.billing_status !== "Draft" && inv.billing_status !== "Cancelled") {
        results.push({ ...inv, type: "Zero Amount", variance: 0 })
      }
      // Overdue
      if (inv.due_date && new Date(inv.due_date) < today && paid < amount && !["Paid", "Cancelled", "Write-off"].includes(inv.billing_status)) {
        results.push({ ...inv, type: "Overdue", variance: amount - paid })
      }
    })
    return results.sort((a, b) => b.variance - a.variance)
  }, [filtered])

  const byType = useMemo(() => {
    const map: Record<string, number> = {}
    discrepancies.forEach(d => {
      map[d.type] = (map[d.type] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [discrepancies])

  const typeColors: Record<string, string> = {
    "Overpayment": "#F59E0B",
    "Partial Payment": "#3B82F6",
    "Zero Amount": "#EF4444",
    "Overdue": "#F97316",
  }

  const totalVariance = discrepancies.reduce((s, d) => s + d.variance, 0)

  const handleExport = () => {
    const headers = ["Invoice #", "Customer", "Type", "Amount", "Paid", "Variance", "Status", "Date"]
    const rows = discrepancies.map(d => [
      d.invoice_number, d.customers?.name || "", d.type, d.amount.toFixed(2),
      d.amount_paid.toFixed(2), d.variance.toFixed(2), d.billing_status, d.created_at?.split("T")[0] || ""
    ])
    downloadCSV(headers, rows, `billing-discrepancies-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Billing Discrepancies</h1>
          <p className="text-sm text-gray-400 mt-1">Invoices with mismatched amounts, overpayments, or overdue status</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Discrepancies" value={discrepancies.length.toString()} bg="bg-red-900/20" />
        <KPICard title="Total Variance" value={`$${totalVariance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-orange-900/20" />
        <KPICard title="Invoices Reviewed" value={filtered.length.toString()} />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Discrepancies by Type</h3>
        {byType.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byType}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                {byType.map((entry) => <Cell key={entry.name} fill={typeColors[entry.name] || "#E8700A"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-green-400">No discrepancies found — all invoices are clean</div>
        )}
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Invoice #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Paid</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Variance</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {discrepancies.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-green-400">No discrepancies found</td></tr>
            ) : (
              discrepancies.slice(0, 50).map((d, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm text-white font-medium">{d.invoice_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{d.customers?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      d.type === "Overpayment" ? "bg-yellow-900/30 text-yellow-400" :
                      d.type === "Partial Payment" ? "bg-blue-900/30 text-blue-400" :
                      d.type === "Zero Amount" ? "bg-red-900/30 text-red-400" :
                      "bg-orange-900/30 text-orange-400"
                    }`}>{d.type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-right">${d.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 text-right">${d.amount_paid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-sm text-orange-400 text-right font-medium">${d.variance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{d.billing_status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
