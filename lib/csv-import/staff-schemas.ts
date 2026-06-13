import { z } from "zod"

const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v

const optionalTrimmed = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
)

const optionalTrimmedNullable = z.preprocess((v) => {
  const u = emptyToUndefined(v)
  if (u === undefined) return null
  const s = String(u).trim()
  return s === "" ? null : s
}, z.string().nullable().optional())

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v
  if (v === undefined || v === null || v === "") return true
  const s = String(v).trim().toLowerCase()
  if (["false", "0", "no", "n"].includes(s)) return false
  return true
}

const csvBoolean = z.preprocess(parseBool, z.boolean())

const payTypes = ["per_move", "hourly", "per_mile", "percentage", "flat"] as const

/** One row after PapaParse (string values from CSV). */
export const driverCsvRowSchema = z
  .object({
    id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    first_name: optionalTrimmedNullable,
    last_name: optionalTrimmedNullable,
    name: optionalTrimmedNullable,
    phone: z.preprocess(
      (v) => (v === null || v === undefined ? "" : String(v).trim()),
      z.string().min(1, "phone is required"),
    ),
    email: optionalTrimmedNullable,
    username: optionalTrimmedNullable,
    truck_number: optionalTrimmedNullable,
    truck_owner: optionalTrimmedNullable,
    plates: optionalTrimmedNullable,
    license_number: optionalTrimmedNullable,
    license_state: optionalTrimmedNullable,
    license_expiry: optionalTrimmedNullable,
    medical_expiry: optionalTrimmedNullable,
    twic_expiry: optionalTrimmedNullable,
    date_of_birth: optionalTrimmedNullable,
    date_of_hire: optionalTrimmedNullable,
    emergency_contact: optionalTrimmedNullable,
    emergency_phone: optionalTrimmedNullable,
    use_for_pre_appointments: z.preprocess(parseBool, z.boolean()).optional(),
    enabled: z.preprocess(parseBool, z.boolean()).optional(),
    status: z.preprocess(
      (v) => emptyToUndefined(v) ?? "Available",
      z.string().trim().min(1),
    ),
    notes: optionalTrimmedNullable,
  })
  .superRefine((row, ctx) => {
    const hasName = row.name && row.name.length > 0
    const hasFirstLast =
      row.first_name &&
      row.first_name.length > 0 &&
      row.last_name &&
      row.last_name.length > 0
    if (!hasName && !hasFirstLast) {
      ctx.addIssue({
        code: "custom",
        message: "Provide name or both first_name and last_name",
        path: ["name"],
      })
    }
  })

export type DriverCsvRow = z.infer<typeof driverCsvRowSchema>

export const driverGroupCsvRowSchema = z.object({
  id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  name: z.preprocess(
    (v) => (v === null || v === undefined ? "" : String(v).trim()),
    z.string().min(1, "name is required"),
  ),
  pay_type: z.preprocess(
    (v) => String(v ?? "").trim().toLowerCase(),
    z.enum(payTypes),
  ),
  base_rate: z.coerce.number().finite(),
  is_company_driver: z.preprocess(parseBool, z.boolean()).optional(),
  default_service_type: optionalTrimmedNullable,
  notes: optionalTrimmedNullable,
  rate_profile_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  /** Resolved server-side from rate_profile_name when present */
  rate_profile_name: optionalTrimmed,
})

export type DriverGroupCsvRow = z.infer<typeof driverGroupCsvRowSchema>

export type CsvImportEntity = "drivers" | "driver_groups"

export function parseDriverCsvRows(
  rows: Record<string, unknown>[],
): { ok: true; data: DriverCsvRow[] } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const data: DriverCsvRow[] = []
  const phones = new Map<string, number>()
  rows.forEach((raw, i) => {
    const rowNum = i + 2
    const p = String(raw.phone ?? raw.Phone ?? "").trim()
    if (p) {
      phones.set(p, (phones.get(p) || 0) + 1)
    }
    const r = driverCsvRowSchema.safeParse(raw)
    if (!r.success) {
      errors.push(
        `Row ${rowNum}: ${r.error.issues.map((x) => x.message).join("; ")}`,
      )
      return
    }
    data.push(r.data)
  })
  for (const [phone, count] of phones) {
    if (count > 1) {
      errors.push(`Duplicate phone in file (${count}×): ${phone}`)
    }
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, data }
}

export function parseDriverGroupCsvRows(
  rows: Record<string, unknown>[],
): { ok: true; data: DriverGroupCsvRow[] } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const data: DriverGroupCsvRow[] = []
  rows.forEach((raw, i) => {
    const rowNum = i + 2
    const r = driverGroupCsvRowSchema.safeParse(raw)
    if (!r.success) {
      errors.push(
        `Row ${rowNum}: ${r.error.issues.map((x) => x.message).join("; ")}`,
      )
      return
    }
    data.push(r.data)
  })
  if (errors.length) return { ok: false, errors }
  return { ok: true, data }
}

/** Shape sent to Postgres RPC (JSON-serializable). */
export function driverRowToRpcPayload(row: DriverCsvRow): Record<string, unknown> {
  const displayName =
    row.name?.trim() ||
    `${row.first_name || ""} ${row.last_name || ""}`.trim() ||
    "Driver"
  return {
    id: row.id ?? null,
    name: displayName,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    phone: row.phone,
    email: row.email ?? null,
    username: row.username ?? null,
    truck_number: row.truck_number ?? null,
    truck_owner: row.truck_owner ?? null,
    plates: row.plates ?? null,
    license_number: row.license_number ?? null,
    license_state: row.license_state ?? null,
    license_expiry: row.license_expiry ?? null,
    medical_expiry: row.medical_expiry ?? null,
    twic_expiry: row.twic_expiry ?? null,
    date_of_birth: row.date_of_birth ?? null,
    date_of_hire: row.date_of_hire ?? null,
    emergency_contact: row.emergency_contact ?? null,
    emergency_phone: row.emergency_phone ?? null,
    use_for_pre_appointments: row.use_for_pre_appointments ?? false,
    enabled: row.enabled ?? true,
    status: row.status || "Available",
    notes: row.notes ?? null,
  }
}

export function driverGroupRowToRpcPayload(
  row: DriverGroupCsvRow,
): Record<string, unknown> {
  return {
    id: row.id ?? null,
    name: row.name.trim(),
    pay_type: row.pay_type,
    base_rate: row.base_rate,
    is_company_driver: row.is_company_driver ?? false,
    default_service_type: row.default_service_type ?? null,
    notes: row.notes ?? null,
    rate_profile_id: row.rate_profile_id ?? null,
  }
}
