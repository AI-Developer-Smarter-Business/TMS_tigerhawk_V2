"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUserRole } from "@/lib/auth/useUserRole"

const reportTabs = [
  { name: "Overview", href: "/dashboard/reports/overview", adminOnly: false },
  { name: "Financial Reports", href: "/dashboard/reports/financial", adminOnly: false },
  { name: "Financial Overview", href: "/dashboard/reports/financial-overview", adminOnly: true },
  { name: "Operations", href: "/dashboard/reports/operations", adminOnly: false },
  { name: "Audit", href: "/dashboard/reports/audit", adminOnly: false },
]

export function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { role } = useUserRole()

  const visibleTabs = reportTabs.filter(tab => !tab.adminOnly || role === "admin")

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-white/10 pb-0">
        <div className="flex gap-0 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/")

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
