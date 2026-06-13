"use client"

import { useState, useMemo } from "react"
import { Package, Clock, TrendingUp, DollarSign, AlertCircle } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell
} from "recharts"
import { KPICard } from "@/components/reports/KPICard"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { downloadCSV } from "@/lib/reports/csvExport"

interface Load {
  id: string
  status: string
  created_at: string
  actual_pickup: string | null
  completed_date: string | null
  delivery_apt_to: string | null
  customer_id: string | null
  driver_id: string | null
  pickup_location: string | null
  delivery_location: string | null
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

interface OpenInvoice {
  id: string
  amount: number
  amount_paid: number
  billing_status: string
}

interface Customer {
  id: string
  name: string
}

const CHART_COLORS = ["#E8700A", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316"]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2330] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm text-white">
          {entry.name}: {typeof entry.value === "number" && entry.name?.toLowerCase().includes("revenue")
            ? `$${entry.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

interface OverviewDashboardProps {
  loads: Load[]
  invoices: Invoice[]
  openInvoices: OpenInvoice[]
  customers: Customer[]
  error: string | null
}

export function OverviewDashboard({ loads, invoices, openInvoices, customers, error }: OverviewDashboardProps) {
  const today = new Date()
  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const [startDate, setStartDate] = useState(thirtyAgo.toISOString().split("T")[0])
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0])

  // Filter data by date range
  const filteredLoads = useMemo(() => {
    return loads.filter((l) => {
      const d = l.created_at?.split("T")[0]
      return d >= startDate && d <= endDate
    })
  }, [loads, startDate, endDate])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const d = inv.created_at?.split("T")[0]
      return d >= startDate && d <= endDate
    })
  }, [invoices, startDate, endDate])

  // KPI calculations
  const kpis = useMemo(() => {
    const totalLoads = filteredLoads.length
    const deliveredLoads = filteredLoads.filter(l => l.completed_date)
    const onTimeLoads = deliveredLoads.filter(l => {
      if (!l.delivery_apt_to || !l.completed_date) return false
      return new Date(l.completed_date) <= new Date(l.delivery_apt_to)
    })
    const onTimePercent = deliveredLoads.length > 0
      ? Math.round((onTimeLoads.length / deliveredLoads.length) * 100)
      : 0

    // Average turn time (days from actual_pickup to completed_date)
    const turnTimes = filteredLoads
      .filter(l => l.actual_pickup && l.completed_date)
      .map(l => {
        const pickup = new Date(l.actual_pickup!).getTime()
        const completed = new Date(l.completed_date!).getTime()
        return (completed - pickup) / (1000 * 60 * 60 * 24) // days
      })
    const avgTurnTime = turnTimes.length > 0
      ? (turnTimes.reduce((a, b) => a + b, 0) / turnTimes.length).toFixed(1)
      : "0"

    const revenue = filteredInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const openAR = openInvoices.reduce((sum, inv) => sum + ((inv.amount || 0) - (inv.amount_paid || 0)), 0)

    return { totalLoads, onTimePercent, avgTurnTime, revenue, openAR }
  }, [filteredLoads, filteredInvoices, openInvoices])

  // Loads by Status chart data
  const loadsByStatus = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredLoads.forEach(l => {
      const status = l.status || "Unknown"
      counts[status] = (counts[status] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredLoads])

  // Load volume trend (daily)
  const volumeTrend = useMemo(() => {
    const daily: Record<string, number> = {}
    filteredLoads.forEach(l => {
      const day = l.created_at?.split("T")[0]
      if (day) daily[day] = (daily[day] || 0) + 1
    })
    return Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        loads: count
      }))
  }, [filteredLoads])

  // Revenue by Customer (top 10)
  const revenueByCustomer = useMemo(() => {
    const customerMap = new Map(customers.map(c => [c.id, c.name]))
    const rev: Record<string, number> = {}
    filteredInvoices.forEach(inv => {
      const name = inv.customers?.name || customerMap.get(inv.customer_id || "") || "Unknown"
      rev[name] = (rev[name] || 0) + (inv.amount || 0)
    })
    return Object.entries(rev)
      .map(([name, revenue]) => ({ name: name.length > 20 ? name.substring(0, 20) + "…" : name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  }, [filteredInvoices, customers])

  const handleExport = () => {
    const headers = ["Metric", "Value"]
    const rows = [
      ["Total Loads", kpis.totalLoads.toString()],
      ["On-Time %", `${kpis.onTimePercent}%`],
      ["Avg Turn Time (days)", kpis.avgTurnTime],
      ["Revenue", `$${kpis.revenue.toFixed(2)}`],
      ["Open A/R", `$${kpis.openAR.toFixed(2)}`],
    ]
    downloadCSV(headers, rows, `overview-report-${startDate}-to-${endDate}.csv`)
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg">
        Error loading overview data: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Overview Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Key performance metrics at a glance</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangeSelector startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <ReportExportButton onClick={handleExport} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Total Loads" value={kpis.totalLoads.toLocaleString()} icon={<Package className="w-5 h-5" />} />
        <KPICard title="On-Time %" value={`${kpis.onTimePercent}%`} icon={<Clock className="w-5 h-5" />} bg={kpis.onTimePercent >= 90 ? "bg-green-900/20" : kpis.onTimePercent >= 75 ? "bg-yellow-900/20" : "bg-red-900/20"} />
        <KPICard title="Avg Turn Time" value={`${kpis.avgTurnTime} days`} icon={<TrendingUp className="w-5 h-5" />} />
        <KPICard title="Revenue" value={`$${kpis.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<DollarSign className="w-5 h-5" />} bg="bg-green-900/20" />
        <KPICard title="Open A/R" value={`$${kpis.openAR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={<AlertCircle className="w-5 h-5" />} bg={kpis.openAR > 0 ? "bg-orange-900/20" : "bg-[#111827]"} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loads by Status */}
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Loads by Status</h3>
          {loadsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={loadsByStatus} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Loads" radius={[0, 4, 4, 0]}>
                  {loadsByStatus.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">No load data available</div>
          )}
        </div>

        {/* Load Volume Trend */}
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Load Volume Trend</h3>
          {volumeTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={volumeTrend} margin={{ left: 0, right: 0 }}>
                <defs>
                  <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8700A" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E8700A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "#9CA3AF", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="loads" name="Loads" stroke="#E8700A" fill="url(#loadGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">No trend data available</div>
          )}
        </div>
      </div>

      {/* Revenue by Customer */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h3 className="text-sm font-medium text-white mb-4">Revenue by Customer (Top 10)</h3>
        {revenueByCustomer.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={revenueByCustomer} margin={{ left: 20, right: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 } as any} angle={-45} textAnchor="end" interval={0} height={80} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" fill="#E8700A" radius={[4, 4, 0, 0]}>
                {revenueByCustomer.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[350px] flex items-center justify-center text-gray-500">No revenue data available</div>
        )}
      </div>
    </div>
  )
}
