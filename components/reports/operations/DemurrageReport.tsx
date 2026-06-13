"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const DAILY_DEMURRAGE_RATE = 150

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

interface Load {
  id: string
  reference_number: string
  status: string
  delivery_location: string | null
  created_at: string
  customer_id: string | null
  customers?: { id: string; name: string }
  containers?: { id: string; container_number: string; last_free_day: string | null; status: string }
}

export function DemurrageReport({ loads }: { loads: Load[] }) {
  const today = new Date()

  const overdueLoads = useMemo(() => {
    return loads
      .filter(l => l.containers?.last_free_day)
      .map(l => {
        const lfd = new Date(l.containers!.last_free_day!)
        const daysOver = Math.floor((today.getTime() - lfd.getTime()) / (1000 * 60 * 60 * 24))
        return { ...l, daysOver, estimatedCost: Math.max(0, daysOver) * DAILY_DEMURRAGE_RATE }
      })
      .filter(l => l.daysOver > 0)
      .sort((a, b) => b.daysOver - a.daysOver)
  }, [loads])

  const totalExposure = overdueLoads.reduce((s, l) => s + l.estimatedCost, 0)
  const avgDaysOver = overdueLoads.length > 0 ? overdueLoads.reduce((s, l) => s + l.daysOver, 0) / overdueLoads.length : 0

  // Group by days overdue buckets
  const bucketData = useMemo(() => {
    const buckets: Record<string, number> = { "1-3 days": 0, "4-7 days": 0, "8-14 days": 0, "15-30 days": 0, "30+ days": 0 }
    overdueLoads.forEach(l => {
      if (l.daysOver <= 3) buckets["1-3 days"] += 1
      else if (l.daysOver <= 7) buckets["4-7 days"] += 1
      else if (l.daysOver <= 14) buckets["8-14 days"] += 1
      else if (l.daysOver <= 30) buckets["15-30 days"] += 1
      else buckets["30+ days"] += 1
    })
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [overdueLoads])

  const bucketColors = ["#F59E0B", "#F97316", "#EF4444", "#DC2626", "#991B1B"]

  const handleExport = () => {
    const headers = ["Reference #", "Container #", "Customer", "Location", "Status", "LFD", "Days Over", "Est. Cost"]
    const rows = overdueLoads.map(l => [
      l.reference_number, l.containers?.container_number || "", l.customers?.name || "", l.delivery_location || "",
      l.status, l.containers?.last_free_day || "", l.daysOver.toString(), `$${l.estimatedCost.toFixed(2)}`
    ])
    downloadCSV(headers, rows, `demurrage-exposure.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Demurrage Exposure</h1>
          <p className="text-sm text-gray-400 mt-1">Containers past last free day — estimated at ${DAILY_DEMURRAGE_RATE}/day</p>
        </div>
        <ReportExportButton onClick={handleExport} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Containers at Risk" value={overdueLoads.length.toString()} bg="bg-red-900/20" />
        <KPICard title="Total Exposure" value={`$${totalExposure.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-red-900/20" />
        <KPICard title="Avg Days Over LFD" value={avgDaysOver.toFixed(1)} bg="bg-orange-900/20" />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Containers by Days Past LFD</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={bucketData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" name="Containers" radius={[4, 4, 0, 0]}>
              {bucketData.map((_, i) => <Cell key={i} fill={bucketColors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Reference #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Container #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">LFD</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Days Over</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Est. Cost</th>
            </tr>
          </thead>
          <tbody>
            {overdueLoads.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No containers past LFD</td></tr>
            ) : (
              overdueLoads.map((l, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm text-white font-medium">{l.reference_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 font-mono">{l.containers?.container_number || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{l.customers?.name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{l.status}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{l.containers?.last_free_day ? new Date(l.containers.last_free_day).toLocaleDateString() : "-"}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${l.daysOver > 7 ? "text-red-400" : "text-orange-400"}`}>{l.daysOver}</td>
                  <td className="px-4 py-3 text-sm text-right text-red-400 font-medium">${l.estimatedCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
