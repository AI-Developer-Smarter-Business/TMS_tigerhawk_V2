/**
 * Helpers for load-level holds (freight, customs, terminal, fees, other, carrier).
 * Aligned with Testing Plan / Handoff: active holds should block status transitions
 * unless an admin override applies (see API route).
 */

export type LoadHoldSnapshot = {
  freight_hold?: string | null
  customs_hold?: string | null
  terminal_hold?: string | null
  fees_hold?: string | null
  other_hold?: string | null
  carrier_hold?: boolean | null
}

const ACTIVE = "hold"

/** Returns hold field names that are currently blocking (status === "hold" or carrier true). */
export function getActiveHoldKeys(load: LoadHoldSnapshot): string[] {
  const keys: string[] = []
  if (load.freight_hold === ACTIVE) keys.push("freight_hold")
  if (load.customs_hold === ACTIVE) keys.push("customs_hold")
  if (load.terminal_hold === ACTIVE) keys.push("terminal_hold")
  if (load.fees_hold === ACTIVE) keys.push("fees_hold")
  if (load.other_hold === ACTIVE) keys.push("other_hold")
  if (load.carrier_hold === true) keys.push("carrier_hold")
  return keys
}
