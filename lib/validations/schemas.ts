import { z } from "zod"

// ═══════════════════════════════════════════════════════════════════
// Primitive validators
// ═══════════════════════════════════════════════════════════════════

export const uuidSchema = z.string().uuid("Must be a valid UUID")

/** Accepts ISO-8601 date or datetime strings (e.g. "2025-01-15" or "2025-01-15T10:30:00Z") */
export const isoDateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/,
    "Must be a valid ISO date (YYYY-MM-DD or full ISO-8601)",
  )

/** Coerces string → number, rejects NaN/Infinity, must be > 0 */
export const positiveNumberSchema = z.coerce
  .number({ error: "Must be a number" })
  .positive("Must be greater than zero")
  .finite("Must be a finite number")

/** Coerces string → number, rejects NaN/Infinity, must be >= 0 */
export const nonNegativeNumberSchema = z.coerce
  .number({ error: "Must be a number" })
  .nonnegative("Must not be negative")
  .finite("Must be a finite number")

/** Maximum monetary value to prevent absurd entries */
const MAX_MONEY = 9_999_999.99

export const moneySchema = z.coerce
  .number({ error: "Must be a number" })
  .nonnegative("Must not be negative")
  .max(MAX_MONEY, `Must not exceed ${MAX_MONEY.toLocaleString()}`)
  .finite("Must be a finite number")

export const positiveMoneySchema = z.coerce
  .number({ error: "Must be a number" })
  .positive("Must be greater than zero")
  .max(MAX_MONEY, `Must not exceed ${MAX_MONEY.toLocaleString()}`)
  .finite("Must be a finite number")

/** Safe string with configurable max length — trims whitespace */
export function safeString(maxLen: number) {
  return z.string().max(maxLen, `Must be at most ${maxLen} characters`).trim()
}

// ═══════════════════════════════════════════════════════════════════
// Enum validators  (must stay in sync with types/dispatcher.ts)
// ═══════════════════════════════════════════════════════════════════

export const loadTypeSchema = z.enum(
  ["Import", "Export", "Road", "Bill Only"],
  { error: "Invalid load type" },
)

export const routeTypeSchema = z.enum(
  [
    "Pick and Run + Live",
    "Pick and Run + Drop & Hook",
    "Prepull + Live",
    "Prepull + Drop & Hook",
    "One Way Move",
    "Shunt",
  ],
  { error: "Invalid route type" },
)

export const loadStatusSchema = z.enum(
  [
    "Available", "Available At Port", "Pending", "Customs Hold",
    "Freight Released", "Created", "Assigned", "Dispatched",
    "In Transit", "Arrived At Pickup", "Arrived At Delivery",
    "Arrived At Return Empty", "Arrived To Hook Container",
    "At Warehouse", "Dropped - Empty", "Dropped - Loaded",
    "Enroute To Drop Container", "Enroute To Return Empty",
    "Delivered", "Completed", "Cancelled",
  ],
  { error: "Invalid load status" },
)

export const containerTypeSchema = z.enum(
  ["HC", "ST", "RF", "OT", "FR", "TK"],
  { error: "Invalid container type" },
)

export const containerSizeSchema = z.enum(
  ["20", "40", "45", "53"],
  { error: "Invalid container size" },
)

export const holdStatusSchema = z.enum(
  ["none", "hold", "released"],
  { error: "Invalid hold status" },
)

export const chargeTypeSchema = z.enum(
  ["Base Rate", "Accessorial", "Detention", "Storage", "Demurrage", "Other"],
  { error: "Invalid charge type" },
)

export const paymentTypeSchema = z.enum(
  ["Cash", "Check", "ACH", "Wire Transfer", "Credit", "Other"],
  { error: "Invalid payment type" },
)

export const billingStatusSchema = z.enum(
  ["Drafted", "Sent", "Partial", "Paid", "Overdue", "Voided"],
  { error: "Invalid billing status" },
)

export const settlementStatusSchema = z.enum(
  ["Pending", "Reviewed", "Finalized", "Paid"],
  { error: "Invalid settlement status" },
)

export const driverPayStatusSchema = z.enum(
  ["Unapproved", "Approved", "Settled", "Paid"],
  { error: "Invalid driver pay status" },
)

export const deductionStatusSchema = z.enum(
  ["Unapproved", "Approved", "Settled"],
  { error: "Invalid deduction status" },
)

export const paymentMethodSchema = z.enum(
  ["Check", "ACH", "Wire Transfer", "Credit Card", "Cash", "Other"],
  { error: "Invalid payment method" },
)

// ═══════════════════════════════════════════════════════════════════
// Container number (ISO 6346)
// ═══════════════════════════════════════════════════════════════════

export const containerNumberSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{4}\d{7}$/i, "Must be a valid container number (4 letters + 7 digits)")

// ═══════════════════════════════════════════════════════════════════
// Composite schemas — Dispatcher Loads
// ═══════════════════════════════════════════════════════════════════

export const createLoadSchema = z.object({
  customer_id: uuidSchema,
  container_id: uuidSchema.optional().nullable(),
  driver_id: uuidSchema.optional().nullable(),
  load_type: loadTypeSchema.optional().default("Import"),
  route_type: routeTypeSchema.optional().nullable(),
  pickup_location: safeString(500).optional().nullable(),
  delivery_location: safeString(500).optional().nullable(),
  return_location: safeString(500).optional().nullable(),
  scheduled_pickup: isoDateSchema.optional().nullable(),
  chassis_number: safeString(50).optional().nullable(),
  rate: moneySchema.optional().nullable(),
  notes: safeString(5000).optional().nullable(),
  pickup_apt_from: isoDateSchema.optional().nullable(),
  pickup_apt_to: isoDateSchema.optional().nullable(),
  delivery_apt_from: isoDateSchema.optional().nullable(),
  delivery_apt_to: isoDateSchema.optional().nullable(),
  ssl: safeString(20).optional().nullable(),
  mbol: safeString(100).optional().nullable(),
  house_bol: safeString(100).optional().nullable(),
  is_hazmat: z.boolean().optional().default(false),
  is_hot: z.boolean().optional().default(false),
  is_overweight: z.boolean().optional().default(false),
  is_oog: z.boolean().optional().default(false),
  is_street_turn: z.boolean().optional().default(false),
  is_tanker: z.boolean().optional().default(false),
  is_bonded: z.boolean().optional().default(false),
  is_liquor: z.boolean().optional().default(false),
  is_ev: z.boolean().optional().default(false),
  is_double: z.boolean().optional().default(false),
  is_genset: z.boolean().optional().default(false),
  is_scale: z.boolean().optional().default(false),
})

/** For PATCH — all fields optional, validated when present */
export const updateLoadSchema = z.object({
  // FK references
  customer_id: uuidSchema.optional(),
  container_id: uuidSchema.optional().nullable(),
  driver_id: uuidSchema.optional().nullable(),
  load_type: loadTypeSchema.optional(),
  route_type: routeTypeSchema.optional().nullable(),
  // Locations
  pickup_location: safeString(500).optional().nullable(),
  delivery_location: safeString(500).optional().nullable(),
  return_location: safeString(500).optional().nullable(),
  // Dates
  scheduled_pickup: isoDateSchema.optional().nullable(),
  pickup_apt_from: isoDateSchema.optional().nullable(),
  pickup_apt_to: isoDateSchema.optional().nullable(),
  delivery_apt_from: isoDateSchema.optional().nullable(),
  delivery_apt_to: isoDateSchema.optional().nullable(),
  return_apt_from: isoDateSchema.optional().nullable(),
  return_apt_to: isoDateSchema.optional().nullable(),
  vessel_eta: isoDateSchema.optional().nullable(),
  discharge_date: isoDateSchema.optional().nullable(),
  outgate_date: isoDateSchema.optional().nullable(),
  delivered_to_user_date: isoDateSchema.optional().nullable(),
  empty_date: isoDateSchema.optional().nullable(),
  per_diem_free_day: isoDateSchema.optional().nullable(),
  ingate_date: isoDateSchema.optional().nullable(),
  ready_to_return_date: isoDateSchema.optional().nullable(),
  completed_date: isoDateSchema.optional().nullable(),
  chassis_pickup_date: isoDateSchema.optional().nullable(),
  chassis_termination_date: isoDateSchema.optional().nullable(),
  last_free_day: isoDateSchema.optional().nullable(),
  // Financials
  rate: moneySchema.optional().nullable(),
  // Distance (miles — typically calculated via OSRM routing)
  distance: nonNegativeNumberSchema.optional().nullable(),
  // Equipment
  chassis_number: safeString(50).optional().nullable(),
  container_number: safeString(20).optional().nullable(),
  container_size: containerSizeSchema.optional().nullable(),
  container_type: containerTypeSchema.optional().nullable(),
  chassis_size: safeString(10).optional().nullable(),
  chassis_type: safeString(20).optional().nullable(),
  chassis_owner: safeString(100).optional().nullable(),
  genset_number: safeString(50).optional().nullable(),
  temperature: z.coerce.number().finite().optional().nullable(),
  route_template: safeString(200).optional().nullable(),
  hook_chassis_location: safeString(300).optional().nullable(),
  terminate_chassis_location: safeString(300).optional().nullable(),
  scac: safeString(10).optional().nullable(),
  // Reference / shipping
  ssl: safeString(20).optional().nullable(),
  mbol: safeString(100).optional().nullable(),
  house_bol: safeString(100).optional().nullable(),
  reference_number: safeString(100).optional().nullable(),
  vessel_name: safeString(200).optional().nullable(),
  voyage: safeString(100).optional().nullable(),
  purchase_order: safeString(100).optional().nullable(),
  shipment_number: safeString(100).optional().nullable(),
  pickup_number: safeString(100).optional().nullable(),
  appointment_number: safeString(100).optional().nullable(),
  return_number: safeString(100).optional().nullable(),
  reservation_number: safeString(100).optional().nullable(),
  seal_number: safeString(50).optional().nullable(),
  notes: safeString(5000).optional().nullable(),
  // Holds
  // carrier_hold is a boolean column (checkbox in Load Info), unlike other hold fields.
  carrier_hold: z.boolean().optional().nullable(),
  carrier_hold_note: safeString(500).optional().nullable(),
  freight_hold: holdStatusSchema.optional().nullable(),
  freight_hold_note: safeString(500).optional().nullable(),
  customs_hold: holdStatusSchema.optional().nullable(),
  customs_hold_note: safeString(500).optional().nullable(),
  terminal_hold: holdStatusSchema.optional().nullable(),
  terminal_hold_note: safeString(500).optional().nullable(),
  fees_hold: holdStatusSchema.optional().nullable(),
  fees_hold_note: safeString(500).optional().nullable(),
  other_hold: holdStatusSchema.optional().nullable(),
  other_hold_note: safeString(500).optional().nullable(),
  // Boolean flags
  is_hazmat: z.boolean().optional(),
  is_hot: z.boolean().optional(),
  is_overweight: z.boolean().optional(),
  is_oog: z.boolean().optional(),
  is_street_turn: z.boolean().optional(),
  is_tanker: z.boolean().optional(),
  is_bonded: z.boolean().optional(),
  is_liquor: z.boolean().optional(),
  is_ev: z.boolean().optional(),
  is_double: z.boolean().optional(),
  is_genset: z.boolean().optional(),
  is_scale: z.boolean().optional(),
  is_overheight: z.boolean().optional(),
}).strict()

export const statusChangeSchema = z.object({
  status: loadStatusSchema,
})

export const assignDriverSchema = z.object({
  driver_id: uuidSchema,
})

// ═══════════════════════════════════════════════════════════════════
// Freight descriptions (bulk PUT)
// ═══════════════════════════════════════════════════════════════════

export const freightRowSchema = z.object({
  id: uuidSchema.optional(),
  commodity: safeString(500).optional().nullable(),
  description: safeString(500).optional().nullable(),
  pieces: nonNegativeNumberSchema.optional().nullable(),
  weight_lbs: nonNegativeNumberSchema.optional().nullable(),
  weight_kgs: nonNegativeNumberSchema.optional().nullable(),
  pallets: nonNegativeNumberSchema.optional().nullable(),
})

export const updateFreightSchema = z.object({
  freight: z.array(freightRowSchema).max(100, "Too many freight rows"),
})

// ═══════════════════════════════════════════════════════════════════
// Load billing
// ═══════════════════════════════════════════════════════════════════

export const createBillingSchema = z.object({
  charge_type: chargeTypeSchema,
  amount: moneySchema,
  description: safeString(500).optional().nullable(),
})

export const updateBillingSchema = z.object({
  charge_id: uuidSchema,
  charge_type: chargeTypeSchema.optional(),
  amount: moneySchema.optional(),
  description: safeString(500).optional().nullable(),
})

// ═══════════════════════════════════════════════════════════════════
// Load payments
// ═══════════════════════════════════════════════════════════════════

export const createLoadPaymentSchema = z.object({
  payment_type: paymentTypeSchema,
  amount: positiveMoneySchema,
  reference: safeString(200).optional().nullable(),
  paid_at: isoDateSchema.optional().nullable(),
})

// ═══════════════════════════════════════════════════════════════════
// Shipments (same core structure as loads)
// ═══════════════════════════════════════════════════════════════════

export const createShipmentSchema = z.object({
  customer_id: uuidSchema,
  container_id: uuidSchema.optional().nullable(),
  driver_id: uuidSchema.optional().nullable(),
  load_type: loadTypeSchema.optional(),
  route_type: routeTypeSchema.optional().nullable(),
  pickup_location: safeString(500).optional().nullable(),
  delivery_location: safeString(500).optional().nullable(),
  return_location: safeString(500).optional().nullable(),
  scheduled_pickup: isoDateSchema.optional().nullable(),
  chassis_number: safeString(50).optional().nullable(),
  rate: moneySchema.optional().nullable(),
  notes: safeString(5000).optional().nullable(),
})

/** For PATCH on shipments — subset of load fields plus shipment-specific charges */
export const updateShipmentSchema = z.object({
  customer_id: uuidSchema.optional(),
  container_id: uuidSchema.optional().nullable(),
  driver_id: uuidSchema.optional().nullable(),
  load_type: loadTypeSchema.optional(),
  route_type: routeTypeSchema.optional().nullable(),
  pickup_location: safeString(500).optional().nullable(),
  delivery_location: safeString(500).optional().nullable(),
  return_location: safeString(500).optional().nullable(),
  scheduled_pickup: isoDateSchema.optional().nullable(),
  chassis_number: safeString(50).optional().nullable(),
  rate: moneySchema.optional().nullable(),
  accessorial_charges: moneySchema.optional().nullable(),
  detention_charges: moneySchema.optional().nullable(),
  notes: safeString(5000).optional().nullable(),
})

// ═══════════════════════════════════════════════════════════════════
// Accounts Payable
// ═══════════════════════════════════════════════════════════════════

export const createDriverPaySchema = z.object({
  driver_id: uuidSchema,
  amount: z.coerce.number().finite("Must be a finite number"),
  load_id: uuidSchema.optional().nullable(),
  container_number: safeString(20).optional().nullable(),
  truck_number: safeString(50).optional().nullable(),
  owner: safeString(200).optional().nullable(),
  load_status: safeString(50).optional().nullable(),
  from_location: safeString(500).optional().nullable(),
  to_location: safeString(500).optional().nullable(),
  pay_date: isoDateSchema.optional().nullable(),
  status: driverPayStatusSchema.optional(),
  settlement_id: uuidSchema.optional().nullable(),
  notes: safeString(2000).optional().nullable(),
})

export const createSettlementSchema = z
  .object({
    driver_id: uuidSchema,
    period_start: isoDateSchema,
    period_end: isoDateSchema,
    settlement_number: safeString(50).optional().nullable(),
    fleet_owner: safeString(200).optional().nullable(),
    truck_number: safeString(50).optional().nullable(),
    status: settlementStatusSchema.optional(),
  })
  .refine((data) => data.period_end >= data.period_start, {
    message: "period_end must be on or after period_start",
    path: ["period_end"],
  })

export const createDeductionSchema = z.object({
  driver_id: uuidSchema,
  deduction_type: safeString(100),
  amount: z.coerce.number().finite("Must be a finite number"),
  final_amount: z.coerce.number().finite().optional().nullable(),
  settlement_id: uuidSchema.optional().nullable(),
  description: safeString(500).optional().nullable(),
  unit_of_measure: safeString(50).optional(),
  math_operation: safeString(50).optional(),
  deduction_date: isoDateSchema.optional().nullable(),
  status: deductionStatusSchema.optional(),
})

// ═══════════════════════════════════════════════════════════════════
// Accounts Receivable
// ═══════════════════════════════════════════════════════════════════

export const createInvoiceSchema = z.object({
  invoice_number: safeString(50),
  customer_id: uuidSchema,
  amount: positiveMoneySchema,
  load_id: uuidSchema.optional().nullable(),
  invoice_date: isoDateSchema.optional().nullable(),
  due_date: isoDateSchema.optional().nullable(),
  billing_status: billingStatusSchema.optional(),
})

/** Consolidate load-level A/R lines (default: Approved, unpaid) into one Billed invoice per customer. */
export const arBatchInvoicesCommitSchema = z.object({
  customer_ids: z.array(uuidSchema).optional(),
  source_billing_status: z.enum(["Approved"]).optional().default("Approved"),
})

const invoiceApplicationSchema = z.object({
  invoice_id: uuidSchema,
  applied_amount: positiveMoneySchema,
})

export const createARPaymentSchema = z.object({
  customer_id: uuidSchema,
  amount: positiveMoneySchema,
  invoice_applications: z
    .array(invoiceApplicationSchema)
    .min(1, "At least one invoice application is required"),
  payment_number: safeString(50).optional().nullable(),
  payment_date: isoDateSchema.optional().nullable(),
  payment_method: paymentMethodSchema.optional(),
  check_number: safeString(50).optional().nullable(),
  deposit_type: safeString(50).optional().nullable(),
  note: safeString(2000).optional().nullable(),
})

// ═══════════════════════════════════════════════════════════════════
// Container tracking
// ═══════════════════════════════════════════════════════════════════

export const trackContainerSchema = z.object({
  container_number: containerNumberSchema,
  container_id: uuidSchema.optional().nullable(),
  load_id: uuidSchema.optional().nullable(),
})

// ═══════════════════════════════════════════════════════════════════
// Document uploads
// ═══════════════════════════════════════════════════════════════════

export const documentTypeSchema = z.enum(
  [
    "BOL", "POD", "Rate Confirmation", "Invoice", "Weight Ticket",
    "Customs", "Packing List", "Photo", "Driver", "Other",
  ],
  { error: "Invalid document type" },
)

// ═══════════════════════════════════════════════════════════════════
// Email template send
// ═══════════════════════════════════════════════════════════════════

export const sendEmailSchema = z.object({
  templateKey: safeString(200),
  to: z.string().email("Invalid email address"),
  variables: z.record(z.string(), z.string()).optional(),
})
