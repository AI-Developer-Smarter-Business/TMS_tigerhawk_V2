// lib/auth/useUserRole.ts
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type UserInfo = {
  role: string | null
  name: string | null
  email: string | null
  loading: boolean
}

export function useUserRole(): UserInfo {
  const [info, setInfo] = useState<UserInfo>({
    role: null,
    name: null,
    email: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function fetchUserInfo() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (!cancelled) {
            setInfo({ role: null, name: null, email: null, loading: false })
          }
          return
        }

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("role, full_name, email")
          .eq("id", user.id)
          .single()

        if (!cancelled) {
          setInfo({
            role: profile?.role || null,
            name: profile?.full_name || null,
            email: profile?.email || user.email || null,
            loading: false,
          })
        }
      } catch (error) {
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error &&
            (error.name === "AbortError" ||
              error.message.toLowerCase().includes("signal is aborted")))

        if (isAbort || cancelled) return

        console.error("[useUserRole] Failed to fetch user role:", error)
        if (!cancelled) {
          setInfo({ role: null, name: null, email: null, loading: false })
        }
      }
    }

    fetchUserInfo()

    return () => {
      cancelled = true
    }
  }, [])

  return info
}
