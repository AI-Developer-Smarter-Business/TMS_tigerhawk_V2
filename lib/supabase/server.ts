// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"

export async function createClient(request?: NextRequest) {
  const cookieStore = await cookies()
  const authorization = request?.headers.get("Authorization") ?? undefined

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — safe to ignore
          }
        },
      },
      global: authorization
        ? { headers: { Authorization: authorization } }
        : undefined,
    }
  )
}
