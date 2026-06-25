import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getUserFromRequest } from "@/lib/supabase/get-user-from-request"
import {
  getSamsaraIntegrationStatus,
  getSamsaraWebhookSecret,
  isSamsaraWebhookEnabled,
} from "@/lib/integrations/samsara/config"
import { handleGeofenceCheckout } from "@/lib/integrations/samsara/handle-geofence-checkout"
import { parseGeofenceCheckoutBody } from "@/lib/integrations/samsara/parse-geofence-event"
import { verifySamsaraWebhookSignature } from "@/lib/integrations/samsara/verify-webhook-signature"

export const runtime = "nodejs"

/** GET — integration status (staff session or Bearer). */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(getSamsaraIntegrationStatus())
}

/**
 * POST — Samsara geofence webhook (disabled until SAMSARA_ENABLED=true).
 * Body: see docs/SAMSARA_GEOFENCE_SPIKE.md (mock schema today).
 */
export async function POST(request: NextRequest) {
  if (!isSamsaraWebhookEnabled()) {
    return NextResponse.json(
      {
        error: "Samsara webhook disabled",
        integration: getSamsaraIntegrationStatus(),
        hint: "Set SAMSARA_ENABLED=true on TMS when Samsara credentials are ready. Use POST /api/integrations/samsara/simulate for mock testing.",
      },
      { status: 503 },
    )
  }

  const rawBody = await request.text()
  let body: unknown
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const secret = getSamsaraWebhookSecret()
  if (secret) {
    const signature = request.headers.get("x-samsara-signature")
    if (!verifySamsaraWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }
  }

  const input = parseGeofenceCheckoutBody(body, "samsara_webhook")
  if (!input) {
    return NextResponse.json(
      { error: "Invalid payload — expected geofence_exit with loadId" },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const result = await handleGeofenceCheckout(admin, input)
  const status = result.ok ? 200 : result.reason === "load_not_found" ? 404 : 500

  return NextResponse.json(result, { status })
}
