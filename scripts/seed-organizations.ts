/**
 * Parses CSVs from docs/organizations/ and generates SQL INSERT statements.
 *
 * Usage: npx tsx scripts/seed-organizations.ts > supabase/migrations/20260218_seed_organizations.sql
 */
import { readFileSync } from "fs"
import { join } from "path"

function parseCSV(content: string): Record<string, string>[] {
  const lines: string[] = []
  let current = ""
  let inQuotes = false

  // Handle quoted fields with commas
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if (ch === "\n" && !inQuotes) {
      lines.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  if (current.trim()) lines.push(current.trim())

  if (lines.length < 2) return []

  // Parse header
  const header = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < header.length; j++) {
      row[header[j].trim()] = (values[j] || "").trim()
    }
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function escSQL(val: string): string {
  if (!val || val.trim() === "" || val.trim() === " ") return "NULL"
  return "'" + val.replace(/'/g, "''") + "'"
}

function boolSQL(val: string): string {
  if (!val || val.trim() === "" || val.trim() === " ") return "false"
  return val.trim().toUpperCase() === "YES" ? "true" : "false"
}

function numSQL(val: string): string {
  if (!val || val.trim() === "" || val.trim() === " ") return "NULL"
  const n = parseFloat(val.trim())
  return isNaN(n) ? "NULL" : String(n)
}

function generateInserts(table: string, rows: Record<string, string>[]): string {
  if (rows.length === 0) return ""

  const lines: string[] = []
  lines.push(`-- ${table}: ${rows.length} records`)
  lines.push(`INSERT INTO ${table} (name, phone, main_contact_name, address, city, state, zip_code, customer_type, credit_limit, default_payment_terms, credit_hold, account_hold, currency)`)
  lines.push("VALUES")

  const valueLines = rows.map((r) => {
    const name = escSQL(r["COMPANY NAME"] || "")
    const phone = escSQL(r["PHONE"] || "")
    const contact = escSQL(r["MAIN CONTACT NAME"] || "")
    const address = escSQL(r["ADDRESS"] || "")
    const city = escSQL(r["CITY"] || "")
    const state = escSQL(r["STATE"] || "")
    const zip = escSQL(r["ZIP CODE"] || "")
    const custType = escSQL(r["CUSTOMER TYPE"] || "")
    const creditLimit = numSQL(r["CREDIT LIMIT"] || "")
    const payTerms = numSQL(r["DEFAULT PAYMENT TERMS"] || "")
    const creditHold = boolSQL(r["CREDIT HOLD"] || "")
    const accountHold = boolSQL(r["ACCOUNT HOLD"] || "")
    const currency = escSQL(r["CURRENCY"] || "")

    return `  (${name}, ${phone}, ${contact}, ${address}, ${city}, ${state}, ${zip}, ${custType}, ${creditLimit}, ${payTerms}, ${creditHold}, ${accountHold}, ${currency})`
  })

  lines.push(valueLines.join(",\n"))
  lines.push("ON CONFLICT (name) DO UPDATE SET")
  lines.push("  phone = COALESCE(EXCLUDED.phone, " + table + ".phone),")
  lines.push("  main_contact_name = COALESCE(EXCLUDED.main_contact_name, " + table + ".main_contact_name),")
  lines.push("  address = COALESCE(EXCLUDED.address, " + table + ".address),")
  lines.push("  city = COALESCE(EXCLUDED.city, " + table + ".city),")
  lines.push("  state = COALESCE(EXCLUDED.state, " + table + ".state),")
  lines.push("  zip_code = COALESCE(EXCLUDED.zip_code, " + table + ".zip_code),")
  lines.push("  customer_type = COALESCE(EXCLUDED.customer_type, " + table + ".customer_type),")
  lines.push("  credit_limit = COALESCE(EXCLUDED.credit_limit, " + table + ".credit_limit),")
  lines.push("  default_payment_terms = COALESCE(EXCLUDED.default_payment_terms, " + table + ".default_payment_terms),")
  lines.push("  credit_hold = COALESCE(EXCLUDED.credit_hold, " + table + ".credit_hold),")
  lines.push("  account_hold = COALESCE(EXCLUDED.account_hold, " + table + ".account_hold),")
  lines.push("  currency = COALESCE(EXCLUDED.currency, " + table + ".currency);\n")

  return lines.join("\n")
}

// Main
const docsDir = join(__dirname, "..", "docs", "organizations")

const customersCSV = readFileSync(join(docsDir, "customers.csv"), "utf-8")
const terminalsCSV = readFileSync(join(docsDir, "terminal.csv"), "utf-8")
const warehousesCSV = readFileSync(join(docsDir, "warehouse.csv"), "utf-8")
const yardsCSV = readFileSync(join(docsDir, "yard.csv"), "utf-8")

const customers = parseCSV(customersCSV)
const terminals = parseCSV(terminalsCSV)
const warehouses = parseCSV(warehousesCSV)
const yards = parseCSV(yardsCSV)

console.log("-- ============================================================")
console.log("-- Organization Seed Data (auto-generated from docs/organizations/)")
console.log("-- ============================================================\n")

// For customers, we UPDATE existing or INSERT new — use name as natural key
console.log("-- Update existing customers with organization data")
console.log(generateInserts("customers", customers))
console.log(generateInserts("terminals", terminals))
console.log(generateInserts("warehouses", warehouses))
console.log(generateInserts("yards", yards))
