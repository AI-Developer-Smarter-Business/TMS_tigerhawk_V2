import type { SupabaseClient } from "@supabase/supabase-js"

import { closeOpenDeliveryWaitEvent } from "@/lib/wait-time/close-open-delivery-wait"

export const POD_SIGNED_SUBMITTED_ACTION = "pod_signed_submitted"

export type PodSignedSubmittedSource = "document_upload" | "api" | "e_sign"

export type PodSignedSubmittedInput = {
  loadId: string
  submittedAt?: string
  source: PodSignedSubmittedSource
  actorUserId: string
  documentId?: string
  documentFilename?: string
  requestedDocumentType?: string
}

export type PodSignedSubmittedResult = {
  ok: boolean
  closed: boolean
  loadId: string
  eventId?: string
  reason?: "no_open_event" | "load_not_found" | "error"
  message?: string
}

export function buildPodSignedNote(
  input: Pick<
    PodSignedSubmittedInput,
    "source" | "documentFilename" | "requestedDocumentType"
  >,
): string {
  const label =
    input.source === "document_upload"
      ? "POD document submitted"
      : input.source === "api"
        ? "POD signed (API)"
        : "e-POD signed and submitted"
  const file = input.documentFilename ? ` — ${input.documentFilename}` : ""
  return `[WT.28] ${label}${file} — auto-stopped delivery wait timer.`
}

async function logPodSignedSubmitted(
  adminSupabase: SupabaseClient,
  params: {
    loadId: string
    referenceNumber: string | null
    eventId: string
    actorUserId: string
    input: PodSignedSubmittedInput
  },
): Promise<void> {
  const { data: existing } = await adminSupabase
    .from("activity_log")
    .select("id")
    .eq("entity_type", "waiting_time_event")
    .eq("entity_id", params.eventId)
    .eq("action", POD_SIGNED_SUBMITTED_ACTION)
    .limit(1)
    .maybeSingle()

  if (existing) return

  await adminSupabase.from("activity_log").insert({
    entity_type: "waiting_time_event",
    entity_id: params.eventId,
    action: POD_SIGNED_SUBMITTED_ACTION,
    user_id: params.actorUserId,
    details: {
      type: "pod_signed_submitted",
      source: params.input.source,
      load_id: params.loadId,
      reference_number: params.referenceNumber,
      event_id: params.eventId,
      document_id: params.input.documentId ?? null,
      document_filename: params.input.documentFilename ?? null,
      requested_document_type: params.input.requestedDocumentType ?? null,
      submitted_at: params.input.submittedAt ?? new Date().toISOString(),
    },
  })
}

/** WT.28 — close open delivery wait when POD is signed/submitted (upload or API). */
export async function handlePodSignedSubmitted(
  adminSupabase: SupabaseClient,
  input: PodSignedSubmittedInput,
): Promise<PodSignedSubmittedResult> {
  const { data: load, error: loadError } = await adminSupabase
    .from("loads")
    .select("id, reference_number, driver_id")
    .eq("id", input.loadId)
    .maybeSingle()

  if (loadError) {
    return {
      ok: false,
      closed: false,
      loadId: input.loadId,
      reason: "error",
      message: loadError.message,
    }
  }

  if (!load) {
    return {
      ok: false,
      closed: false,
      loadId: input.loadId,
      reason: "load_not_found",
      message: "Load not found",
    }
  }

  const submittedAt = input.submittedAt ?? new Date().toISOString()
  const note = buildPodSignedNote(input)

  const closeResult = await closeOpenDeliveryWaitEvent(adminSupabase, {
    loadId: input.loadId,
    endTime: submittedAt,
    actorUserId: input.actorUserId,
    appendNotes: note,
  })

  if (closeResult.status === "no_open_event") {
    return {
      ok: true,
      closed: false,
      loadId: input.loadId,
      reason: "no_open_event",
      message: "No open delivery_wait event on this load",
    }
  }

  if (closeResult.status === "error") {
    return {
      ok: false,
      closed: false,
      loadId: input.loadId,
      reason: "error",
      message: closeResult.message,
    }
  }

  const eventId = closeResult.event.id as string

  await logPodSignedSubmitted(adminSupabase, {
    loadId: input.loadId,
    referenceNumber: (load.reference_number as string | null) ?? null,
    eventId,
    actorUserId: input.actorUserId,
    input: { ...input, submittedAt },
  })

  return {
    ok: true,
    closed: true,
    loadId: input.loadId,
    eventId,
  }
}
