// app/portal/login/page.tsx
// Customer Portal Login — Password-first with magic link fallback.
// Returning users sign in with email + password.
// First-time users or forgot-password users request a magic link.
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Mode = "password" | "magic-link" | "link-sent"

export default function PortalLoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check for auth errors in URL hash (e.g., expired magic link redirected here)
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const errorCode = params.get("error_code")
      if (errorCode === "otp_expired") {
        setError("Magic link has expired. Please request a new one.")
        setMode("magic-link")
      } else if (errorCode) {
        const errorDesc = params.get("error_description")?.replace(/\+/g, " ")
        setError(errorDesc || "Authentication failed. Please try again.")
      }
      // Clean up the URL hash
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  // ── Password Sign-In ──────────────────────────────────────
  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setError("Invalid email or password.")
        } else {
          setError(error.message)
        }
        setLoading(false)
        return
      }

      // Verify this is a customer user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (profile?.role === "customer") {
          router.replace("/portal")
        } else {
          // Not a customer — sign them out of this context, redirect to staff login
          await supabase.auth.signOut()
          setError("This login is for customer portal users. Staff members should use the main login.")
          setLoading(false)
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  // ── Magic Link ────────────────────────────────────────────
  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        if (error.message.includes("Signups not allowed")) {
          setError("No account found for this email. Contact your administrator for access.")
        } else {
          setError(error.message)
        }
        setLoading(false)
        return
      }

      setMode("link-sent")
      setLoading(false)
    } catch {
      setError("An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  // ── Shared components ─────────────────────────────────────
  const logoBlock = (
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
  )

  const errorBlock = error && (
    <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
      <p className="text-xs text-red-400">{error}</p>
    </div>
  )

  const spinnerIcon = (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
  )

  const inputClasses =
    "w-full px-3 py-2.5 bg-[#0B1120] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50 focus:ring-1 focus:ring-[#E8700A]/20 transition-colors"

  return (
    <div className="min-h-screen bg-[#0B1120] flex flex-col items-center justify-center px-4">
      {logoBlock}

      <div className="w-full max-w-sm bg-[#111827] border border-white/10 rounded-xl p-6 shadow-xl">
        {/* ════════ PASSWORD LOGIN (default) ════════ */}
        {mode === "password" && (
          <>
            <h2 className="text-lg font-semibold text-white mb-1">Sign in</h2>
            <p className="text-sm text-gray-400 mb-6">
              Enter your email and password.
            </p>

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-gray-400 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={inputClasses}
                />
              </div>

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
                  placeholder="Your password"
                  className={inputClasses}
                />
              </div>

              {errorBlock}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-[#E8700A] hover:bg-[#FF8C21] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    {spinnerIcon}
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode("magic-link")
                  setError(null)
                  setPassword("")
                }}
                className="text-xs text-gray-500 hover:text-[#E8700A] transition-colors"
              >
                First time signing in? Or forgot your password?
              </button>
            </div>
          </>
        )}

        {/* ════════ MAGIC LINK REQUEST ════════ */}
        {mode === "magic-link" && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setMode("password")
                  setError(null)
                }}
                className="p-1 rounded hover:bg-white/5 transition-colors"
              >
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                  />
                </svg>
              </button>
              <span className="text-sm text-gray-400">Back to password login</span>
            </div>

            <h2 className="text-lg font-semibold text-white mb-1">
              Get a sign-in link
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              We&apos;ll email you a link to sign in and set your password.
            </p>

            <form onSubmit={handleSendLink} className="space-y-4">
              <div>
                <label
                  htmlFor="email-link"
                  className="block text-xs font-medium text-gray-400 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email-link"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={inputClasses}
                />
              </div>

              {errorBlock}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-[#E8700A] hover:bg-[#FF8C21] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    {spinnerIcon}
                    Sending link...
                  </span>
                ) : (
                  "Send Sign-In Link"
                )}
              </button>
            </form>
          </>
        )}

        {/* ════════ LINK SENT CONFIRMATION ════════ */}
        {mode === "link-sent" && (
          <>
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
                    d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Check your email</h2>
              <p className="text-sm text-gray-400 mt-1">
                We sent a sign-in link to{" "}
                <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-xs text-gray-500 mt-3">
                Click the link in the email to sign in. The link expires in 24 hours.
              </p>
            </div>

            <button
              onClick={() => {
                setMode("password")
                setError(null)
              }}
              className="w-full py-2 text-sm text-gray-400 hover:text-[#E8700A] transition-colors"
            >
              Back to login
            </button>
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-600">
        Staff member?{" "}
        <a
          href="/login"
          className="text-[#E8700A] hover:text-[#FF8C21] transition-colors"
        >
          Sign in here
        </a>
      </p>
    </div>
  )
}
