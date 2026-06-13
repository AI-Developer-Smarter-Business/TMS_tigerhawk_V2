import { createClient } from "@/lib/supabase/server"
import {
  forwardGeocodeUsFreeform,
  geocodeUsAddressWithFallbacks,
} from "@/lib/geocoding/lane-origin-nominatim"
import { NextRequest, NextResponse } from "next/server"

async function requireDispatcherOrAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const }
}

/**
 * Server-side Nominatim forward geocode (US). Keeps User-Agent and throttling off the browser;
 * no API keys are used for OSM Nominatim (paid providers would be configured here only).
 *
 * Body: { query: string, mode?: "single" | "address_fallbacks" }
 */
export async function POST(request: NextRequest) {
  const auth = await requireDispatcherOrAdmin()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const queryRaw = (body as Record<string, unknown>).query
  const modeRaw = (body as Record<string, unknown>).mode

  if (typeof queryRaw !== "string") {
    return NextResponse.json({ error: "query must be a string" }, { status: 400 })
  }

  const query = queryRaw.trim()
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  const mode = modeRaw === "address_fallbacks" ? "address_fallbacks" : "single"

  const coords =
    mode === "address_fallbacks"
      ? await geocodeUsAddressWithFallbacks(query)
      : await forwardGeocodeUsFreeform(query)

  if (!coords) {
    return NextResponse.json({ found: false as const }, { status: 200 })
  }

  return NextResponse.json({
    found: true as const,
    lat: coords.lat,
    lng: coords.lon,
  })
}
