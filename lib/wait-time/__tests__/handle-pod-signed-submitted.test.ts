import {
  buildPodSignedNote,
  handlePodSignedSubmitted,
  POD_SIGNED_SUBMITTED_ACTION,
} from "@/lib/wait-time/handle-pod-signed-submitted"
import { closeOpenDeliveryWaitEvent } from "@/lib/wait-time/close-open-delivery-wait"

jest.mock("@/lib/wait-time/close-open-delivery-wait", () => ({
  closeOpenDeliveryWaitEvent: jest.fn(),
}))

const mockClose = closeOpenDeliveryWaitEvent as jest.MockedFunction<
  typeof closeOpenDeliveryWaitEvent
>

describe("buildPodSignedNote", () => {
  it("formats document upload note with filename", () => {
    expect(
      buildPodSignedNote({
        source: "document_upload",
        documentFilename: "pod-scan.jpg",
        requestedDocumentType: "POD",
      }),
    ).toContain("POD document submitted")
    expect(
      buildPodSignedNote({
        source: "document_upload",
        documentFilename: "pod-scan.jpg",
        requestedDocumentType: "POD",
      }),
    ).toContain("pod-scan.jpg")
    expect(
      buildPodSignedNote({
        source: "document_upload",
        documentFilename: "pod-scan.jpg",
        requestedDocumentType: "POD",
      }),
    ).toContain("WT.28")
  })

  it("formats API source note", () => {
    expect(buildPodSignedNote({ source: "api" })).toContain("POD signed (API)")
  })
})

describe("handlePodSignedSubmitted", () => {
  const loadId = "load-1"
  const actorUserId = "user-driver"
  const submittedAt = "2026-06-24T12:00:00.000Z"

  function makeSupabase(load: Record<string, unknown> | null) {
    const activityInsert = jest.fn().mockResolvedValue({ error: null })
    const activitySelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    })

    return {
      from: jest.fn((table: string) => {
        if (table === "loads") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: load,
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "activity_log") {
          return {
            select: activitySelect,
            insert: activityInsert,
          }
        }
        throw new Error(`unexpected table ${table}`)
      }),
      activityInsert,
    } as unknown as import("@supabase/supabase-js").SupabaseClient & {
      activityInsert: jest.Mock
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("closes open wait and logs pod_signed_submitted", async () => {
    mockClose.mockResolvedValue({
      status: "closed",
      event: { id: "evt-99", load_id: loadId },
    })

    const supabase = makeSupabase({
      id: loadId,
      reference_number: "REF-100",
      driver_id: actorUserId,
    })

    const result = await handlePodSignedSubmitted(supabase, {
      loadId,
      submittedAt,
      source: "api",
      actorUserId,
      documentId: "doc-1",
    })

    expect(result).toEqual({
      ok: true,
      closed: true,
      loadId,
      eventId: "evt-99",
    })
    expect(mockClose).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        loadId,
        endTime: submittedAt,
        actorUserId,
        appendNotes: expect.stringContaining("WT.28"),
      }),
    )
    expect(supabase.activityInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "waiting_time_event",
        entity_id: "evt-99",
        action: POD_SIGNED_SUBMITTED_ACTION,
        user_id: actorUserId,
      }),
    )
  })

  it("returns no_open_event without error when timer already closed", async () => {
    mockClose.mockResolvedValue({ status: "no_open_event" })

    const supabase = makeSupabase({
      id: loadId,
      reference_number: "REF-100",
      driver_id: actorUserId,
    })

    const result = await handlePodSignedSubmitted(supabase, {
      loadId,
      source: "document_upload",
      actorUserId,
    })

    expect(result).toEqual({
      ok: true,
      closed: false,
      loadId,
      reason: "no_open_event",
      message: "No open delivery_wait event on this load",
    })
  })

  it("returns load_not_found when load missing", async () => {
    const supabase = makeSupabase(null)

    const result = await handlePodSignedSubmitted(supabase, {
      loadId,
      source: "api",
      actorUserId,
    })

    expect(result.reason).toBe("load_not_found")
    expect(mockClose).not.toHaveBeenCalled()
  })
})
