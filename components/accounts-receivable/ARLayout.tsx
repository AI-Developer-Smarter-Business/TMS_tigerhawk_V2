"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const arTabs = [
  { name: "Billing", href: "/dashboard/accounts-receivable/billing" },
  { name: "Invoices", href: "/dashboard/accounts-receivable/invoices" },
  { name: "Apply Payments & Credits", href: "/dashboard/accounts-receivable/payments" },
  { name: "Aging", href: "/dashboard/accounts-receivable/aging" },
  { name: "Chassis Audit", href: "/dashboard/accounts-receivable/chassis-audit" },
  { name: "Problem Sync", href: "/dashboard/accounts-receivable/problem-sync" },
  { name: "Waiting Time Audit", href: "/dashboard/accounts-receivable/waiting-time-audit" },
]

export function ARLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-white/10 pb-0">
        <div className="flex gap-0 overflow-x-auto">
          {arTabs.map((tab) => {
            const isActive = pathname === tab.href

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? "border-[#E8700A] text-white"
                    : "border-transparent text-gray-400 hover:text-gray-300"
                }`}
              >
                {tab.name}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Page content */}
      <div className="space-y-6">{children}</div>
    </div>
  )
}
