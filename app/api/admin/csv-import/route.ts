import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  parseDriverCsvRows,
  parseDriverGroupCsvRows,
  driverRowToRpcPayload,
  driverGroupRowToRpcPayload,
  type CsvImportEntity,
} from "@/lib/csv-import/staff-schemas"

const MAX_ROWS = 500

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { entity?: CsvImportEntity; rows?: Record<string, unknown>[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { entity, rows } = body
  if (entity !== "drivers" && entity !== "driver_groups") {
    return NextResponse.json(
      { error: "entity must be drivers or driver_groups" },
      { status: 400 },
    )
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json(
      { error: "rows must be a non-empty array" },
      { status: 400 },
    )
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (max ${MAX_ROWS} per request)` },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  if (entity === "drivers") {
    const parsed = parseDriverCsvRows(rows)
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.errors },
        { status: 422 },
      )
    }
    const payload = parsed.data.map(driverRowToRpcPayload)
    const { data, error } = await admin.rpc("import_drivers_csv_transaction", {
      p_rows: payload,
    })
    if (error) {
      console.error("[csv-import drivers]", error)
      return NextResponse.json(
        { error: error.message || "Import failed" },
        { status: 400 },
      )
    }
    try {
      await admin.from("activity_log").insert({
        entity_type: "csv_import",
        entity_id: `drivers-${user.id}-${Date.now()}`,
        action: "bulk_upsert",
        user_id: user.id,
        details: {
          target: "drivers",
          row_count: rows.length,
          result: data,
        },
      })
    } catch (e) {
      console.warn("[csv-import] activity_log:", e)
    }
    return NextResponse.json({ ok: true, entity, result: data })
  }

  const parsed = parseDriverGroupCsvRows(rows)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.errors },
      { status: 422 },
    )
  }

  const { data: profiles, error: profErr } = await admin
    .from("rate_profiles")
    .select("id, name")

  if (profErr) {
    console.error("[csv-import] rate_profiles", profErr)
    return NextResponse.json(
      { error: "Could not resolve rate profiles" },
      { status: 500 },
    )
  }

  const profileByName = new Map(
    (profiles || []).map((p) => [String(p.name).trim().toLowerCase(), p.id as string]),
  )

  const resolved = []
  for (const row of parsed.data) {
    let rateProfileId = row.rate_profile_id
    const rpName = row.rate_profile_name?.trim()
    if (rpName) {
      const id = profileByName.get(rpName.toLowerCase())
      if (!id) {
        return NextResponse.json(
          {
            error: "Unknown rate_profile_name",
            details: [`No rate profile named "${row.rate_profile_name}"`],
          },
          { status: 422 },
        )
      }
      rateProfileId = id
    }
    resolved.push({
      ...row,
      rate_profile_id: rateProfileId,
    })
  }

  const payload = resolved.map(driverGroupRowToRpcPayload)
  const { data, error } = await admin.rpc("import_driver_groups_csv_transaction", {
    p_rows: payload,
  })
  if (error) {
    console.error("[csv-import driver_groups]", error)
    return NextResponse.json(
      { error: error.message || "Import failed" },
      { status: 400 },
    )
  }
  try {
    await admin.from("activity_log").insert({
      entity_type: "csv_import",
      entity_id: `driver_groups-${user.id}-${Date.now()}`,
      action: "bulk_upsert",
      user_id: user.id,
      details: {
        target: "driver_groups",
        row_count: rows.length,
        result: data,
      },
    })
  } catch (e) {
    console.warn("[csv-import] activity_log:", e)
  }

  return NextResponse.json({ ok: true, entity, result: data })
}
