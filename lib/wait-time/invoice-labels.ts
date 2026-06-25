/**
 * WT.25 — Customer invoice wording for delivery wait overage.
 *
 * One billable concept: slow unload at customer delivery (`delivery_wait` events).
 * - Customer invoice / load_billing → **Detention** (charge_type + description label).
 * - Driver mobile / settlements → **Wait time** (separate UX; see mobile spec).
 *
 * ACC-WAIT in accessorials catalog is a manual add-on; auto-synced lines use Detention only.
 */

/** Must match `load_billing.charge_type` enum in BillingTab and validations. */
export const DELIVERY_WAIT_INVOICE_CHARGE_TYPE = "Detention" as const

/** Customer-facing line label in load_billing.description (PDF / A/R). */
export const DELIVERY_WAIT_INVOICE_LINE_LABEL = "Delivery detention" as const

export type DeliveryWaitInvoiceChargeType = typeof DELIVERY_WAIT_INVOICE_CHARGE_TYPE
