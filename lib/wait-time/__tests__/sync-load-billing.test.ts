import {
  buildWaitEventBillingDescription,
  waitEventBillingTag,
} from "@/lib/wait-time/sync-load-billing"
import {
  DELIVERY_WAIT_INVOICE_CHARGE_TYPE,
  DELIVERY_WAIT_INVOICE_LINE_LABEL,
} from "@/lib/wait-time/invoice-labels"

describe("invoice-labels (WT.25)", () => {
  it("uses Detention charge type aligned to BillingTab", () => {
    expect(DELIVERY_WAIT_INVOICE_CHARGE_TYPE).toBe("Detention")
    expect(DELIVERY_WAIT_INVOICE_LINE_LABEL).toBe("Delivery detention")
  })
})

describe("buildWaitEventBillingDescription", () => {
  it("formats delivery_wait with customer-facing detention label", () => {
    const description = buildWaitEventBillingDescription({
      id: "evt-1",
      event_name: "delivery_wait",
      duration_minutes: 90,
      free_time_minutes: 60,
      charge_amount: 37.5,
      billable: true,
      end_time: "2026-06-10T13:30:00.000Z",
    })

    expect(description).toContain(DELIVERY_WAIT_INVOICE_LINE_LABEL)
    expect(description).toContain("30 min billable")
    expect(description).toContain("90 min total")
    expect(description).toContain(waitEventBillingTag("evt-1"))
  })

  it("keeps technical event name for non-delivery wait events", () => {
    const description = buildWaitEventBillingDescription({
      id: "evt-2",
      event_name: "pickup_wait",
      duration_minutes: 45,
      free_time_minutes: 60,
      charge_amount: 0,
      billable: false,
      end_time: "2026-06-10T13:00:00.000Z",
    })

    expect(description).toContain("pickup_wait")
    expect(description).not.toContain(DELIVERY_WAIT_INVOICE_LINE_LABEL)
  })
})
