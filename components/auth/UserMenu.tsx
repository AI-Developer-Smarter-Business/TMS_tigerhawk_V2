// components/auth/UserMenu.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUserRole } from "@/lib/auth/useUserRole"

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const { role, name, email, loading } = useUserRole()
  const [signingOut, setSigningOut] = useState(false)
  const [hasMfa, setHasMfa] = useState<boolean | null>(null)

  // Check if user has MFA enrolled
  useEffect(() => {
    async function checkMfa() {
      const { data } = await supabase.auth.mfa.listFactors()
      const activeTotpFactors = data?.totp?.filter((f) => f.status === "verified") || []
      setHasMfa(activeTotpFactors.length > 0)
    }
    checkMfa()
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : email?.[0]?.toUpperCase() || "?"

  const roleColors: Record<string, string> = {
    admin: "text-[#E8700A] bg-[#E8700A]/10",
    dispatcher: "text-blue-400 bg-blue-400/10",
    driver: "text-emerald-400 bg-emerald-400/10",
  }

  if (loading) {
    return (
      <div className="border-t border-white/5 px-3 py-3">
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-9 h-9 rounded-full bg-white/5 animate-pulse flex-shrink-0" />
          {!collapsed && (
            <div className="flex-1">
              <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
              <div className="h-2 w-14 bg-white/5 rounded animate-pulse mt-1" />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Collapsed state: just show avatar with initials
  if (collapsed) {
    return (
      <div className="border-t border-white/5 px-2 py-3 flex flex-col items-center gap-2">
        <div
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 cursor-default"
          title={`${name || email} (${role})`}
        >
          <span className="text-xs font-semibold text-gray-300">{initials}</span>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign Out"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
        </button>
      </div>
    )
  }

  // Expanded state: full user info
  return (
    <div className="border-t border-white/5 px-3 py-3 overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-gray-300">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{name || email}</p>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${roleColors[role || ""] || "text-gray-400 bg-white/5"}`}>
              {role || "—"}
            </span>
            {hasMfa && (
              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-400/10">
                2FA
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {/* MFA setup link */}
        {hasMfa === false && (
          <a
            href="/mfa/enroll"
            className="block w-full px-3 py-2 rounded-lg text-xs font-medium text-[#E8700A] bg-[#E8700A]/10 hover:bg-[#E8700A]/15 transition-colors text-center whitespace-nowrap"
          >
            Enable Two-Factor Auth
          </a>
        )}

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  )
}
