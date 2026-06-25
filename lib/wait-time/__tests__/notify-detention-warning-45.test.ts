import {
  buildDetentionWarning45Variables,
  maybeNotifyDetentionWarning45,
  shouldSendDetentionWarning45,
} from "@/lib/wait-time/notify-detention-warning-45"
import { resolveWaitEventDurationMinutes } from "@/lib/wait-time/resolve-event-duration-minutes"
import { DETENTION_WARNING_45_EMAIL_SENT_ACTION } from "@/lib/wait-time/constants"

jest.mock("@/lib/email/sendTemplateEmail", () => ({
  sendTemplateEmail: jest.fn(),
}))

import { sendTemplateEmail } from "@/lib/email/sendTemplateEmail"

const mockSend = sendTemplateEmail as jest.MockedFunction<typeof sendTemplateEmail>

describe("resolveWaitEventDurationMinutes", () => {
  it("uses max of stored duration and wall clock for open events", () => {
    const start = new Date("2026-06-24T10:00:00.000Z").toISOString()
    const nowMs = new Date("2026-06-24T10:50:00.000Z").getTime()

    expect(
      resolveWaitEventDurationMinutes(
        { start_time: start, end_time: null, duration_minutes: 44 },
        nowMs,
      ),
    ).toBe(50)
  })
})

describe("shouldSendDetentionWarning45", () => {
  const start = "2026-06-24T10:00:00.000Z"

  it("returns true for open delivery_wait at 45+ minutes", () => {
    const nowMs = new Date("2026-06-24T10:45:00.000Z").getTime()
    expect(
      shouldSendDetentionWarning45(
        {
          event_name: "delivery_wait",
          start_time: start,
          end_time: null,
          duration_minutes: 45,
        },
        nowMs,
      ),
    ).toBe(true)
  })

  it("returns false before 45 minutes", () => {
    const nowMs = new Date("2026-06-24T10:44:00.000Z").getTime()
    expect(
      shouldSendDetentionWarning45(
        {
          event_name: "delivery_wait",
          start_time: start,
          end_time: null,
          duration_minutes: 44,
        },
        nowMs,
      ),
    ).toBe(false)
  })

  it("returns false for closed events", () => {
    expect(
      shouldSendDetentionWarning45({
        event_name: "delivery_wait",
        start_time: start,
        end_time: "2026-06-24T11:00:00.000Z",
        duration_minutes: 60,
      }),
    ).toBe(false)
  })

  it("returns false for non delivery_wait events", () => {
    expect(
      shouldSendDetentionWarning45({
        event_name: "pickup_wait",
        start_time: start,
        end_time: null,
        duration_minutes: 50,
      }),
    ).toBe(false)
  })
})

describe("buildDetentionWarning45Variables", () => {
  it("computes minutes until billable from free time", () => {
    const vars = buildDetentionWarning45Variables(
      {
        id: "load-1",
        reference_number: "REF-9",
        delivery_location: "Port Newark",
        customers: { name: "Acme", email: "a@acme.com", phone: null },
        containers: { container_number: "MSCU123" },
      },
      {
        id: "evt-1",
        load_id: "load-1",
        event_name: "delivery_wait",
        start_time: "2026-06-24T10:00:00.000Z",
        end_time: null,
        duration_minutes: 45,
        free_time_minutes: 60,
      },
      45,
    )

    expect(vars.reference_number).toBe("REF-9")
    expect(vars.minutes_elapsed).toBe("45")
    expect(vars.minutes_until_billable).toBe("15")
    expect(vars.free_minutes).toBe("60")
  })
})

describe("maybeNotifyDetentionWarning45", () => {
  const event = {
    id: "evt-1",
    load_id: "load-1",
    event_name: "delivery_wait",
    start_time: "2026-06-24T10:00:00.000Z",
    end_time: null,
    duration_minutes: 45,
    free_time_minutes: 60,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockSend.mockResolvedValue({ success: true, messageId: "msg-1" })
  })

  it("sends email once and logs activity", async () => {
    const activityInsert = jest.fn().mockResolvedValue({ error: null })
    const activitySelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    })

    const adminSupabase = {
      from: jest.fn((table: string) => {
        if (table === "activity_log") {
          return { select: activitySelect, insert: activityInsert }
        }
        if (table === "loads") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: "load-1",
                    reference_number: "REF-9",
                    delivery_location: "Site",
                    customers: { name: "Acme", email: "cust@test.com", phone: null },
                    containers: { container_number: "BOX1" },
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        throw new Error(table)
      }),
    } as unknown as import("@supabase/supabase-js").SupabaseClient

    const sent = await maybeNotifyDetentionWarning45(adminSupabase, event, "user-1")

    expect(sent).toBe(true)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "detention_warning_45",
        to: "cust@test.com",
      }),
    )
    expect(activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: DETENTION_WARNING_45_EMAIL_SENT_ACTION,
      }),
    )
  })
})
