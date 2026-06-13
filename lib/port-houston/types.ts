// lib/port-houston/types.ts
// TypeScript interfaces for Port Houston Navis N4/EVP API responses

// ============================================================
// Vessel Visit Payload
// ============================================================
// PH API returns timestamps as either epoch milliseconds (number) or ISO strings
type PHTimestamp = string | number

export interface PHVesselVisit {
  visitId: string
  vesName: string
  vesId: string
  vesclassId?: string
  vesclassName?: string
  vesselType?: string
  visitPhase?: string
  serviceId?: string
  serviceName?: string
  lineId?: string
  lineName?: string
  ibVyg?: string
  obVyg?: string
  eta?: PHTimestamp
  etd?: PHTimestamp
  ata?: PHTimestamp
  atd?: PHTimestamp
  publishedEta?: PHTimestamp
  publishedEtd?: PHTimestamp
  startWork?: PHTimestamp
  endWork?: PHTimestamp
  cargoCutoff?: PHTimestamp
  reeferCutoff?: PHTimestamp
  hazCutoff?: PHTimestamp
  beginReceive?: PHTimestamp
  timeFirstAvailability?: PHTimestamp
  timeDischargeComplete?: PHTimestamp
  facility?: string
  notes?: string
  berths?: PHBerth[]
  lines?: PHVesselLine[]
  estMoveCount?: {
    estDischarge?: number
    estLoad?: number
    estRestow?: number
    estShift?: number
  }
}

export interface PHBerth {
  seq?: number
  quayId?: string
  eta?: PHTimestamp
  etd?: PHTimestamp
  ata?: PHTimestamp
  atd?: PHTimestamp
}

export interface PHVesselLine {
  lineId?: string
  lineInVoyNbr?: string
  lineOutVoyNbr?: string
  cargoCutoff?: PHTimestamp
  beginReceive?: PHTimestamp
}

// ============================================================
// Unit (Container) Payload
// ============================================================
export interface PHUnit {
  unitId: string
  unitGkey?: number
  ufvGkey?: number
  category?: string // IMPRT, EXPRT, EMPTY, etc.
  freightKind?: string // FCL, MTY, etc.
  transitState?: string // S20_INBOUND, S40_YARD, S60_LOADED, S70_DEPARTED
  visitState?: string
  line?: string
  eqtypeId?: string // 40HC, 20GP, 45HC, etc.
  nominalLength?: string // NOM20, NOM40, NOM45
  isoGroup?: string
  blNbr?: string
  drayStatus?: string
  routing?: PHRouting
  stopFlags?: {
    stoppedVessel?: boolean
    stoppedRail?: boolean
    stoppedRoad?: boolean
  }
  impediments?: {
    impedimentRail?: string
    impedimentVessel?: string
    impedimentRoad?: string
  }
  contents?: {
    goodsAndCtrWtKg?: number
    goodsAndCtrWtKgAdvised?: number
    goodsAndCtrWtKgVerifiedGross?: number
  }
  seals?: {
    sealNbr1?: string
    sealNbr2?: string
    sealNbr3?: string
    sealNbr4?: string
  }
  ufvBilling?: {
    lastFreeDay?: PHTimestamp
    paidThruDay?: PHTimestamp
    lineLastFreeDay?: PHTimestamp
    guaranteeThruDay?: PHTimestamp
  }
  timestamps?: {
    timeIn?: PHTimestamp
    timeOut?: PHTimestamp
    timeOfLoading?: PHTimestamp
    timeOfLastMove?: PHTimestamp
    createTime?: PHTimestamp
    timeLastStateChange?: PHTimestamp
    timeComplete?: PHTimestamp
  }
  lastKnownPosition?: {
    posLocType?: string
    posLocId?: string
    posName?: string
  }
  actualIbVisit?: PHVisitRef
  actualObVisit?: PHVisitRef
  scope?: {
    facility_id?: string
  }
}

export interface PHRouting {
  declaredIbVisit?: PHVisitRef
  declaredObVisit?: PHVisitRef
  intendedObVisit?: PHVisitRef
  actualIbVisit?: PHVisitRef
  actualObVisit?: PHVisitRef
  truckingCompanyId?: string
  pod1Id?: string
  polId?: string
  groupId?: string
}

export interface PHVisitRef {
  visitId?: string
  cvGkey?: number
  visitGkey?: number
  carrierMode?: string
}

// ============================================================
// API Response Wrappers
// ============================================================
export interface PHPagedResponse<T> {
  content: T[]
  paging?: {
    next?: string
  }
}

export interface PHTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope: string
}

// ============================================================
// Internal Sync Types
// ============================================================
export interface SyncResult {
  vessels: number
  containers: number
  errors: string[]
}
