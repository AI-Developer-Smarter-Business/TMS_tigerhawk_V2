"use client"

import { useState, useEffect } from "react"
import {
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"

const S = {
  panel: "bg-[#141922] border-[#1e2530]",
  panelHeader: "bg-[#0B1120] border-[#1e2530]",
}

type FinancialMetrics = {
  // AR metrics
  totalOpenAR: number
  totalOverdueAR: number
  invoicesOutstanding: number
  invoicesOverdue: number
  // Recent activity (last 30 days)
  revenueInvoiced30d: number
  paymentsReceived30d: number
  // AP metrics
  totalSettlementsPending: number
  totalSettlementsAmount: number
  // Load counts
  activeLoads: number
  completedLoads30d: number
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

export function FinancialOverviewView() {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchMetrics = async () => {
    setLoading(true)
    setError("")
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const startDate = thirtyDaysAgo.toISOString()

      // Fetch all data in parallel
      const [
        openInvoicesRes,
        recentInvoicesRes,
        recentPaymentsRes,
        pendingSettlementsRes,
        activeLoadsRes,
        completedLoadsRes,
      ] = await Promise.all([
        // Open AR invoices (all time)
        supabase
          .from("ar_invoices")
          .select("id, amount, amount_paid, billing_status, due_date")
          .not("billing_status", "in", '("Paid","Cancelled","Write-off")'),

        // Recent invoices (last 30 days)
        supabase
          .from("ar_invoices")
          .select("id, amount, created_at")
          .gte("created_at", startDate),

        // Recent payments (last 30 days)
        supabase
          .from("ar_payments")
          .select("id, amount, created_at")
          .gte("created_at", startDate),

        // Pending AP settlements
        supabase
          .from("ap_settlements")
          .select("id, total_amount, status")
          .eq("status", "pending"),

        // Active loads
        supabase
          .from("loads")
          .select("id", { count: "exact", head: true })
          .not("status", "in", '("Completed","Cancelled","POD Received")'),

        // Completed loads last 30 days
        supabase
          .from("loads")
          .select("id", { count: "exact", head: true })
          .in("status", ["Completed", "POD Received"])
          .gte("completed_date", startDate),
      ])

      const openInvoices = openInvoicesRes.data || []
      const recentInvoices = recentInvoicesRes.data || []
      const recentPayments = recentPaymentsRes.data || []
      const pendingSettlements = pendingSettlementsRes.data || []

      // Calculate metrics
      const now = new Date()
      let totalOpenAR = 0
      let totalOverdueAR = 0
      let invoicesOverdue = 0

      for (const inv of openInvoices) {
        const balance = (inv.amount || 0) - (inv.amount_paid || 0)
        totalOpenAR += balance
        if (inv.due_date && new Date(inv.due_date) < now) {
          totalOverdueAR += balance
          invoicesOverdue++
        }
      }

      const revenueInvoiced30d = recentInvoices.reduce(
        (sum, inv) => sum + (inv.amount || 0),
        0
      )
      const paymentsReceived30d = recentPayments.reduce(
        (sum, pay) => sum + (pay.amount || 0),
        0
      )
      const totalSettlementsAmount = pendingSettlements.reduce(
        (sum, s) => sum + (s.total_amount || 0),
        0
      )

      setMetrics({
        totalOpenAR,
        totalOverdueAR,
        invoicesOutstanding: openInvoices.length,
        invoicesOverdue,
        revenueInvoiced30d,
        paymentsReceived30d,
        totalSettlementsPending: pendingSettlements.length,
        totalSettlementsAmount,
        activeLoads: activeLoadsRes.count || 0,
        completedLoads30d: completedLoadsRes.count || 0,
      })
    } catch (err) {
      console.error("Error fetching financial metrics:", err)
      setError("Failed to load financial metrics")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#E8700A] animate-spin" />
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-300">
          {error || "Failed to load metrics"}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign size={20} className="text-[#E8700A]" />
            Financial Overview
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            High-level financial health and key metrics
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-[#1a2236] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-white/20 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Accounts Receivable Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Accounts Receivable
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Open A/R Balance"
            value={formatCurrency(metrics.totalOpenAR)}
            icon={<DollarSign size={16} />}
            iconColor="text-blue-400"
            subtext={`${metrics.invoicesOutstanding} invoice${metrics.invoicesOutstanding !== 1 ? "s" : ""} outstanding`}
          />
          <MetricCard
            label="Overdue A/R"
            value={formatCurrency(metrics.totalOverdueAR)}
            icon={<AlertTriangle size={16} />}
            iconColor={metrics.invoicesOverdue > 0 ? "text-red-400" : "text-green-400"}
            subtext={
              metrics.invoicesOverdue > 0
                ? `${metrics.invoicesOverdue} overdue invoice${metrics.invoicesOverdue !== 1 ? "s" : ""}`
                : "No overdue invoices"
            }
            highlight={metrics.invoicesOverdue > 0 ? "red" : undefined}
          />
          <MetricCard
            label="Invoiced (30d)"
            value={formatCurrency(metrics.revenueInvoiced30d)}
            icon={<ArrowUpRight size={16} />}
            iconColor="text-green-400"
            subtext="Last 30 days"
          />
          <MetricCard
            label="Payments Received (30d)"
            value={formatCurrency(metrics.paymentsReceived30d)}
            icon={<ArrowDownRight size={16} />}
            iconColor="text-emerald-400"
            subtext="Last 30 days"
          />
        </div>
      </div>

      {/* Accounts Payable Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Accounts Payable
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Pending Settlements"
            value={String(metrics.totalSettlementsPending)}
            icon={<Clock size={16} />}
            iconColor="text-yellow-400"
            subtext={formatCurrency(metrics.totalSettlementsAmount) + " total"}
          />
          <MetricCard
            label="Settlement Value"
            value={formatCurrency(metrics.totalSettlementsAmount)}
            icon={<DollarSign size={16} />}
            iconColor="text-orange-400"
            subtext="Pending driver payouts"
          />
        </div>
      </div>

      {/* Operations Section */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">
          Operations
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Active Loads"
            value={String(metrics.activeLoads)}
            icon={<TrendingUp size={16} />}
            iconColor="text-blue-400"
            subtext="Currently in progress"
          />
          <MetricCard
            label="Completed (30d)"
            value={String(metrics.completedLoads30d)}
            icon={<TrendingUp size={16} />}
            iconColor="text-green-400"
            subtext="Last 30 days"
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className={`rounded-xl border p-5 ${S.panel}`}>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink href="/dashboard/accounts-receivable/aging" label="AR Aging Report" />
          <QuickLink href="/dashboard/accounts-receivable/invoices" label="Invoices" />
          <QuickLink href="/dashboard/accounts-payable/settlements" label="Settlements" />
          <QuickLink href="/dashboard/reports/financial" label="Financial Reports" />
          <QuickLink href="/dashboard/reports/overview" label="Executive Overview" />
          <QuickLink href="/dashboard/reports/audit" label="Audit Reports" />
          <QuickLink href="/dashboard/accounts-payable/deductions" label="Deductions" />
          <QuickLink href="/dashboard/accounts-receivable/billing" label="Billing" />
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  iconColor,
  subtext,
  highlight,
}: {
  label: string
  value: string
  icon: React.ReactNode
  iconColor: string
  subtext?: string
  highlight?: "red" | "green"
}) {
  const borderHighlight =
    highlight === "red"
      ? "border-red-500/30"
      : highlight === "green"
        ? "border-green-500/30"
        : "border-[#1e2530]"

  return (
    <div className={`rounded-xl p-4 border bg-[#141922] ${borderHighlight}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={iconColor}>{icon}</div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <div className="text-[10px] text-gray-500 mt-1">{subtext}</div>}
    </div>
  )
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="px-3 py-2.5 text-xs font-medium rounded-lg bg-[#1a2030] border border-[#2a3444] text-gray-300 hover:text-white hover:border-[#E8700A]/40 hover:bg-[#E8700A]/5 transition-colors text-center"
    >
      {label}
    </a>
  )
}
