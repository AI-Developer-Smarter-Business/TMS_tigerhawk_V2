"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const apTabs = [
  { name: "Driver Pay", href: "/dashboard/accounts-payable/driver-pay" },
  { name: "Driver Settlements", href: "/dashboard/accounts-payable/settlements" },
  { name: "Deductions", href: "/dashboard/accounts-payable/deductions" },
]

export function APLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-white/10 pb-0">
        <div className="flex gap-0 overflow-x-auto">
          {apTabs.map((tab) => {
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
