// app/api/dispatcher/import/route.ts
// Bulk import PortPro CSV data — creates/updates containers, loads,
// and auto-creates missing customers and drivers.

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"
import { auditLog } from "@/lib/auditLog"
import type { MappedLoad, MappedContainer } from "@/lib/portpro/mapRow"

/** Valid load statuses per DB check constraint — server-side safety net */
const VALID_LOAD_STATUSES = new Set([
  "Available", "Available At Port", "Pending", "Customs Hold", "Freight Released",
  "Created", "Assigned", "Dispatched", "In Transit", "Arrived At Pickup",
  "Arrived At Delivery", "Arrived At Return Empty", "Arrived To Hook Container",
  "At Warehouse", "Dropped - Empty", "Dropped - Loaded", "Enroute To Drop Container",
  "Enroute To Return Empty", "Delivered", "Completed", "Cancelled",
])

function safeLoadStatus(status: string | null | undefined): string {
  if (status && VALID_LOAD_STATUSES.has(status)) return status
  return "Pending"
}

export const maxDuration = 60 // Allow up to 60s for large imports

interface ImportRow {
  load: MappedLoad
  container: MappedContainer | null
}

interface ImportResult {
  loadsImported: number
  loadsUpdated: number
  containersCreated: number
  containersUpdated: number
  customersCreated: number
  driversCreated: number
  errors: string[]
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────
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
      return NextResponse.json(
        { error: "Admin or dispatcher access required" },
        { status: 403 },
      )
    }

    // ── Parse body ──────────────────────────────────────
    const body = await request.json()
    const rows: ImportRow[] = body.rows

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided" },
        { status: 400 },
      )
    }

    if (rows.length > 2000) {
      return NextResponse.json(
        { error: "Too many rows (max 2000 per import)" },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const result: ImportResult = {
      loadsImported: 0,
      loadsUpdated: 0,
      containersCreated: 0,
      containersUpdated: 0,
      customersCreated: 0,
      driversCreated: 0,
      errors: [],
    }

    // ── Step 1: Resolve customers ───────────────────────
    const uniqueCustomerNames = [
      ...new Set(
        rows
          .map((r) => r.load.customer_name)
          .filter((n): n is string => !!n),
      ),
    ]

    const { data: existingCustomers } = await admin
      .from("customers")
      .select("id, name")

    const customerMap = new Map<string, string>()
    for (const c of existingCustomers || []) {
      customerMap.set(c.name.toLowerCase(), c.id)
    }

    for (const name of uniqueCustomerNames) {
      if (!customerMap.has(name.toLowerCase())) {
        const { data, error } = await admin
          .from("customers")
          .insert({ name })
          .select("id")
          .single()

        if (data) {
          customerMap.set(name.toLowerCase(), data.id)
          result.customersCreated++
        } else if (error) {
          // May be a race condition duplicate — try fetching
          const { data: existing } = await admin
            .from("customers")
            .select("id")
            .ilike("name", name)
            .single()
          if (existing) {
            customerMap.set(name.toLowerCase(), existing.id)
          } else {
            result.errors.push(`Customer "${name}": ${error.message}`)
          }
        }
      }
    }

    // ── Step 2: Resolve drivers ─────────────────────────
    const uniqueDriverNames = [
      ...new Set(
        rows
          .map((r) => r.load.driver_name)
          .filter((n): n is string => !!n),
      ),
    ]

    const { data: existingDrivers } = await admin
      .from("drivers")
      .select("id, name")

    const driverMap = new Map<string, string>()
    for (const d of existingDrivers || []) {
      driverMap.set(d.name.toLowerCase(), d.id)
    }

    for (const name of uniqueDriverNames) {
      if (!driverMap.has(name.toLowerCase())) {
        const { data, error } = await admin
          .from("drivers")
          .insert({ name, status: "Available" })
          .select("id")
          .single()

        if (data) {
          driverMap.set(name.toLowerCase(), data.id)
          result.driversCreated++
        } else if (error) {
          const { data: existing } = await admin
            .from("drivers")
            .select("id")
            .ilike("name", name)
            .single()
          if (existing) {
            driverMap.set(name.toLowerCase(), existing.id)
          } else {
            result.errors.push(`Driver "${name}": ${error.message}`)
          }
        }
      }
    }

    // ── Step 3: Upsert containers ───────────────────────
    const containers = rows
      .map((r) => r.container)
      .filter((c): c is MappedContainer => c !== null)

    // De-duplicate by container_number (last write wins)
    const containersByNum = new Map<string, MappedContainer>()
    for (const c of containers) {
      containersByNum.set(c.container_number.toLowerCase(), c)
    }
    const uniqueContainers = [...containersByNum.values()]

    // Check which already exist
    const existingContainerNums = new Set<string>()
    if (uniqueContainers.length > 0) {
      const { data: existing } = await admin
        .from("containers")
        .select("container_number")
        .in(
          "container_number",
          uniqueContainers.map((c) => c.container_number),
        )
      for (const e of existing || []) {
        existingContainerNums.add(e.container_number.toLowerCase())
      }
    }

    // Batch upsert containers (50 at a time)
    const BATCH_SIZE = 50
    for (let i = 0; i < uniqueContainers.length; i += BATCH_SIZE) {
      const batch = uniqueContainers.slice(i, i + BATCH_SIZE)
      const containerInserts = batch.map((c) => ({
        container_number: c.container_number,
        bol_number: c.bol_number,
        booking_number: c.booking_number,
        size: c.size,
        status: c.status,
        last_free_day: c.last_free_day,
        weight_lbs: c.weight_lbs,
        seal_number: c.seal_number,
        shipping_line: c.shipping_line,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await admin.from("containers").upsert(
        containerInserts,
        { onConflict: "container_number" },
      )

      if (error) {
        const uniqueSizes = [...new Set(containerInserts.map((c) => c.size))]
        const uniqueStatuses = [...new Set(containerInserts.map((c) => c.status))]
        console.error(`[Import] Container batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message,
          "| sizes:", uniqueSizes, "| statuses:", uniqueStatuses)
        result.errors.push(`Container batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message} (sizes: ${uniqueSizes.join(", ")} | statuses: ${uniqueStatuses.join(", ")})`)
      } else {
        for (const c of batch) {
          if (existingContainerNums.has(c.container_number.toLowerCase())) {
            result.containersUpdated++
          } else {
            result.containersCreated++
          }
        }
      }
    }

    // Refresh container ID map after upsert
    const containerMap = new Map<string, string>()
    if (uniqueContainers.length > 0) {
      const { data: allContainers } = await admin
        .from("containers")
        .select("id, container_number")
        .in(
          "container_number",
          uniqueContainers.map((c) => c.container_number),
        )
      for (const c of allContainers || []) {
        containerMap.set(c.container_number.toLowerCase(), c.id)
      }
    }

    // ── Step 4: Upsert loads ────────────────────────────
    // Check which load reference_numbers already exist
    const refNums = rows.map((r) => r.load.reference_number)
    const existingRefNums = new Set<string>()
    // Query in batches since IN clause has limits
    for (let i = 0; i < refNums.length; i += 500) {
      const batch = refNums.slice(i, i + 500)
      const { data: existing } = await admin
        .from("loads")
        .select("reference_number")
        .in("reference_number", batch)
      for (const e of existing || []) {
        existingRefNums.add(e.reference_number)
      }
    }

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const inserts = []

      for (const { load } of batch) {
        if (!load.reference_number) continue

        const customerId = load.customer_name
          ? customerMap.get(load.customer_name.toLowerCase()) || null
          : null
        const driverId = load.driver_name
          ? driverMap.get(load.driver_name.toLowerCase()) || null
          : null
        const containerId = load.container_number
          ? containerMap.get(load.container_number.toLowerCase()) || null
          : null

        inserts.push({
          reference_number: load.reference_number,
          status: safeLoadStatus(load.status),
          load_type: load.load_type,
          customer_id: customerId,
          driver_id: driverId,
          container_id: containerId,
          pickup_location: load.pickup_location,
          delivery_location: load.delivery_location,
          return_location: load.return_location,
          pickup_apt_from: load.pickup_apt_from,
          vessel_eta: load.vessel_eta,
          discharge_date: load.discharge_date,
          outgate_date: load.outgate_date,
          ingate_date: load.ingate_date,
          empty_date: load.empty_date,
          per_diem_free_day: load.per_diem_free_day,
          completed_date: load.completed_date,
          delivered_to_user_date: load.delivered_to_user_date,
          ssl: load.ssl,
          mbol: load.mbol,
          house_bol: load.house_bol,
          seal_number: load.seal_number,
          vessel_name: load.vessel_name,
          voyage: load.voyage,
          purchase_order: load.purchase_order,
          shipment_number: load.shipment_number,
          pickup_number: load.pickup_number,
          reservation_number: load.reservation_number,
          return_number: load.return_number,
          chassis_number: load.chassis_number,
          commodity: load.commodity,
          total_weight: load.total_weight,
          rate: load.rate,
          distance: load.distance,
          is_hazmat: load.is_hazmat,
          is_overweight: load.is_overweight,
          freight_hold: load.freight_hold,
          customs_hold: load.customs_hold,
          carrier_hold: load.carrier_hold,
          notes: load.notes,
          scheduled_pickup: load.scheduled_pickup,
          updated_at: new Date().toISOString(),
        })
      }

      if (inserts.length > 0) {
        const { data, error } = await admin
          .from("loads")
          .upsert(inserts, { onConflict: "reference_number" })
          .select("reference_number")

        if (error) {
          // Batch failed — fall back to row-by-row to identify the bad rows
          console.error(`[Import] Load batch ${Math.floor(i / BATCH_SIZE) + 1} failed, falling back to row-by-row:`, error.message)
          for (const row of inserts) {
            const { data: singleData, error: singleErr } = await admin
              .from("loads")
              .upsert([row], { onConflict: "reference_number" })
              .select("reference_number")

            if (singleErr) {
              result.errors.push(
                `Load ${row.reference_number}: ${singleErr.message}`,
              )
            } else if (singleData?.[0]) {
              if (existingRefNums.has(singleData[0].reference_number)) {
                result.loadsUpdated++
              } else {
                result.loadsImported++
              }
            }
          }
        } else if (data) {
          for (const d of data) {
            if (existingRefNums.has(d.reference_number)) {
              result.loadsUpdated++
            } else {
              result.loadsImported++
            }
          }
        }
      }
    }

    // ── Audit log ───────────────────────────────────────
    auditLog({
      entity_type: "import",
      entity_id: "portpro_csv",
      action: "imported",
      user_id: user.id,
      details: {
        rows: rows.length,
        loads_imported: result.loadsImported,
        loads_updated: result.loadsUpdated,
        containers_created: result.containersCreated,
        containers_updated: result.containersUpdated,
        customers_created: result.customersCreated,
        drivers_created: result.driversCreated,
        errors_count: result.errors.length,
        imported_by: user.email,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Import] Unexpected error:", error)
    const message = error instanceof Error ? error.message : "Import failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── DELETE handler: wipe existing loads & containers ────────
export async function DELETE() {
  try {
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
      return NextResponse.json(
        { error: "Admin or dispatcher access required" },
        { status: 403 },
      )
    }

    const admin = createAdminClient()

    // Delete loads first (they reference containers via FK)
    const { error: loadsErr, count: loadsDeleted } = await admin
      .from("loads")
      .delete({ count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000") // delete all — neq on impossible ID

    if (loadsErr) {
      return NextResponse.json(
        { error: `Failed to delete loads: ${loadsErr.message}` },
        { status: 500 },
      )
    }

    // Then delete containers
    const { error: containersErr, count: containersDeleted } = await admin
      .from("containers")
      .delete({ count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (containersErr) {
      return NextResponse.json(
        { error: `Failed to delete containers: ${containersErr.message}` },
        { status: 500 },
      )
    }

    // Audit log
    auditLog({
      entity_type: "import",
      entity_id: "portpro_csv",
      action: "deleted_all",
      user_id: user.id,
      details: {
        loads_deleted: loadsDeleted ?? 0,
        containers_deleted: containersDeleted ?? 0,
        deleted_by: user.email,
      },
    })

    return NextResponse.json({
      loadsDeleted: loadsDeleted ?? 0,
      containersDeleted: containersDeleted ?? 0,
    })
  } catch (error) {
    console.error("[Import DELETE] Unexpected error:", error)
    const message = error instanceof Error ? error.message : "Delete failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
