// components/portal/PortalLayout.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type NavItem = {
  name: string
  href: string
  icon: "home" | "truck" | "clock" | "file"
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/portal", icon: "home" },
  { name: "Active Loads", href: "/portal/loads", icon: "truck" },
  { name: "History", href: "/portal/history", icon: "clock" },
  { name: "Documents", href: "/portal/documents", icon: "file" },
]

function NavIcon({ icon, className }: { icon: NavItem["icon"]; className?: string }) {
  const cls = className || "w-4 h-4"
  switch (icon) {
    case "home":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    case "truck":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
      )
    case "clock":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case "file":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
  }
}

type Props = {
  customerName: string
  companyName: string
  children: React.ReactNode
}

export function PortalLayout({ customerName, companyName, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === "/portal") return pathname === "/portal"
    return pathname.startsWith(href)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/portal/login")
  }

  return (
    <div className="min-h-screen bg-[#0B1120]">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 bg-[#111827]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link href="/portal" className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-[#E8700A] rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <span className="text-white font-semibold text-sm hidden sm:block">
                  TigerHawk
                </span>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-[#E8700A]/10 text-[#FF8C21]"
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                    }`}
                  >
                    <NavIcon icon={item.icon} />
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Right: Customer info + Sign Out */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-gray-400">{companyName}</p>
                <p className="text-xs text-gray-500">{customerName}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-colors"
              >
                Sign Out
              </button>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                className="md:hidden p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-white/5 px-4 py-2 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-[#E8700A]/10 text-[#FF8C21]"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <NavIcon icon={item.icon} />
                {item.name}
              </Link>
            ))}
            <div className="pt-2 border-t border-white/5">
              <p className="px-3 py-1 text-xs text-gray-500">{companyName}</p>
            </div>
          </nav>
        )}
      </header>

      {/* ── Page Content ── */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
