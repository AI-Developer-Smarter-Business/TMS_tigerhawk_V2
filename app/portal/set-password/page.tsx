// app/portal/set-password/page.tsx
// Shown after a portal user's first magic link sign-in.
// They must set a permanent password before accessing the portal.
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Ensure user is authenticated — if not, redirect to login
  useEffect(() => {
    let cancelled = false
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        router.replace("/portal/login")
        return
      }
      setCheckingAuth(false)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  function validatePassword(): string | null {
    if (password.length < 8) {
      return "Password must be at least 8 characters."
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter."
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter."
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number."
    }
    if (password !== confirm) {
      return "Passwords do not match."
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validatePassword()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/portal/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to set password. Please try again.")
        setLoading(false)
        return
      }

      // Success — redirect to portal
      router.replace("/portal")
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#E8700A] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Password strength indicator
  const strengthChecks = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
  ]
  const strengthMet = strengthChecks.filter((c) => c.met).length

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#E8700A] rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
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
          <h1 className="text-2xl font-bold text-white">TigerHawk</h1>
        </div>
        <p className="text-gray-400 text-sm">Customer Portal</p>
      </div>

      {/* Set Password Card */}
      <div className="w-full max-w-sm bg-[#111827] border border-white/10 rounded-xl p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto bg-[#E8700A]/10 border border-[#E8700A]/20 rounded-full flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-[#E8700A]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">Set your password</h2>
          <p className="text-sm text-gray-400 mt-1">
            Create a password for future sign-ins.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-gray-400 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2.5 bg-[#0B1120] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50 focus:ring-1 focus:ring-[#E8700A]/20 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block text-xs font-medium text-gray-400 mb-1.5"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm your password"
              className="w-full px-3 py-2.5 bg-[#0B1120] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50 focus:ring-1 focus:ring-[#E8700A]/20 transition-colors"
            />
          </div>

          {/* Strength indicators */}
          {password.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= strengthMet
                        ? strengthMet <= 2
                          ? "bg-red-500"
                          : strengthMet === 3
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        : "bg-gray-700"
                    }`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {strengthChecks.map((check) => (
                  <span
                    key={check.label}
                    className={`text-[10px] ${
                      check.met ? "text-green-400" : "text-gray-600"
                    }`}
                  >
                    {check.met ? "\u2713" : "\u2022"} {check.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-[#E8700A] hover:bg-[#FF8C21] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Setting password...
              </span>
            ) : (
              "Set Password & Continue"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
