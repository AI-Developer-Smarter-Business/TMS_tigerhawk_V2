import type { GeofenceCheckoutInput } from "@/lib/integrations/samsara/types"

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function readNestedString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null
  return readString((value as Record<string, unknown>)[key])
}

/**
 * Parse mock or placeholder Samsara webhook body into normalized checkout input.
 * Replace mapping when real Samsara payload schema is confirmed from prod.
 */
export function parseGeofenceCheckoutBody(
  body: unknown,
  source: GeofenceCheckoutInput["source"],
): GeofenceCheckoutInput | null {
  if (!body || typeof body !== "object") return null

  const record = body as Record<string, unknown>
  let loadId =
    readString(record.loadId) ??
    readString(record.load_id)

  if (!loadId && record.externalIds && typeof record.externalIds === "object") {
    const externalIds = record.externalIds as Record<string, unknown>
    loadId = readString(externalIds.loadId)
  }

  if (!loadId) return null

  const eventTypeRaw =
    readString(record.eventType) ??
    readString(record.event_type) ??
    readString(record.type)

  if (eventTypeRaw && eventTypeRaw !== "geofence_exit") {
    return null
  }

  const occurredAt =
    readString(record.occurredAt) ??
    readString(record.occurred_at) ??
    readString(record.timestamp) ??
    new Date().toISOString()

  return {
    loadId,
    eventType: "geofence_exit",
    occurredAt,
    geofenceName:
      readString(record.geofenceName) ??
      readString(record.geofence_name) ??
      readNestedString(record.geofence, "name"),
    vehicleId:
      readString(record.vehicleId) ??
      readString(record.vehicle_id) ??
      readNestedString(record.vehicle, "id"),
    source,
  }
}
