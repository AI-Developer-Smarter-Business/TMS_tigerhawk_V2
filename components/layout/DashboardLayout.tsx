// components/layout/DashboardLayout.tsx
"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"
import { UserMenu } from "@/components/auth/UserMenu"
import { StatusToastToggle } from "@/components/notifications/StatusToastToggle"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { GlobalSearch } from "@/components/search/GlobalSearch"
import { FloatingToasts } from "@/components/notifications/FloatingToasts"
import { useUserRole } from "@/lib/auth/useUserRole"

type NavChild = {
  name: string
  href: string
  adminOnly?: boolean
}

type NavItem = {
  name: string
  href: string
  icon: string
  adminOnly?: boolean
  children?: NavChild[]
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: "grid" },
  { name: "Vessels", href: "/dashboard/vessels", icon: "anchor" },
  {
    name: "Dispatcher",
    href: "/dashboard/dispatcher",
    icon: "dispatch",
    children: [
      { name: "Load Board", href: "/dashboard/dispatcher" },
      { name: "Planner", href: "/dashboard/dispatcher/planner" },
      { name: "Problem Containers", href: "/dashboard/dispatcher/problem-containers" },
      { name: "Dual Transactions", href: "/dashboard/dispatcher/dual-transactions" },
      { name: "Street Turns", href: "/dashboard/dispatcher/street-turns" },
      { name: "New Load", href: "/dashboard/dispatcher/new-load" },
      { name: "Driver Itinerary", href: "/dashboard/dispatcher/driver-itinerary" },
    ],
  },
  {
    name: "Drivers",
    href: "/dashboard/drivers",
    icon: "users",
    children: [
      { name: "Driver Profiles", href: "/dashboard/drivers?tab=driver-profiles" },
      { name: "Truck Assignments", href: "/dashboard/drivers?tab=truck-assignments" },
      { name: "Fleet Owners", href: "/dashboard/drivers?tab=fleet-owners" },
      { name: "Driver Pay Rates", href: "/dashboard/drivers?tab=driver-pay-rates" },
      { name: "Settlement Settings", href: "/dashboard/drivers?tab=settlement-settings" },
    ],
  },
  {
    name: "Equipment",
    href: "/dashboard/equipment",
    icon: "equipment",
    children: [
      { name: "Trucks", href: "/dashboard/equipment?tab=trucks" },
      { name: "Chassis", href: "/dashboard/equipment?tab=chassis" },
    ],
  },
  {
    name: "Accounts Receivable",
    href: "/dashboard/accounts-receivable",
    icon: "dollar",
    children: [
      { name: "Billing", href: "/dashboard/accounts-receivable/billing" },
      { name: "Invoices", href: "/dashboard/accounts-receivable/invoices" },
      { name: "Apply Payments & Credits", href: "/dashboard/accounts-receivable/payments" },
      { name: "Aging", href: "/dashboard/accounts-receivable/aging" },
      { name: "Chassis Audit", href: "/dashboard/accounts-receivable/chassis-audit" },
      { name: "Problem Sync", href: "/dashboard/accounts-receivable/problem-sync" },
      { name: "Waiting Time Audit", href: "/dashboard/accounts-receivable/waiting-time-audit" },
    ],
  },
  {
    name: "Accounts Payable",
    href: "/dashboard/accounts-payable",
    icon: "wallet",
    children: [
      { name: "Driver Pay", href: "/dashboard/accounts-payable/driver-pay" },
      { name: "Driver Settlements", href: "/dashboard/accounts-payable/settlements" },
      { name: "Deductions", href: "/dashboard/accounts-payable/deductions" },
    ],
  },
  { name: "Organizations", href: "/dashboard/organizations", icon: "briefcase", adminOnly: true },
  {
    name: "Reports",
    href: "/dashboard/reports",
    icon: "chart",
    children: [
      { name: "Overview", href: "/dashboard/reports/overview" },
      { name: "Financial Reports", href: "/dashboard/reports/financial" },
      { name: "Financial Overview", href: "/dashboard/reports/financial-overview", adminOnly: true },
      { name: "Operations", href: "/dashboard/reports/operations" },
      { name: "Audit & Compliance", href: "/dashboard/reports/audit" },
    ],
  },
  {
    name: "Notifications",
    href: "/dashboard/notifications",
    icon: "bell",
    adminOnly: false,
  },
  {
    name: "Admin",
    href: "/dashboard/admin",
    icon: "admin",
    adminOnly: true,
    children: [
      { name: "Portal Users", href: "/dashboard/admin/portal-users" },
      { name: "User Management", href: "/dashboard/admin/users" },
      { name: "Activity Log", href: "/dashboard/admin/activity-log" },
      { name: "Notifications", href: "/dashboard/admin/notifications" },
      { name: "Email Templates", href: "/dashboard/admin/email-templates" },
      { name: "Status Transitions", href: "/dashboard/admin/transitions" },
      { name: "System Settings", href: "/dashboard/admin/settings" },
    ],
  },
]

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const c = className || "w-5 h-5"
  switch (icon) {
    case "grid":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      )
    case "anchor":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21V3m0 0a3 3 0 1 0 0 6m0-6a3 3 0 1 1 0 6m0 0v12m8.716-6.747a9 9 0 0 0 .284-2.253c0-.113-.002-.225-.006-.337M3.284 14.253A9 9 0 0 1 3 12c0-.113.002-.225.006-.337" />
        </svg>
      )
    case "box":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      )
    case "truck":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      )
    case "users":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      )
    case "equipment":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.194-.14 1.743" />
        </svg>
      )
    case "warehouse":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
        </svg>
      )
    case "briefcase":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
        </svg>
      )
    case "chart":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      )
    case "dispatch":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      )
    case "dollar":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )
    case "wallet":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
        </svg>
      )
    case "admin":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      )
    case "bell":
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      )
    default:
      return null
  }
}

// Sidebar widths
const COLLAPSED_W = 68 // icon + padding
const EXPANDED_W = 256 // full sidebar (same as old w-64)

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile drawer
  const [hovered, setHovered] = useState(false) // desktop hover expand
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const { role } = useUserRole()

  // Build full URL (pathname + query string) for matching children with query params
  const currentTab = searchParams.get("tab")
  const fullUrl = currentTab ? `${pathname}?tab=${currentTab}` : pathname

  // Filter navigation based on role (hide admin-only items from non-admins)
  const visibleNav = navigation.filter(item => {
    if (item.adminOnly && role !== "admin") return false
    if (item.href === "/dashboard/notifications" && !["admin", "dispatcher", "accounting", "finance"].includes(role || "")) {
      return false
    }
    return true
  })

  // Check if a child href matches the current URL
  const childMatchesCurrent = (childHref: string): boolean => {
    // For hrefs with query params, compare full URL
    if (childHref.includes("?")) {
      return fullUrl === childHref
    }
    // For plain path hrefs, compare pathname only
    return pathname === childHref
  }

  // Auto-expand section if current pathname matches any child route or parent prefix
  const autoExpandSections = (): string[] => {
    const expanded: string[] = []
    visibleNav.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => childMatchesCurrent(child.href))
          || pathname.startsWith(item.href + "/")
          || pathname === item.href
        if (hasActiveChild) {
          expanded.push(item.name)
        }
      }
    })
    return expanded
  }

  // Initialize expanded sections based on current pathname
  const activeExpandedSections = expandedSections.length > 0 ? expandedSections : autoExpandSections()

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(s => s !== sectionName)
        : [...prev, sectionName]
    )
  }

  // Check if parent item is active (any child is active or pathname starts with parent href)
  const isParentActive = (item: NavItem): boolean => {
    if (!item.children) return pathname === item.href
    return item.children.some(child => childMatchesCurrent(child.href))
      || pathname.startsWith(item.href + "/")
      || pathname === item.href
  }

  // Check if child item is active
  const isChildActive = (href: string): boolean => {
    return childMatchesCurrent(href)
  }

  return (
    <div className="min-h-screen bg-[#0B1120]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: hovered ? EXPANDED_W : COLLAPSED_W }}
        className={`fixed top-0 left-0 z-50 h-full bg-[#111827] border-r border-white/5 flex flex-col overflow-hidden
          transition-[width] duration-[250ms] ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Logo — fixed height so nav items never shift vertically */}
        <div className="flex items-center justify-center border-b border-white/5 h-[200px] flex-shrink-0 overflow-hidden px-4">
          <img
            src="/logo.png"
            alt="TigerHawk Logistics"
            className={`object-contain transition-all duration-[250ms] ${
              hovered ? "w-[80%] h-auto" : "w-8 h-8"
            }`}
          />
        </div>

        {/* Navigation — icons stay at fixed left position */}
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {visibleNav.map((item) => {
            const isActive = isParentActive(item)
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = activeExpandedSections.includes(item.name)

            if (!hasChildren) {
              // Regular navigation item without children
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  title={hovered ? undefined : item.name}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap
                    transition-all duration-[250ms]
                    ${isActive
                      ? "bg-[#E8700A] text-white shadow-lg shadow-[#E8700A]/25"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                    }`}
                >
                  <NavIcon
                    icon={item.icon}
                    className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : ""}`}
                  />
                  <span
                    className={`transition-[opacity,max-width] duration-[250ms] overflow-hidden ${
                      hovered ? "opacity-100 max-w-[180px]" : "opacity-0 max-w-0"
                    }`}
                  >
                    {item.name}
                  </span>
                </Link>
              )
            }

            // Navigation item with children (collapsible)
            return (
              <div key={item.name}>
                <button
                  onClick={() => {
                    toggleSection(item.name)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap
                    transition-all duration-[250ms]
                    ${isActive
                      ? "bg-[#E8700A] text-white shadow-lg shadow-[#E8700A]/25"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                    }`}
                >
                  <NavIcon
                    icon={item.icon}
                    className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : ""}`}
                  />
                  <span
                    className={`transition-[opacity,max-width] duration-[250ms] overflow-hidden flex-1 text-left truncate ${
                      hovered ? "opacity-100 max-w-[140px]" : "opacity-0 max-w-0"
                    }`}
                  >
                    {item.name}
                  </span>
                  {/* Chevron icon that rotates when expanded */}
                  <svg
                    className={`w-3 h-3 flex-shrink-0 ml-auto transition-transform duration-[250ms] ${
                      isExpanded ? "rotate-180" : ""
                    } ${hovered ? "opacity-100" : "opacity-0"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {/* Collapsible children - only visible when sidebar is expanded AND section is expanded */}
                {hovered && isExpanded && item.children && (
                  <div className="space-y-1 mt-1">
                    {item.children
                      .filter(child => !child.adminOnly || role === "admin")
                      .map(child => {
                      const childActive = isChildActive(child.href)
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center pl-10 pr-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap
                            transition-all duration-[250ms]
                            ${childActive
                              ? "bg-[#E8700A]/20 text-[#E8700A]"
                              : "text-gray-500 hover:bg-white/5 hover:text-gray-200"
                            }`}
                        >
                          {child.name}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* User Menu */}
        <UserMenu collapsed={!hovered} />
      </aside>

      {/* Main content — left padding = collapsed sidebar width on desktop */}
      <div className="lg:pl-[68px]">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-[#111827]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:bg-white/5"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Search bar */}
            <div className="hidden sm:flex flex-1 max-w-lg">
              <GlobalSearch />
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <NotificationBell />
              <StatusToastToggle />
            </div>
          </div>
        </header>

        {/* Page content — overflow-x hidden so wide tables scroll inside their own container */}
        <main className="p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Floating toast notifications for load status changes */}
      <FloatingToasts />
    </div>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  )
}
