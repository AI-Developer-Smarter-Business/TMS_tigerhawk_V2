"use client"

import { useState, useMemo } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const COST_PER_EMPTY_MOVE = 150

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

interface Load {
  id: string
  reference_number: string
  load_type: string | null
  status: string
  created_at: string
  customer_id: string | null
  customers?: { id: string; name: string }
  containers?: { id: string; container_number: string }
}

export function SavingsReport({ loads }: { loads: Load[] }) {
  const today = new Date()
  const ninetyAgo = new Date()
  ninetyAgo.setDate(ninetyAgo.getDate() - 90)
  const [startDate, setStartDate] = useState(ninetyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  const filtered = useMemo(() => loads.filter(l => {
    const d = l.created_at?.split("T")[0]
    return d >= startDate && d <= endDate
  }), [loads, startDate, endDate])

  // Count street turns and duals by checking load_type or reference patterns
  const streetTurns = useMemo(() => filtered.filter(l => l.load_type?.toLowerCase().includes("street") || l.load_type === "street_turn"), [filtered])
  const dualTransactions = useMemo(() => filtered.filter(l => l.load_type?.toLowerCase().includes("dual") || l.load_type === "dual"), [filtered])

  const streetTurnSavings = streetTurns.length * COST_PER_EMPTY_MOVE * 2 // Each street turn saves 2 empty moves
  const dualSavings = dualTransactions.length * COST_PER_EMPTY_MOVE // Each dual saves 1 empty trip
  const totalSavings = streetTurnSavings + dualSavings

  // Cumulative savings trend by day
  const trendData = useMemo(() => {
    const daily: Record<string, { streetTurn: number; dual: number }> = {}
    streetTurns.forEach(l => {
      const day = l.created_at?.split("T")[0]
      if (day) {
        if (!daily[day]) daily[day] = { streetTurn: 0, dual: 0 }
        daily[day].streetTurn += COST_PER_EMPTY_MOVE * 2
      }
    })
    dualTransactions.forEach(l => {
      const day = l.created_at?.split("T")[0]
      if (day) {
        if (!daily[day]) daily[day] = { streetTurn: 0, dual: 0 }
        daily[day].dual += COST_PER_EMPTY_MOVE
      }
    })

    let cumST = 0
    let cumDual = 0
    return Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => {
        cumST += vals.streetTurn
        cumDual += vals.dual
        return {
          date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          "Street Turn Savings": cumST,
          "Dual Savings": cumDual,
        }
      })
  }, [streetTurns, dualTransactions])

  const handleExport = () => {
    const headers = ["Metric", "Count", "Est. Savings"]
    const rows = [
      ["Street Turns", streetTurns.length.toString(), `$${streetTurnSavings.toFixed(2)}`],
      ["Dual Transactions", dualTransactions.length.toString(), `$${dualSavings.toFixed(2)}`],
      ["Total", (streetTurns.length + dualTransactions.length).toString(), `$${totalSavings.toFixed(2)}`],
    ]
    downloadCSV(headers, rows, `savings-report-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Street Turn & Dual Savings</h1>
          <p className="text-sm text-gray-400 mt-1">Estimated cost savings from optimized container movements</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard title="Street Turns" value={streetTurns.length.toString()} subtitle={`$${streetTurnSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} saved`} bg="bg-green-900/20" />
        <KPICard title="Dual Transactions" value={dualTransactions.length.toString()} subtitle={`$${dualSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} saved`} bg="bg-blue-900/20" />
        <KPICard title="Total Savings" value={`$${totalSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} bg="bg-green-900/20" />
        <KPICard title="Cost Per Empty Move" value={`$${COST_PER_EMPTY_MOVE}`} subtitle="Baseline rate" />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Cumulative Savings Over Time</h3>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={trendData} margin={{ left: 20, right: 20 }}>
              <defs>
                <linearGradient id="stGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Street Turn Savings" stroke="#10B981" fill="url(#stGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="Dual Savings" stroke="#3B82F6" fill="url(#dualGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">No savings data for this period</div>
        )}
      </div>
    </div>
  )
}
