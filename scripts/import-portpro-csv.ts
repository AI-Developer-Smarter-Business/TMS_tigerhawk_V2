// scripts/import-portpro-csv.ts
// Run with: npx tsx scripts/import-portpro-csv.ts
//
// Imports PortPro CSV export into our loads table + creates missing customers/drivers

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { parse } from "csv-parse/sync"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Helpers ───────────────────────────────────────────────

function parseDate(val: string): string | null {
  if (!val || val.trim() === "") return null
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  } catch {
    return null
  }
}

function parseDateOnly(val: string): string | null {
  if (!val || val.trim() === "") return null
  // Handle MM/DD/YY format
  const match = val.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/)
  if (match) {
    let year = match[3]
    if (year.length === 2) year = "20" + year
    return `${year}-${match[1]}-${match[2]}`
  }
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split("T")[0]
  } catch {
    return null
  }
}

function parseNum(val: string): number | null {
  if (!val || val.trim() === "") return null
  const n = parseFloat(val.replace(/,/g, ""))
  return isNaN(n) ? null : n
}

function parseBool(val: string): boolean {
  const v = (val || "").toLowerCase().trim()
  return v === "yes" || v === "true" || v === "1"
}

function mapStatus(status: string): string {
  const s = (status || "").toUpperCase().trim()
  const mapping: Record<string, string> = {
    "AVAILABLE": "Available",
    "PENDING": "Pending",
    "DISPATCHED": "Dispatched",
    "DROPPED": "Delivered",
    "ENROUTE TO DROP CONTAINER": "In Transit",
    "ARRIVED AT RETURN EMPTY": "Arrived At Return Empty",
    "CUSTOMS HOLD": "Customs Hold",
    "FREIGHT RELEASED": "Freight Released",
    "IN TRANSIT": "In Transit",
    "COMPLETED": "Completed",
    "CANCELLED": "Cancelled",
  }
  return mapping[s] || "Pending"
}

function mapLoadType(move: string): string | null {
  const m = (move || "").toUpperCase().trim()
  if (m === "IMPORT") return "Import"
  if (m === "EXPORT") return "Export"
  return null
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log("📂 Reading CSV...")
  const csvContent = readFileSync("docs/container_export.csv", "utf-8")
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  })
  console.log(`   Found ${records.length} records`)

  // ─── Step 1: Ensure customers exist ─────────────────────
  console.log("\n👥 Syncing customers...")
  const uniqueCustomers = [...new Set(records.map((r: any) => r["Customer"]).filter(Boolean))] as string[]

  const { data: existingCustomers } = await supabase
    .from("customers")
    .select("id, name")

  const customerMap = new Map<string, string>()
  for (const c of existingCustomers || []) {
    customerMap.set(c.name.toLowerCase(), c.id)
  }

  let customersCreated = 0
  for (const name of uniqueCustomers) {
    if (!customerMap.has(name.toLowerCase())) {
      const { data, error } = await supabase
        .from("customers")
        .insert({ name })
        .select("id")
        .single()
      if (data) {
        customerMap.set(name.toLowerCase(), data.id)
        customersCreated++
      } else if (error) {
        console.warn(`   ⚠ Could not create customer "${name}": ${error.message}`)
      }
    }
  }
  console.log(`   ${customersCreated} new customers created, ${customerMap.size} total`)

  // ─── Step 2: Ensure drivers exist ───────────────────────
  console.log("\n🚛 Syncing drivers...")
  // Extract unique primary driver names (first driver if comma-separated)
  const driverNames = new Set<string>()
  for (const r of records) {
    const driverStr = (r["Driver"] || "").trim()
    if (driverStr) {
      // Take first driver name if multiple
      const primary = driverStr.split(",")[0].trim()
      if (primary) driverNames.add(primary)
    }
  }

  const { data: existingDrivers } = await supabase
    .from("drivers")
    .select("id, name")

  const driverMap = new Map<string, string>()
  for (const d of existingDrivers || []) {
    driverMap.set(d.name.toLowerCase(), d.id)
  }

  let driversCreated = 0
  for (const name of driverNames) {
    if (!driverMap.has(name.toLowerCase())) {
      const { data, error } = await supabase
        .from("drivers")
        .insert({ name, status: "Available" })
        .select("id")
        .single()
      if (data) {
        driverMap.set(name.toLowerCase(), data.id)
        driversCreated++
      } else if (error) {
        console.warn(`   ⚠ Could not create driver "${name}": ${error.message}`)
      }
    }
  }
  console.log(`   ${driversCreated} new drivers created, ${driverMap.size} total`)

  // ─── Step 3: Map containers ─────────────────────────────
  console.log("\n📦 Syncing containers...")
  const containerNumbers = [...new Set(records.map((r: any) => r["Container #"]).filter(Boolean))] as string[]

  const { data: existingContainers } = await supabase
    .from("containers")
    .select("id, container_number")

  const containerMap = new Map<string, string>()
  for (const c of existingContainers || []) {
    containerMap.set(c.container_number.toLowerCase(), c.id)
  }

  let containersCreated = 0
  for (const num of containerNumbers) {
    if (num && !containerMap.has(num.toLowerCase())) {
      const { data, error } = await supabase
        .from("containers")
        .insert({ container_number: num, status: "Available" })
        .select("id")
        .single()
      if (data) {
        containerMap.set(num.toLowerCase(), data.id)
        containersCreated++
      } else if (error) {
        console.warn(`   ⚠ Could not create container "${num}": ${error.message}`)
      }
    }
  }
  console.log(`   ${containersCreated} new containers created, ${containerMap.size} total`)

  // ─── Step 4: Import loads ───────────────────────────────
  console.log("\n📋 Importing loads...")

  // Check for existing loads to avoid duplicates
  const { data: existingLoads } = await supabase
    .from("loads")
    .select("reference_number")
  const existingRefs = new Set((existingLoads || []).map(l => l.reference_number))

  let imported = 0
  let skipped = 0
  let errors = 0
  const batchSize = 50

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const inserts = []

    for (const r of batch) {
      const refNum = r["Load #"]
      if (!refNum) { skipped++; continue }
      if (existingRefs.has(refNum)) { skipped++; continue }

      // Resolve FK references
      const customerName = (r["Customer"] || "").trim()
      const customerId = customerMap.get(customerName.toLowerCase()) || null

      const driverStr = (r["Driver"] || "").trim()
      const primaryDriver = driverStr ? driverStr.split(",")[0].trim() : null
      const driverId = primaryDriver ? driverMap.get(primaryDriver.toLowerCase()) || null : null

      const containerNum = (r["Container #"] || "").trim()
      const containerId = containerNum ? containerMap.get(containerNum.toLowerCase()) || null : null

      // Build the load record
      inserts.push({
        reference_number: refNum,
        status: mapStatus(r["Status"]),
        load_type: mapLoadType(r["Move"]),

        // FKs
        customer_id: customerId,
        driver_id: driverId,
        container_id: containerId,

        // Locations
        pickup_location: r["Pick Up Location"] || null,
        delivery_location: r["Delivery Location"] || null,
        return_location: r["Return Location"] || null,

        // Appointment/dates
        pickup_apt_from: parseDate(r["APT"]),
        vessel_eta: parseDate(r["ETA"]),
        discharge_date: parseDate(r["Discharged Date"]),
        outgate_date: parseDate(r["Outgate Date"]),
        ingate_date: parseDate(r["Ingate Date"]),
        empty_date: parseDate(r["Empty Date"]),
        per_diem_free_day: parseDateOnly(r["Per Diem Free Day"]),
        completed_date: parseDate(r["Load Completed At"]),
        delivered_to_user_date: parseDate(r["Deliver Load Arrived"]),

        // Shipping
        ssl: r["SSL"] || null,
        mbol: r["BOL/BKG"] || null,
        house_bol: r["House BOL"] || null,
        seal_number: r["Seal #"] || null,
        vessel_name: r["Vessel Name"] || null,
        voyage: r["Voyage"] || null,
        purchase_order: r["Purchase Order #"] || r["PO #"] || null,
        shipment_number: r["Shipment"] || null,
        pickup_number: r["Pick up #"] || r["PICKUP #"] || null,
        reservation_number: r["Reservation #"] || null,
        return_number: r["Return #"] || null,
        appointment_number: r["APT"] ? "APT" : null,

        // Equipment
        chassis_number: r["Chassis #"] || null,
        genset_number: null,
        temperature: r["Temperature"] || null,
        total_weight: parseNum(r["Total Weight"]),
        commodity: r["Commodity"] || null,
        container_size: r["Container Size"] || null,
        container_type: r["Container Type"] || null,
        chassis_size: r["Chassis Size"] || null,
        chassis_type: r["Chassis Type"] || null,
        route_template: null,

        // Flags
        is_hazmat: parseBool(r["Hazmat"]),
        is_overweight: parseBool(r["Over Weight"]),

        // Holds
        freight_hold: r["Freight"] === "Hold" ? "hold" : r["Freight"] === "Released" ? "released" : "none",
        customs_hold: r["Custom"] === "Hold" ? "hold" : r["Custom"] === "Released" ? "released" : "none",
        carrier_hold: parseBool(r["Carrier Hold"]),

        // Financial
        rate: parseNum(r["Pricing Total"]),

        // Tracking
        distance: parseNum(r["Total Distance"]),
        csr: r["CSR"] || null,

        // Notes
        notes: r["Load Notes"] || r["Driver Note"] || null,

        // Reference
        scheduled_pickup: parseDate(r["Move Assigned Date"]),
      })
    }

    if (inserts.length > 0) {
      const { data, error } = await supabase
        .from("loads")
        .insert(inserts)
        .select("id")

      if (error) {
        console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`)
        errors += inserts.length
      } else {
        imported += (data?.length || 0)
      }
    }

    // Progress indicator
    const pct = Math.round(((i + batch.length) / records.length) * 100)
    process.stdout.write(`\r   Progress: ${pct}% (${imported} imported, ${skipped} skipped, ${errors} errors)`)
  }

  console.log(`\n\n✅ Import complete!`)
  console.log(`   Imported: ${imported}`)
  console.log(`   Skipped:  ${skipped}`)
  console.log(`   Errors:   ${errors}`)
  console.log(`   Customers created: ${customersCreated}`)
  console.log(`   Drivers created:   ${driversCreated}`)
  console.log(`   Containers created: ${containersCreated}`)
}

main().catch(console.error)
