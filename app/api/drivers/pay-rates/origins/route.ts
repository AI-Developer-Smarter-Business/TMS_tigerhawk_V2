import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  geocodeCityState,
  verifyCoordsForOrigin,
  type BulkGeocodeRowResult,
} from "@/lib/geocoding/lane-origin-nominatim"
import { NextRequest, NextResponse } from "next/server"

// Service role client bypasses RLS for admin mutations
const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAuth(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
    return { authorized: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { authorized: true, supabase, user }
}

async function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  userId: string,
  details: Record<string, unknown>
) {
  try {
    await serviceSupabase.from("activity_log").insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      user_id: userId,
      details,
    })
  } catch (err) {
    console.error("Audit log error:", err)
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const allParam = url.searchParams.get("all")

    let query = supabase
      .from("lane_origins")
      .select(`
        id,
        name,
        code,
        address,
        city,
        state,
        latitude,
        longitude,
        coordinate_source,
        geocoded_at,
        is_active,
        created_at,
        updated_at
      `)
      .order("name")

    if (!allParam || allParam !== "true") {
      query = query.eq("is_active", true)
    }

    const { data: origins, error: originsError } = await query

    if (originsError) {
      console.error("Origins fetch error:", originsError)
      return NextResponse.json(
        { error: originsError.message || "Failed to fetch origins" },
        { status: 500 }
      )
    }

    return NextResponse.json({ origins }, { status: 200 })
  } catch (error) {
    console.error("Error fetching origins:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authorized) {
      return auth.response
    }

    const body = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { error: "Origin name is required" },
        { status: 400 }
      )
    }

    if (!body.code) {
      return NextResponse.json(
        { error: "Origin code is required" },
        { status: 400 }
      )
    }

    let latitude: number | null = body.latitude !== undefined ? parseFloat(body.latitude) : null
    let longitude: number | null = body.longitude !== undefined ? parseFloat(body.longitude) : null
    if (!Number.isFinite(latitude)) latitude = null
    if (!Number.isFinite(longitude)) longitude = null
    const hadExplicitLatLngInput =
      body.latitude !== undefined &&
      body.longitude !== undefined &&
      latitude !== null &&
      longitude !== null

    if (latitude == null && longitude == null && body.city && body.state) {
      const coords = await geocodeCityState(body.city, body.state)
      if (coords) {
        latitude = coords.lat
        longitude = coords.lon
      }
    }

    if (latitude != null && longitude != null) {
      const verified = await verifyCoordsForOrigin(latitude, longitude, body.state)
      if (!verified.ok) {
        return NextResponse.json(
          { error: verified.message, code: verified.code },
          { status: 422 }
        )
      }
    }

    let coordinateSource: string | null = null
    let geocodedAt: string | null = null
    if (latitude != null && longitude != null) {
      geocodedAt = new Date().toISOString()
      if (hadExplicitLatLngInput) {
        coordinateSource = "manual"
      } else if (body.city && body.state) {
        coordinateSource = "nominatim"
      } else {
        coordinateSource = "manual"
      }
    }

    const insertData = {
      name: body.name,
      code: body.code,
      address: body.address || null,
      city: body.city || null,
      state: body.state || null,
      latitude,
      longitude,
      coordinate_source: coordinateSource,
      geocoded_at: geocodedAt,
      is_active: body.is_active ?? true,
    }

    const { data: origin, error: createError } = await serviceSupabase
      .from("lane_origins")
      .insert(insertData)
      .select()
      .single()

    if (createError || !origin) {
      console.error("Create error:", createError)
      return NextResponse.json(
        { error: createError?.message || "Failed to create origin" },
        { status: 500 }
      )
    }

    if (auth.user) {
      await logActivity("lane_origin", origin.id, "created", auth.user.id, {
        name: origin.name,
        code: origin.code,
        city: origin.city,
        state: origin.state,
        coordinate_source: coordinateSource,
        created_by: auth.user.email,
      })
    }

    return NextResponse.json({ origin }, { status: 201 })
  } catch (error) {
    console.error("Error creating origin:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

function mapVerifyFailureToBulkStatus(
  code: "COORDS_OUTSIDE_US_BOUNDS" | "STATE_COORD_MISMATCH" | "REVERSE_GEOCODE_COUNTRY_MISMATCH"
): Exclude<BulkGeocodeRowResult["status"], "success" | "skipped_no_city_state" | "geocode_failed" | "dry_run_would_update" | "db_error"> {
  if (code === "STATE_COORD_MISMATCH") return "rejected_state_mismatch"
  if (code === "REVERSE_GEOCODE_COUNTRY_MISMATCH") return "rejected_not_us_country"
  return "rejected_out_of_bounds"
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await checkAuth(request)
    if (!auth.authorized) {
      return auth.response
    }

    const body = await request.json()

    if (body.origin_id && body.latitude !== undefined && body.longitude !== undefined) {
      const lat = parseFloat(body.latitude)
      const lng = parseFloat(body.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return NextResponse.json({ error: "Invalid latitude or longitude" }, { status: 400 })
      }

      const { data: row, error: rowErr } = await serviceSupabase
        .from("lane_origins")
        .select("state")
        .eq("id", body.origin_id)
        .maybeSingle()

      if (rowErr || !row) {
        return NextResponse.json({ error: "Origin not found" }, { status: 404 })
      }

      const verified = await verifyCoordsForOrigin(lat, lng, row.state)
      if (!verified.ok) {
        return NextResponse.json(
          { error: verified.message, code: verified.code },
          { status: 422 }
        )
      }

      const { error } = await serviceSupabase
        .from("lane_origins")
        .update({
          latitude: lat,
          longitude: lng,
          coordinate_source: "manual",
          geocoded_at: new Date().toISOString(),
        })
        .eq("id", body.origin_id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (auth.user) {
        await logActivity("lane_origin", body.origin_id, "coordinates_updated", auth.user.id, {
          manual: true,
          latitude: lat,
          longitude: lng,
          updated_by: auth.user.email,
        })
      }

      return NextResponse.json({ updated: 1 }, { status: 200 })
    }

    const dryRun = body.dry_run === true

    const { data: originsToGeocode, error: listError } = await serviceSupabase
      .from("lane_origins")
      .select("id, name, city, state")
      .eq("is_active", true)
      .or("latitude.is.null,longitude.is.null")

    if (listError) {
      console.error("List origins for geocode:", listError)
      return NextResponse.json({ error: listError.message }, { status: 500 })
    }

    if (!originsToGeocode || originsToGeocode.length === 0) {
      return NextResponse.json({
        updated: 0,
        total: 0,
        dry_run: dryRun,
        results: [] as BulkGeocodeRowResult[],
        message: "No active origins missing coordinates",
      }, { status: 200 })
    }

    const results: BulkGeocodeRowResult[] = []
    let updated = 0

    for (const origin of originsToGeocode) {
      if (!origin.city?.trim() || !origin.state?.trim()) {
        results.push({ id: origin.id, name: origin.name, status: "skipped_no_city_state" })
        continue
      }

      const coords = await geocodeCityState(origin.city, origin.state)
      if (!coords) {
        results.push({ id: origin.id, name: origin.name, status: "geocode_failed" })
        continue
      }

      const verified = await verifyCoordsForOrigin(coords.lat, coords.lon, origin.state)
      if (!verified.ok) {
        results.push({
          id: origin.id,
          name: origin.name,
          status: mapVerifyFailureToBulkStatus(verified.code),
          detail: verified.message,
        })
        continue
      }

      if (dryRun) {
        results.push({ id: origin.id, name: origin.name, status: "dry_run_would_update" })
        continue
      }

      const { error: upErr } = await serviceSupabase
        .from("lane_origins")
        .update({
          latitude: coords.lat,
          longitude: coords.lon,
          coordinate_source: "nominatim",
          geocoded_at: new Date().toISOString(),
        })
        .eq("id", origin.id)

      if (upErr) {
        results.push({
          id: origin.id,
          name: origin.name,
          status: "db_error",
          detail: upErr.message,
        })
        continue
      }

      updated++
      results.push({ id: origin.id, name: origin.name, status: "success" })
    }

    if (auth.user) {
      const summary: Record<string, number> = {}
      for (const r of results) {
        summary[r.status] = (summary[r.status] ?? 0) + 1
      }
      await logActivity("lane_origin", "lane_origins_bulk", dryRun ? "bulk_geocode_dry_run" : "bulk_geocoded", auth.user.id, {
        dry_run: dryRun,
        updated,
        total: originsToGeocode.length,
        summary,
        performed_by: auth.user.email,
      })
    }

    return NextResponse.json({
      updated,
      total: originsToGeocode.length,
      dry_run: dryRun,
      results,
    }, { status: 200 })
  } catch (error) {
    console.error("Error geocoding origins:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
