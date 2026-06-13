// app/auth/callback/page.tsx
// Client-side auth callback — handles both implicit flow (hash tokens)
// and PKCE flow (code query param) from magic links
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AuthCallbackPage() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState("Signing you in...")

  useEffect(() => {
    let cancelled = false

    async function handleAuth() {
      try {
        // Step 1: Check for hash fragment (implicit flow from admin-sent magic links)
        // The Supabase browser client auto-detects #access_token=... in the URL
        // and sets the session. We just need to wait for it.
        const hash = window.location.hash
        const params = new URLSearchParams(window.location.search)
        const code = params.get("code")

        // Check for error in hash (e.g., expired link)
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1))
          const errorCode = hashParams.get("error_code")
          if (errorCode) {
            const errorDesc = hashParams.get("error_description")?.replace(/\+/g, " ")
            if (errorCode === "otp_expired") {
              router.replace("/portal/login#error=access_denied&error_code=otp_expired&error_description=Magic+link+has+expired")
            } else {
              router.replace(`/login#error=auth_error&error_code=${errorCode}&error_description=${encodeURIComponent(errorDesc || "Authentication failed")}`)
            }
            return
          }
        }

        // Step 2: If there's a PKCE code param, exchange it
        // (This happens when the portal login page sends a magic link using
        //  the browser Supabase client, which uses PKCE by default)
        if (code) {
          setStatus("Verifying...")
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error("Code exchange failed:", exchangeError.message)
            router.replace("/portal/login#error=auth_error&error_code=exchange_failed&error_description=Failed+to+verify+login+link")
            return
          }
        }

        // Step 3: Explicitly handle implicit flow hash tokens
        // Admin-sent magic links use implicit flow (via createAnonClient),
        // which puts access_token + refresh_token in the URL hash.
        // The @supabase/ssr browser client doesn't reliably auto-detect these,
        // so we parse and set the session manually.
        if (hash && !code) {
          const hashParams = new URLSearchParams(hash.substring(1))
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")

          if (accessToken && refreshToken) {
            setStatus("Verifying...")
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessionError) {
              console.error("Failed to set session from hash tokens:", sessionError.message)
              router.replace("/portal/login#error=auth_error&error_code=session_failed&error_description=Failed+to+verify+login+link")
              return
            }
          } else {
            // Hash exists but no tokens — wait briefly for any async processing
            await new Promise((resolve) => setTimeout(resolve, 500))
          }
        }

        if (cancelled) return

        // Step 4: Get the authenticated user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          console.error("Auth callback: no user after auth flow", userError?.message)
          router.replace("/login")
          return
        }

        if (cancelled) return
        setStatus("Redirecting...")

        // Step 5: Fetch role + password_set status and redirect
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role, password_set")
          .eq("id", user.id)
          .single()

        if (cancelled) return

        const role = profile?.role

        if (role === "customer") {
          // First-time users need to set a password before accessing the portal
          if (!profile?.password_set) {
            router.replace("/portal/set-password")
          } else {
            router.replace("/portal")
          }
        } else if (role === "admin" || role === "dispatcher" || role === "accounting" || role === "driver") {
          // First-time staff users need to set a password before accessing the dashboard
          if (!profile?.password_set) {
            router.replace("/set-password")
          } else {
            router.replace("/dashboard")
          }
        } else {
          console.warn("Auth callback: unknown role", role, "for user", user.id)
          router.replace("/dashboard")
        }
      } catch (err) {
        console.error("Auth callback error:", err)
        if (!cancelled) {
          router.replace("/login")
        }
      }
    }

    handleAuth()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#E8700A] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-400 text-sm">{status}</p>
      </div>
    </div>
  )
}
