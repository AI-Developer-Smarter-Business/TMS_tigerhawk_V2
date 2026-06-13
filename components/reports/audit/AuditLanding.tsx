"use client"

import Link from "next/link"
import { Clock, Shield, AlertCircle, CreditCard, FileText } from "lucide-react"

const reports = [
  {
    title: "Activity Log",
    description: "System-wide audit trail of all user actions across the TMS",
    href: "/dashboard/reports/audit/activity-log",
    icon: FileText,
    color: "text-purple-400",
    bg: "bg-purple-900/20",
  },
  {
    title: "Waiting Time Summary",
    description: "Total waiting time charges by customer and event type",
    href: "/dashboard/reports/audit/waiting-time",
    icon: Clock,
    color: "text-orange-400",
    bg: "bg-orange-900/20",
  },
  {
    title: "Chassis Audit History",
    description: "Upload history, processing status, and error tracking",
    href: "/dashboard/reports/audit/chassis",
    icon: Shield,
    color: "text-blue-400",
    bg: "bg-blue-900/20",
  },
  {
    title: "Billing Discrepancies",
    description: "Invoices with mismatched amounts or unusual patterns",
    href: "/dashboard/reports/audit/billing",
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-900/20",
  },
  {
    title: "Payment Trail",
    description: "Complete payment history with application details",
    href: "/dashboard/reports/audit/payments",
    icon: CreditCard,
    color: "text-green-400",
    bg: "bg-green-900/20",
  },
]

export function AuditLanding() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Audit & Compliance</h1>
        <p className="text-sm text-gray-400 mt-1">Activity log, waiting time, chassis audits, billing discrepancies, and payment trails</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
