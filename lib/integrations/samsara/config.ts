/**
 * WT.23 — Samsara geofence integration (dev stub; prod API pending credentials).
 *
 * Env (TMS server only — never in Expo):
 * - SAMSARA_ENABLED — `true` to accept POST /api/integrations/samsara/webhook
 * - SAMSARA_WEBHOOK_SECRET — optional HMAC secret for webhook signature
 * - SAMSARA_MOCK_ALLOW_SIMULATE — `true` to allow POST …/simulate without staff role (dev only)
 * - SAMSARA_API_TOKEN — reserved for future outbound Samsara REST client (prod)
 */

export function isSamsaraWebhookEnabled(): boolean {
  return process.env.SAMSARA_ENABLED === "true"
}

export function isSamsaraSimulatePublic(): boolean {
  return process.env.SAMSARA_MOCK_ALLOW_SIMULATE === "true"
}

export function getSamsaraWebhookSecret(): string | null {
  const secret = process.env.SAMSARA_WEBHOOK_SECRET?.trim()
  return secret || null
}

/** Integration status for API responses and docs. */
export type SamsaraIntegrationStatus = {
  mode: "mock_stub" | "webhook_only" | "disabled"
  webhookEnabled: boolean
  simulatePublic: boolean
  apiConnected: false
  pending: "Samsara API credentials + prod backport"
}

export function getSamsaraIntegrationStatus(): SamsaraIntegrationStatus {
  const webhookEnabled = isSamsaraWebhookEnabled()
  return {
    mode: webhookEnabled ? "webhook_only" : "mock_stub",
    webhookEnabled,
    simulatePublic: isSamsaraSimulatePublic(),
    apiConnected: false,
    pending: "Samsara API credentials + prod backport",
  }
}
