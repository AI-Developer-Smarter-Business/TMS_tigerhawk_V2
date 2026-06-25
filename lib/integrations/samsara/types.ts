/** Normalized geofence checkout event (mock today; map from Samsara webhook when API connected). */
export type GeofenceCheckoutSource = "samsara_webhook" | "simulate"

export type GeofenceCheckoutInput = {
  loadId: string
  eventType: "geofence_exit"
  occurredAt: string
  geofenceName?: string | null
  vehicleId?: string | null
  source: GeofenceCheckoutSource
}

export type GeofenceCheckoutResult = {
  ok: boolean
  integration: "mock_stub"
  pendingSamsaraApi: true
  closed: boolean
  loadId: string
  eventId?: string
  reason?: "no_open_event" | "load_not_found" | "invalid_payload" | "error"
  message?: string
}
