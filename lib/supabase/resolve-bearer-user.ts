import type { User } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

import { extractBearerToken } from "./get-user-from-request"

/** Reads mobile JWT from multipart (RN sometimes drops Authorization on FormData uploads). */
export function extractAccessTokenFromForm(formData: FormData): string | null {
  const value = formData.get("access_token")
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveAccessTokenFromUpload(
  request: NextRequest,
  formData: FormData,
): string | null {
  return extractBearerToken(request) ?? extractAccessTokenFromForm(formData)
}

/**
 * Validates a Supabase access JWT using the service role (same project as TMS).
 * Used for Tigerhawk Mobile uploads where cookie sessions are absent.
 */
export async function resolveUserFromAccessToken(
  accessToken: string,
): Promise<{ user: User | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(accessToken)

    if (error) {
      return { user: null, error: error.message }
    }
    return { user: user ?? null, error: null }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "SUPABASE_SERVICE_ROLE_KEY not configured"
    return { user: null, error: message }
  }
}
