/**
 * Batch geocode active lane_origins missing latitude or longitude.
 * Same validation as PATCH /api/drivers/pay-rates/origins (US bounds + optional state verify).
 *
 * Usage (from repo root, with env loaded):
 *   npx tsx scripts/backfill-lane-origins-geocode.ts
 *   npx tsx scripts/backfill-lane-origins-geocode.ts --dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js"
import { geocodeCityState, verifyCoordsForOrigin, type BulkGeocodeRowResult } from "../lib/geocoding/lane-origin-nominatim"

const dryRun = process.argv.includes("--dry-run")

function logRow(r: BulkGeocodeRowResult) {
  const extra = r.detail ? ` — ${r.detail}` : ""
  console.log(`[${r.status}] ${r.id} ${r.name}${extra}`)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const { data: origins, error: listError } = await supabase
    .from("lane_origins")
    .select("id, name, city, state")
    .eq("is_active", true)
    .or("latitude.is.null,longitude.is.null")

  if (listError) {
    console.error("Failed to list origins:", listError.message)
    process.exit(1)
  }

  if (!origins?.length) {
    console.log("No active origins missing coordinates.")
    return
  }

  console.log(`${dryRun ? "DRY RUN: " : ""}Processing ${origins.length} origin(s)…`)

  let updated = 0
  for (const origin of origins) {
    if (!origin.city?.trim() || !origin.state?.trim()) {
      logRow({ id: origin.id, name: origin.name, status: "skipped_no_city_state" })
      continue
    }

    const coords = await geocodeCityState(origin.city, origin.state)
    if (!coords) {
      logRow({ id: origin.id, name: origin.name, status: "geocode_failed" })
      continue
    }

    const verified = await verifyCoordsForOrigin(coords.lat, coords.lon, origin.state)
    if (!verified.ok) {
      const st =
        verified.code === "STATE_COORD_MISMATCH"
          ? "rejected_state_mismatch"
          : verified.code === "REVERSE_GEOCODE_COUNTRY_MISMATCH"
            ? "rejected_not_us_country"
            : "rejected_out_of_bounds"
      logRow({
        id: origin.id,
        name: origin.name,
        status: st,
        detail: verified.message,
      })
      continue
    }

    if (dryRun) {
      logRow({ id: origin.id, name: origin.name, status: "dry_run_would_update" })
      continue
    }

    const { error: upErr } = await supabase
      .from("lane_origins")
      .update({
        latitude: coords.lat,
        longitude: coords.lon,
        coordinate_source: "nominatim",
        geocoded_at: new Date().toISOString(),
      })
      .eq("id", origin.id)

    if (upErr) {
      logRow({
        id: origin.id,
        name: origin.name,
        status: "db_error",
        detail: upErr.message,
      })
      continue
    }

    updated++
    logRow({ id: origin.id, name: origin.name, status: "success" })
  }

  console.log(`Done. ${dryRun ? "Would update" : "Updated"}: ${updated} (of ${origins.length}).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
