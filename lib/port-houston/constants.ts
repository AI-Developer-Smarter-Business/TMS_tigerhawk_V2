// lib/port-houston/constants.ts
// Shared constants for Port Houston API integration

// Fields we request from PH for containers/units
export const UNIT_FIELDS = [
  "unitId",
  "category",
  "freightKind",
  "transitState",
  "visitState",
  "line",
  "eqtypeId",
  "nominalLength",
  "blNbr",
  "drayStatus",
  "routing.declaredIbVisit",
  "routing.actualIbVisit",
  "stopFlags",
  "impediments",
  "contents.goodsAndCtrWtKg",
  "ufvBilling.lastFreeDay",
  "ufvBilling.paidThruDay",
  "timestamps.timeIn",
  "timestamps.timeOut",
  "seals",
]
