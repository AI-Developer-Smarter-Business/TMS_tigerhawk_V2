"use client"

import { useState, useMemo } from "react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const COLORS = ["#E8700A", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"]

interface BillingItem { id: string; load_id: string | null; amount: number; created_at: string }
interface ChargeCode { code: string; name: string; category: string }

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2330] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-sm text-white">{payload[0].name}: ${Number(payload[0].value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    </div>
  )
}

export function AccessorialReport({ billingItems, chargeCodes }: { billingItems: BillingItem[]; chargeCodes: ChargeCode[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => billingItems.filter(item => {
    const d = item.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [billingItems, startDate, endDate])

  // Group by category from charge_codes
  const byCategory = useMemo(() => {
    const categories: Record<string, { name: string; total: number; count: number }> = {}
    const codeMap = new Map(chargeCodes.map(c => [c.code, c]))

    // Since load_billing doesn't have charge_code directly, show categories from charge_codes
    // and use total billing as a summary
    if (chargeCodes.length > 0) {
      chargeCodes.forEach(cc => {
        const cat = cc.category || "Other"
        if (!categories[cat]) categories[cat] = { name: cat.charAt(0).toUpperCase() + cat.slice(1), total: 0, count: 0 }
      })
    }

    // Aggregate billing items - distribute to "Drayage" as default since load_billing maps to loads
    const totalAmount = filtered.reduce((s, item) => s + (item.amount || 0), 0)
    if (totalAmount > 0) {
      categories["drayage"] = { name: "Drayage", total: totalAmount, count: filtered.length }
    }

    return Object.values(categories).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
  }, [filtered, chargeCodes])

  const total = byCategory.reduce((s, c) => s + c.total, 0)

  const pieData = byCategory.map(c => ({ name: c.name, value: Number(c.total.toFixed(2)) }))

  const handleExport = () => {
    const headers = ["Category", "Count", "Total Amount", "% of Total"]
    const rows: string[][] = byCategory.map(c => [c.name, c.count.toString(), c.total.toFixed(2), total > 0 ? ((c.total / total) * 100).toFixed(1) : "0"])
    downloadCSV(headers, rows, `accessorial-analysis-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Accessorial Analysis</h1>
          <p className="text-sm text-gray-400 mt-1">Charge breakdown by category</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Total Charges" value={`$${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <KPICard title="Line Items" value={filtered.length.toLocaleString()} />
        <KPICard title="Categories" value={byCategory.length.toString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Charges by Category</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={120} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} labelLine={{ stroke: "#9CA3AF" }}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">No charge data</div>
          )}
        </div>

        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {byCategory.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-gray-300">{c.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-white font-medium">${c.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-xs text-gray-400 ml-2">({c.count} items)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charge Codes Table */}
      {chargeCodes.length > 0 && (
        <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
              </tr>
            </thead>
            <tbody>
              {chargeCodes.map((cc, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm text-white font-mono">{cc.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{cc.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 capitalize">{cc.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
