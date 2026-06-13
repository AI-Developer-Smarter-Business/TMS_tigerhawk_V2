// app/mfa/enroll/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function MfaEnrollPage() {
  const router = useRouter()
  const supabase = createClient()

  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(true)
  const [showSecret, setShowSecret] = useState(false)

  // Start enrollment on mount
  useEffect(() => {
    async function enroll() {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "TigerHawk TMS",
        issuer: "TigerHawk TMS",
      })

      if (error) {
        setError(error.message)
        setEnrolling(false)
        return
      }

      if (data) {
        setFactorId(data.id)
        // QR code comes as SVG — encode as data URL for <img>
        setQrCode(data.totp.qr_code)
        setSecret(data.totp.secret)
      }
      setEnrolling(false)
    }

    enroll()
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!factorId || verifyCode.length !== 6) {
      setError("Please enter the 6-digit code from your authenticator app")
      return
    }

    setLoading(true)

    try {
      // Challenge then verify (more reliable than challengeAndVerify)
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })

      if (challengeError) {
        setError(challengeError.message)
        setLoading(false)
        return
      }

      const { data, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verifyCode,
      })

      if (verifyError) {
        setError(verifyError.message)
        setVerifyCode("")
        setLoading(false)
        return
      }

      // MFA is now active — redirect to dashboard
      router.push("/dashboard")
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    // If factor was enrolled but not verified, unenroll it
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId })
    }
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-16 h-16">
            <img
              src="/logo.png"
              alt="TigerHawk Logistics"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl font-bold text-white">Set Up Two-Factor Authentication</h1>
          <p className="text-gray-500 text-sm mt-1">
            Scan the QR code with your authenticator app
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#111827] rounded-xl border border-white/5 p-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {enrolling && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-600 border-t-[#E8700A] rounded-full animate-spin" />
            </div>
          )}

          {/* QR Code */}
          {qrCode && !enrolling && (
            <>
              {/* Step 1: Scan */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[#E8700A] flex items-center justify-center text-xs font-bold text-white">1</span>
                  <span className="text-sm font-medium text-gray-300">Scan this QR code</span>
                </div>
                <div className="bg-white rounded-lg p-4 mx-auto w-fit">
                  <img
                    src={qrCode}
                    alt="MFA QR Code"
                    className="w-48 h-48"
                  />
                </div>
                <p className="text-xs text-gray-500 text-center mt-3">
                  Use Google Authenticator, Microsoft Authenticator, Authy, or 1Password
                </p>

                {/* Manual entry fallback */}
                <div className="mt-3">
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-xs text-[#E8700A] hover:text-[#FF8C21] transition-colors"
                  >
                    {showSecret ? "Hide" : "Can't scan?"} — Enter code manually
                  </button>
                  {showSecret && secret && (
                    <div className="mt-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                      <p className="text-xs text-gray-400 mb-1">Enter this key in your app:</p>
                      <p className="text-sm font-mono text-gray-200 break-all select-all">{secret}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Verify */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[#E8700A] flex items-center justify-center text-xs font-bold text-white">2</span>
                  <span className="text-sm font-medium text-gray-300">Enter the 6-digit code</span>
                </div>
                <form onSubmit={handleVerify} className="space-y-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "")
                      setVerifyCode(val)
                      setError(null)
                    }}
                    placeholder="000000"
                    autoFocus
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-center text-2xl font-mono tracking-[0.5em] text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
                  />
                  <button
                    type="submit"
                    disabled={loading || verifyCode.length !== 6}
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
                      "Verify & Activate"
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Skip option */}
        <div className="text-center mt-4">
          <button
            onClick={handleSkip}
            className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            Skip for now — set up later
          </button>
        </div>
      </div>
    </div>
  )
}
