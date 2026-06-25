import { parseGeofenceCheckoutBody } from "@/lib/integrations/samsara/parse-geofence-event"
import { verifySamsaraWebhookSignature } from "@/lib/integrations/samsara/verify-webhook-signature"

describe("parseGeofenceCheckoutBody", () => {
  it("parses mock simulate payload", () => {
    const input = parseGeofenceCheckoutBody(
      {
        loadId: "load-abc",
        eventType: "geofence_exit",
        geofenceName: "Customer delivery",
        vehicleId: "veh-1",
        occurredAt: "2026-06-19T14:00:00.000Z",
      },
      "simulate",
    )

    expect(input).toEqual({
      loadId: "load-abc",
      eventType: "geofence_exit",
      occurredAt: "2026-06-19T14:00:00.000Z",
      geofenceName: "Customer delivery",
      vehicleId: "veh-1",
      source: "simulate",
    })
  })

  it("rejects non geofence_exit types", () => {
    expect(
      parseGeofenceCheckoutBody({ loadId: "x", eventType: "geofence_enter" }, "simulate"),
    ).toBeNull()
  })

  it("requires load id", () => {
    expect(parseGeofenceCheckoutBody({ eventType: "geofence_exit" }, "simulate")).toBeNull()
  })
})

describe("verifySamsaraWebhookSignature", () => {
  it("validates sha256 HMAC", () => {
    const secret = "test-secret"
    const body = '{"loadId":"load-1","eventType":"geofence_exit"}'
    const crypto = require("crypto")
    const sig = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`

    expect(verifySamsaraWebhookSignature(body, sig, secret)).toBe(true)
    expect(verifySamsaraWebhookSignature(body, "sha256=bad", secret)).toBe(false)
  })
})
