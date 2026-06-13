"use client"

import Link from "next/link"
import { Clock, Users, AlertTriangle, Zap } from "lucide-react"

const reports = [
  {
    title: "Container Turn Times",
    description: "Average time from pickup to return by location",
    href: "/dashboard/reports/operations/turn-times",
    icon: Clock,
    color: "text-blue-400",
    bg: "bg-blue-900/20",
  },
  {
    title: "Driver Utilization",
    description: "Loads per driver and revenue contribution",
    href: "/dashboard/reports/operations/driver-utilization",
    icon: Users,
    color: "text-green-400",
    bg: "bg-green-900/20",
  },
  {
    title: "Demurrage Exposure",
    description: "Containers past last free day with cost estimates",
    href: "/dashboard/reports/operations/demurrage",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-900/20",
  },
  {
    title: "Street Turn & Dual Savings",
    description: "Cost savings from street turns and dual transactions",
    href: "/dashboard/reports/operations/savings",
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
  },
]

export function OperationsLanding() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Operations Reports</h1>
        <p className="text-sm text-gray-400 mt-1">Efficiency, utilization, and operational performance metrics</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
