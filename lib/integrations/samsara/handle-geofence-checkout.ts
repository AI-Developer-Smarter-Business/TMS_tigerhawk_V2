import type { SupabaseClient } from "@supabase/supabase-js"

import { closeOpenDeliveryWaitEvent } from "@/lib/wait-time/close-open-delivery-wait"
import type {
  GeofenceCheckoutInput,
  GeofenceCheckoutResult,
} from "@/lib/integrations/samsara/types"

const GEOFENCE_AUTO_STOP_ACTION = "delivery_wait_geofence_auto_stop"

async function logGeofenceAutoStop(
  adminSupabase: SupabaseClient,
  params: {
    loadId: string
    referenceNumber: string | null
    eventId: string
    actorUserId: string
    input: GeofenceCheckoutInput
  },
): Promise<void> {
  const { data: existing } = await adminSupabase
    .from("activity_log")
    .select("id")
    .eq("entity_type", "waiting_time_event")
    .eq("entity_id", params.eventId)
    .eq("action", GEOFENCE_AUTO_STOP_ACTION)
    .limit(1)
    .maybeSingle()

  if (existing) return

  await adminSupabase.from("activity_log").insert({
    entity_type: "waiting_time_event",
    entity_id: params.eventId,
    action: GEOFENCE_AUTO_STOP_ACTION,
    user_id: params.actorUserId,
    details: {
      type: "samsara_geofence_checkout",
      source: params.input.source,
      integration: "mock_stub",
      pending_samsara_api: true,
      load_id: params.loadId,
      reference_number: params.referenceNumber,
      event_id: params.eventId,
      geofence_name: params.input.geofenceName,
      vehicle_id: params.input.vehicleId,
      occurred_at: params.input.occurredAt,
    },
  })
}

/** WT.23 — close open delivery wait when driver exits customer geofence (mock / webhook). */
export async function handleGeofenceCheckout(
  adminSupabase: SupabaseClient,
  input: GeofenceCheckoutInput,
): Promise<GeofenceCheckoutResult> {
  const { data: load, error: loadError } = await adminSupabase
    .from("loads")
    .select("id, reference_number, driver_id, status")
    .eq("id", input.loadId)
    .maybeSingle()

  if (loadError) {
    return {
      ok: false,
      integration: "mock_stub",
      pendingSamsaraApi: true,
      closed: false,
      loadId: input.loadId,
      reason: "error",
      message: loadError.message,
    }
  }

  if (!load) {
    return {
      ok: false,
      integration: "mock_stub",
      pendingSamsaraApi: true,
      closed: false,
      loadId: input.loadId,
      reason: "load_not_found",
      message: "Load not found",
    }
  }

  const actorUserId = (load.driver_id as string | null) ?? input.loadId
  const note = `[${input.source}] Geofence exit${
    input.geofenceName ? `: ${input.geofenceName}` : ""
  } — auto-stopped wait timer (Samsara API pending).`

  const closeResult = await closeOpenDeliveryWaitEvent(adminSupabase, {
    loadId: input.loadId,
    endTime: input.occurredAt,
    actorUserId,
    appendNotes: note,
  })

  if (closeResult.status === "no_open_event") {
    return {
      ok: true,
      integration: "mock_stub",
      pendingSamsaraApi: true,
      closed: false,
      loadId: input.loadId,
      reason: "no_open_event",
      message: "No open delivery_wait event on this load",
    }
  }

  if (closeResult.status === "error") {
    return {
      ok: false,
      integration: "mock_stub",
      pendingSamsaraApi: true,
      closed: false,
      loadId: input.loadId,
      reason: "error",
      message: closeResult.message,
    }
  }

  const eventId = closeResult.event.id as string

  await logGeofenceAutoStop(adminSupabase, {
    loadId: input.loadId,
    referenceNumber: (load.reference_number as string | null) ?? null,
    eventId,
    actorUserId,
    input,
  })

  return {
    ok: true,
    integration: "mock_stub",
    pendingSamsaraApi: true,
    closed: true,
    loadId: input.loadId,
    eventId,
  }
}
