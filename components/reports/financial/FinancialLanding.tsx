"use client"

import Link from "next/link"
import { DollarSign, Clock, TrendingUp, FileText, Tag } from "lucide-react"

const reports = [
  {
    title: "Revenue by Customer",
    description: "Revenue breakdown by customer with trend analysis",
    href: "/dashboard/reports/financial/revenue",
    icon: DollarSign,
    color: "text-green-400",
    bg: "bg-green-900/20",
  },
  {
    title: "A/R Aging",
    description: "Outstanding receivables grouped by aging buckets",
    href: "/dashboard/reports/financial/aging",
    icon: Clock,
    color: "text-orange-400",
    bg: "bg-orange-900/20",
  },
  {
    title: "Profit Margin",
    description: "Revenue vs driver pay per load for margin analysis",
    href: "/dashboard/reports/financial/profit",
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-900/20",
  },
  {
    title: "Settlement Summary",
    description: "Driver settlement totals with deduction breakdowns",
    href: "/dashboard/reports/financial/settlements",
    icon: FileText,
    color: "text-purple-400",
    bg: "bg-purple-900/20",
  },
  {
    title: "Accessorial Analysis",
    description: "Breakdown of charges by accessorial type",
    href: "/dashboard/reports/financial/accessorials",
    icon: Tag,
    color: "text-cyan-400",
    bg: "bg-cyan-900/20",
  },
]

export function FinancialLanding() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Financial Reports</h1>
        <p className="text-sm text-gray-400 mt-1">Revenue, receivables, profitability, and settlement analysis</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="bg-[#111827] border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors group"
          >
            <div className={`w-10 h-10 ${report.bg} rounded-lg flex items-center justify-center mb-4`}>
              <report.icon className={`w-5 h-5 ${report.color}`} />
            </div>
            <h3 className="text-sm font-medium text-white group-hover:text-[#E8700A] transition-colors">{report.title}</h3>
            <p className="text-xs text-gray-400 mt-1">{report.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
