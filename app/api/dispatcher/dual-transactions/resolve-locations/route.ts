import { createClient } from "@/lib/supabase/server"
import { buildLocationCoordMap } from "@/lib/dual-transaction-resolve-server"
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
 * Batch forward-geocode location strings (US) for dual-transaction mileage estimates.
 * Keys in `coords` are normalizeLocationKey(address).
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
  const raw = (body as Record<string, unknown>).addresses
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "addresses must be an array" }, { status: 400 })
  }

  const trimmed = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)

  const coordsRaw = await buildLocationCoordMap(trimmed)
  const coords: Record<string, { lat: number; lng: number } | null> = {}
  for (const [k, v] of Object.entries(coordsRaw)) {
    coords[k] = v ?? null
  }

  return NextResponse.json({ coords })
}
