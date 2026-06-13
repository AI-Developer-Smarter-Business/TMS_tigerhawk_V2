// app/login/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  // Login state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check for auth errors in URL hash (e.g., expired magic link)
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.substring(1))
      const errorCode = params.get("error_code")
      const errorDesc = params.get("error_description")

      if (errorCode === "otp_expired") {
        setError("Magic link has expired. Please request a new one.")
      } else if (errorCode) {
        setError(errorDesc?.replace(/\+/g, " ") || "Authentication failed. Please try again.")
      }

      // Clean up the URL hash
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  // MFA state
  const [mfaStep, setMfaStep] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Check if MFA is required
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      if (aal && aal.nextLevel === "aal2" && aal.currentLevel === "aal1") {
        // User has MFA enrolled — need to verify
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totpFactor = factors?.totp?.[0]

        if (totpFactor) {
          setMfaFactorId(totpFactor.id)
          setMfaStep(true)
          setLoading(false)
          return
        }
      }

      // No MFA required — route by role
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
          router.push("/portal")
        } else {
          router.push("/dashboard")
        }
      } else {
        router.push("/dashboard")
      }
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!mfaFactorId || mfaCode.length !== 6) {
      setError("Please enter the 6-digit code from your authenticator app")
      return
    }

    setLoading(true)

    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      })

      if (challengeError) {
        setError(challengeError.message)
        setLoading(false)
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      })

      if (verifyError) {
        setError("Invalid code — please try again")
        setMfaCode("")
        setLoading(false)
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-20 h-20">
            <img
              src="/logo.png"
              alt="TigerHawk Logistics"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">TigerHawk TMS</h1>
          <p className="text-gray-500 text-sm mt-1">Drayage Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-8">
          {!mfaStep ? (
            /* ========== PASSWORD LOGIN STEP ========== */
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@tigerhawklogistics.com"
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-[#E8700A] rounded-lg text-sm font-semibold text-white hover:bg-[#FF8C21] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#E8700A]/20"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          ) : (
            /* ========== MFA VERIFICATION STEP ========== */
            <form onSubmit={handleMfaVerify} className="space-y-5">
              {/* Back button */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setMfaStep(false)
                    setMfaCode("")
                    setError(null)
                    supabase.auth.signOut()
                  }}
                  className="p-1 rounded hover:bg-white/5 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                  </svg>
                </button>
                <span className="text-sm text-gray-400">Back to login</span>
              </div>

              <div className="text-center py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#E8700A]/10 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[#E8700A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white">Two-Factor Authentication</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Enter the code from your authenticator app
                </p>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "")
                  setMfaCode(val)
                  setError(null)
                }}
                placeholder="000000"
                autoFocus
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-center text-2xl font-mono tracking-[0.5em] text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
              />

              <button
                type="submit"
                disabled={loading || mfaCode.length !== 6}
                className="w-full px-4 py-3 bg-[#E8700A] rounded-lg text-sm font-semibold text-white hover:bg-[#FF8C21] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#E8700A]/20"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  "Verify"
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-6">
          Contact your administrator for login credentials
        </p>
      </div>
    </div>
  )
}
