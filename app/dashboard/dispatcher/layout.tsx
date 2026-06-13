"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { NewLoadModal } from "@/components/dispatcher/NewLoadModal"
import { ImportPortProModal } from "@/components/dispatcher/ImportPortProModal"
import { createClient } from "@/lib/supabase/client"

const dispatcherTabs = [
  { name: "Dispatcher", href: "/dashboard/dispatcher", badge: false },
  { name: "Driver Itinerary", href: "/dashboard/dispatcher/driver-itinerary", badge: false },
  { name: "Planner", href: "/dashboard/dispatcher/planner", badge: false },
  { name: "Dual Transactions", href: "/dashboard/dispatcher/dual-transactions", badge: false },
  { name: "Street Turns", href: "/dashboard/dispatcher/street-turns", badge: true },
  { name: "Problem Containers", href: "/dashboard/dispatcher/problem-containers", badge: true },
]

export default function DispatcherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [newLoadOpen, setNewLoadOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [streetTurnCount, setStreetTurnCount] = useState<number | null>(null)
  const [problemCount, setProblemCount] = useState<number | null>(null)

  // Fetch badge counts
  useEffect(() => {
    let cancelled = false

    async function fetchCounts() {
      try {
        const supabase = createClient()

        // Street turns count — imports + exports without a street turn match
        const { count: stImports } = await supabase
          .from("loads")
          .select("*", { count: "exact", head: true })
          .eq("load_type", "Import")
          .is("street_turn_match_id", null)

        const { count: stExports } = await supabase
          .from("loads")
          .select("*", { count: "exact", head: true })
          .eq("load_type", "Export")
          .is("street_turn_match_id", null)

        if (!cancelled) {
          setStreetTurnCount((stImports ?? 0) + (stExports ?? 0))
        }

        // Problem containers: loads with any hold set to "hold"
        const { data: allLoads } = await supabase
          .from("loads")
          .select("id, freight_hold, terminal_hold, fees_hold, other_hold, carrier_hold, status, containers!inner(last_free_day)")
          .neq("status", "Completed")

        let problemTotal = 0
        if (allLoads) {
          allLoads.forEach((load: Record<string, unknown>) => {
            if (
              load.freight_hold === "hold" ||
              load.terminal_hold === "hold" ||
              load.fees_hold === "hold" ||
              load.other_hold === "hold" ||
              load.carrier_hold === true
            ) {
              problemTotal++
            }
          })
        }

        if (!cancelled) {
          setProblemCount(problemTotal)
        }
      } catch (error) {
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error &&
            (error.name === "AbortError" ||
              error.message.toLowerCase().includes("signal is aborted")))

        // Aborts during navigation/unmount are expected in dev; do not crash.
        if (isAbort || cancelled) return

        console.error("[DispatcherLayout] Failed to fetch badge counts:", error)
      }
    }

    fetchCounts()

    return () => {
      cancelled = true
    }
  }, [])

  function getBadgeCount(tabName: string): number | null {
    if (tabName === "Street Turns") return streetTurnCount
    if (tabName === "Problem Containers") return problemCount
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Sub-tab navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 sm:pb-0">
            {dispatcherTabs.map((tab) => {
              // Exact match for base dispatcher, startsWith for sub-pages
              const isActive =
                tab.href === "/dashboard/dispatcher"
                  ? pathname === "/dashboard/dispatcher"
                  : pathname.startsWith(tab.href)

              const count = tab.badge ? getBadgeCount(tab.name) : null

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors relative
                    ${isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-300"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {tab.name}
                    {tab.badge && count !== null && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E8700A] text-white min-w-[22px]">
                        {count}
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E8700A]" />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <a
              href="/dashboard/drivers"
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
            >
              Drivers
            </a>
            <button
              onClick={() => setImportOpen(true)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Import CSV
            </button>
            <button
              onClick={() => setNewLoadOpen(true)}
              className="px-4 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors"
            >
              + Add New Load
            </button>
          </div>
        </div>

        {/* Page content */}
        {children}
      </div>

      {/* Floating Add New Load modal */}
      <NewLoadModal open={newLoadOpen} onClose={() => setNewLoadOpen(false)} />

      {/* Import PortPro CSV modal */}
      <ImportPortProModal open={importOpen} onClose={() => setImportOpen(false)} />
    </DashboardLayout>
  )
}
