import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { getUserFromRequest } from "@/lib/supabase/get-user-from-request"
import {
  getSamsaraIntegrationStatus,
  isSamsaraSimulatePublic,
} from "@/lib/integrations/samsara/config"
import { handleGeofenceCheckout } from "@/lib/integrations/samsara/handle-geofence-checkout"
import { parseGeofenceCheckoutBody } from "@/lib/integrations/samsara/parse-geofence-event"

export const runtime = "nodejs"

const STAFF_ROLES = new Set(["admin", "dispatcher"])

async function canSimulateGeofenceCheckout(
  request: NextRequest,
): Promise<{ allowed: boolean; error?: string }> {
  if (isSamsaraSimulatePublic()) {
    return { allowed: true }
  }

  const { user, supabase } = await getUserFromRequest(request)
  if (!user) {
    return { allowed: false, error: "Unauthorized" }
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role && STAFF_ROLES.has(profile.role)) {
    return { allowed: true }
  }

  return {
    allowed: false,
    error:
      "Staff role required, or set SAMSARA_MOCK_ALLOW_SIMULATE=true on TMS (dev only).",
  }
}

/**
 * POST — mock geofence exit → auto-close open delivery_wait (WT.23).
 * Does not call Samsara API. Pending real integration when credentials arrive.
 */
export async function POST(request: NextRequest) {
  const access = await canSimulateGeofenceCheckout(request)
  if (!access.allowed) {
    return NextResponse.json(
      {
        error: access.error ?? "Forbidden",
        integration: getSamsaraIntegrationStatus(),
      },
      { status: access.error === "Unauthorized" ? 401 : 403 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const input = parseGeofenceCheckoutBody(body, "simulate")
  if (!input) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        example: {
          loadId: "<load-uuid>",
          eventType: "geofence_exit",
          geofenceName: "Customer delivery (mock)",
          vehicleId: "mock-vehicle-1",
        },
      },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const result = await handleGeofenceCheckout(admin, input)
  const status = result.ok ? 200 : result.reason === "load_not_found" ? 404 : 500

  return NextResponse.json(result, { status })
}
