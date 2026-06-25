jest.mock("@/lib/email/resendClient", () => ({
  DEFAULT_FROM: "TigerHawk TMS <noreply@test.com>",
  sendResendEmailWithRetry: jest.fn(),
  getResend: jest.fn(),
}))

jest.mock("@/lib/email/sendTemplateEmail", () => ({
  sendTemplateEmail: jest.fn(),
}))

import {
  buildDetentionStartedVariables,
  shouldSendDetentionStarted,
} from "@/lib/wait-time/notify-detention-started"
import {
  buildDetentionCompletedVariables,
  shouldSendDetentionCompleted,
} from "@/lib/wait-time/notify-detention-completed"
import { shouldAlertForgottenDeliveryWait } from "@/lib/wait-time/forgotten-delivery-wait"
import { resolveWaitEventDurationMinutes } from "@/lib/wait-time/resolve-event-duration-minutes"

describe("shouldSendDetentionStarted", () => {
  const start = "2026-06-25T10:00:00.000Z"

  it("returns true at 60 minutes", () => {
    const nowMs = Date.parse("2026-06-25T11:00:00.000Z")
    expect(
      shouldSendDetentionStarted(
        {
          event_name: "delivery_wait",
          start_time: start,
          end_time: null,
          duration_minutes: 60,
          free_time_minutes: 60,
        },
        nowMs,
      ),
    ).toBe(true)
  })

  it("returns false before free time ends", () => {
    const nowMs = Date.parse("2026-06-25T10:59:00.000Z")
    expect(
      shouldSendDetentionStarted(
        {
          event_name: "delivery_wait",
          start_time: start,
          end_time: null,
          duration_minutes: 59,
          free_time_minutes: 60,
        },
        nowMs,
      ),
    ).toBe(false)
  })
})

describe("shouldSendDetentionCompleted", () => {
  it("requires end_time", () => {
    expect(
      shouldSendDetentionCompleted({
        event_name: "delivery_wait",
        start_time: "2026-06-25T10:00:00.000Z",
        end_time: "2026-06-25T11:30:00.000Z",
      }),
    ).toBe(true)
  })
})

describe("buildDetentionStartedVariables", () => {
  it("includes billable minutes and charge", () => {
    const vars = buildDetentionStartedVariables(
      {
        id: "load-1",
        reference_number: "REF-1",
        delivery_location: "Site",
        customers: { name: "Acme", email: "a@acme.com", phone: null },
        containers: { container_number: "BOX1" },
      },
      {
        id: "evt-1",
        load_id: "load-1",
        event_name: "delivery_wait",
        start_time: "2026-06-25T10:00:00.000Z",
        end_time: null,
        duration_minutes: 75,
        free_time_minutes: 60,
        charge_amount: 18.75,
      },
      75,
    )

    expect(vars.billable_minutes).toBe("15")
    expect(vars.estimated_charge).toBe("$18.75")
  })
})

describe("buildDetentionCompletedVariables", () => {
  it("includes start and end timestamps", () => {
    const vars = buildDetentionCompletedVariables(
      {
        id: "load-1",
        reference_number: "REF-1",
        delivery_location: "Site",
        customers: { name: "Acme", email: "a@acme.com", phone: null },
        containers: null,
      },
      {
        id: "evt-1",
        load_id: "load-1",
        event_name: "delivery_wait",
        start_time: "2026-06-25T10:00:00.000Z",
        end_time: "2026-06-25T11:30:00.000Z",
        duration_minutes: 90,
        free_time_minutes: 60,
        charge_amount: 37.5,
      },
      90,
    )

    expect(vars.total_minutes).toBe("90")
    expect(vars.billable_minutes).toBe("30")
    expect(vars.wait_end_time.length).toBeGreaterThan(0)
  })
})

describe("shouldAlertForgottenDeliveryWait", () => {
  it("alerts when duration exceeds configured max", () => {
    const start = "2026-06-24T10:00:00.000Z"
    const nowMs = Date.parse("2026-06-24T19:00:00.000Z")
    expect(
      shouldAlertForgottenDeliveryWait(
        {
          event_name: "delivery_wait",
          start_time: start,
          end_time: null,
          duration_minutes: 540,
        },
        nowMs,
      ),
    ).toBe(true)
  })
})

describe("resolveWaitEventDurationMinutes", () => {
  it("prefers wall clock for open events", () => {
    const start = "2026-06-25T10:00:00.000Z"
    const nowMs = Date.parse("2026-06-25T11:05:00.000Z")
    expect(
      resolveWaitEventDurationMinutes(
        { start_time: start, end_time: null, duration_minutes: 30 },
        nowMs,
      ),
    ).toBe(65)
  })
})
