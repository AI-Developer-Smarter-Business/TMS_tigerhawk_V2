import type { User } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("Authorization")
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()
  return token || null
}

/**
 * Resolves the authenticated user for API routes.
 * Mobile sends `Authorization: Bearer <access_token>` (no TMS cookies).
 * Passing the JWT to `getUser(jwt)` is required — `global.headers` alone is unreliable.
 */
export async function getUserFromRequest(request: NextRequest): Promise<{
  user: User | null
  supabase: Awaited<ReturnType<typeof createClient>>
}> {
  const supabase = await createClient(request)
  const bearerToken = extractBearerToken(request)

  if (bearerToken) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearerToken)
    if (!error && user) {
      return { user, supabase }
    }

    try {
      const admin = createAdminClient()
      const {
        data: { user: adminUser },
        error: adminError,
      } = await admin.auth.getUser(bearerToken)
      if (!adminError && adminUser) {
        return { user: adminUser, supabase }
      }
    } catch {
      // Missing SUPABASE_SERVICE_ROLE_KEY in local env
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { user: user ?? null, supabase }
}

/** For Next.js middleware — cookie sessions only (Bearer is handled in API route handlers). */
export async function resolveUserForMiddleware(
  supabase: { auth: { getUser: () => Promise<{ data: { user: User | null } }> } },
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}
