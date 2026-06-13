// lib/port-houston/auth.ts
// OAuth2 token management with in-memory caching for Port Houston API

import type { PHTokenResponse } from "./types"

const AUTH_URL = process.env.PORT_HOUSTON_AUTH_URL!
const CLIENT_ID = process.env.PORT_HOUSTON_CLIENT_ID!
const CLIENT_SECRET = process.env.PORT_HOUSTON_CLIENT_SECRET!

// In-memory token cache (survives within a single serverless invocation,
// may persist across warm starts on Vercel)
let cachedToken: string | null = null
let tokenExpiresAt: number = 0

/**
 * Get a valid Bearer token, using cache when possible.
 * Refreshes 5 minutes before expiry to avoid mid-request failures.
 */
export async function getToken(): Promise<string> {
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000 // refresh 5 min before expiry

  if (cachedToken && now < tokenExpiresAt - bufferMs) {
    return cachedToken
  }

  return refreshToken()
}

/**
 * Force-fetch a new token from the PH auth server.
 */
async function refreshToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
  })

  const response = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Port Houston auth failed (${response.status}): ${errorText}`
    )
  }

  const data: PHTokenResponse = await response.json()

  cachedToken = data.access_token
  // expires_in is in seconds; convert to ms and store absolute time
  tokenExpiresAt = Date.now() + data.expires_in * 1000

  return cachedToken
}

/**
 * Invalidate the cached token (call on 401 responses to force refresh).
 */
export function invalidateToken(): void {
  cachedToken = null
  tokenExpiresAt = 0
}
