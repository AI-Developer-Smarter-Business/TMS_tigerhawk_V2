// types/dispatcher.ts
// Core types for the Dispatcher module

// ─── Load Status ───────────────────────────────────────────
export type LoadStatus =
  | "Available"
  | "Available At Port"
  | "Pending"
  | "Customs Hold"
  | "Freight Released"
  | "Created"
  | "Assigned"
  | "Dispatched"
  | "In Transit"
  | "Arrived At Pickup"
  | "Arrived At Delivery"
  | "Arrived At Return Empty"
  | "Arrived To Hook Container"
  | "At Warehouse"
  | "Dropped - Empty"
  | "Dropped - Loaded"
  | "Enroute To Drop Container"
  | "Enroute To Return Empty"
  | "Delivered"
  | "Completed"
  | "Cancelled"

export type LoadType = "Import" | "Export" | "Road" | "Bill Only"

export type RouteType =
  | "Pick and Run + Live"
  | "Pick and Run + Drop & Hook"
  | "Prepull + Live"
  | "Prepull + Drop & Hook"
  | "One Way Move"
  | "Shunt"

export type HoldStatus = "none" | "hold" | "released"

export type ContainerType = "HC" | "ST" | "RF" | "OT" | "FR" | "TK"

// ─── Load (main entity) ───────────────────────────────────
export type Load = {
  id: string
  reference_number: string
  status: LoadStatus
  load_type: LoadType | null
  route_type: RouteType | null

  // Relationships (IDs)
  customer_id: string | null
  container_id: string | null
  driver_id: string | null

  // Locations
  pickup_location: string | null
  delivery_location: string | null
  return_location: string | null

  // Appointment windows
  pickup_apt_from: string | null
  pickup_apt_to: string | null
  delivery_apt_from: string | null
  delivery_apt_to: string | null
  return_apt_from: string | null
  return_apt_to: string | null

  // Timestamps
  scheduled_pickup: string | null
  actual_pickup: string | null
  actual_delivery: string | null
  created_at: string
  updated_at: string | null

  // Key dates
  vessel_eta: string | null
  discharge_date: string | null
  outgate_date: string | null
  ingate_date: string | null
  empty_date: string | null
  per_diem_free_day: string | null
  ready_to_return_date: string | null
  completed_date: string | null
  chassis_pickup_date: string | null
  chassis_termination_date: string | null
  delivered_to_user_date: string | null

  // Shipping & reference
  ssl: string | null
  mbol: string | null
  house_bol: string | null
  seal_number: string | null
  vessel_name: string | null
  voyage: string | null
  purchase_order: string | null
  shipment_number: string | null
  pickup_number: string | null
  appointment_number: string | null
  return_number: string | null
  reservation_number: string | null

  // Equipment
  container_number: string | null
  chassis_number: string | null
  genset_number: string | null
  temperature: string | null
  scac: string | null
  total_weight: number | null
  commodity: string | null
  container_size: string | null
  container_type: string | null
  chassis_size: string | null
  chassis_type: string | null
  chassis_owner: string | null
  route_template: string | null
  hook_chassis_location: string | null
  terminate_chassis_location: string | null

  // Flags
  is_hazmat: boolean
  is_hot: boolean
  is_overweight: boolean
  is_oog: boolean
  is_street_turn: boolean
  is_tanker: boolean
  is_bonded: boolean
  is_liquor: boolean
  is_ev: boolean
  is_double: boolean
  is_genset: boolean
  is_scale: boolean
  is_overheight: boolean

  // Container visibility / holds
  freight_hold: HoldStatus
  customs_hold: HoldStatus
  terminal_hold: HoldStatus
  fees_hold: HoldStatus
  carrier_hold: boolean
  freight_hold_note: string | null
  customs_hold_note: string | null
  terminal_hold_note: string | null
  fees_hold_note: string | null
  carrier_hold_note: string | null
  other_hold: HoldStatus
  other_hold_note: string | null

  // Billing (legacy columns on load)
  rate: number | null
  accessorial_charges: number | null
  detention_charges: number | null

  // Tracking & dispatch
  distance: number | null
  last_tracked: string | null
  csr: string | null

  // Driver pay
  driver_pay: number | null
  driver_pay_notes: string | null

  // Street turn
  street_turn_match_id: string | null

  // Notes
  notes: string | null
}

// ─── Load with joined relations ────────────────────────────
export type LoadWithRelations = Load & {
  customers: {
    id: string
    name: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zip_code: string | null
  } | null
  containers: {
    id: string
    container_number: string
    bol_number: string | null
    size: string | null
    type: string | null
    status: string
    last_free_day: string | null
    shipping_line: string | null
    transit_state: string | null
    seal_number: string | null
    time_in: string | null
    time_out: string | null
    stopped_road: boolean | null
    stopped_vessel: boolean | null
    stopped_rail: boolean | null
    impediment_road: string | null
    equipment_type: string | null
    ph_synced_at: string | null
    vessel_id: string | null
    vessels: {
      id: string
      name: string
      voyage_number: string | null
      eta: string | null
      terminal: string | null
      shipping_line: string | null
    } | null
  } | null
  drivers: {
    id: string
    name: string
    phone: string | null
    status: string
  } | null
}

// ─── Pipeline counts ───────────────────────────────────────
export type PipelineCounts = {
  arrivingOnVessel: number
  arrivingOnHold: number
  arrivingReleased: number
  needPickup: number
  needPickupLFD: number
  needPickupApt: number
  needDelivery: number
  needDeliveryAtTerminal: number
  needDeliveryInYard: number
  needReturn: number
  needReturnReady: number
  needReturnNotReady: number
  dropped: number
  droppedInYard: number
  droppedAtCustomer: number
  dispatched: number
  finishedToday: number
}

// ─── Sub-table types ───────────────────────────────────────
export type LoadDocument = {
  id: string
  load_id: string
  filename: string
  url: string
  storage_path: string | null
  document_type: string
  file_size: number | null
  uploaded_by: string | null
  uploaded_at: string
  created_at: string
  /** Set by GET /documents when uploader is a driver or type is Driver */
  is_driver_upload?: boolean
  uploaded_by_name?: string | null
}

export type LoadMessage = {
  id: string
  load_id: string
  sender_id: string | null
  sender_name: string | null
  message: string
  created_at: string
}

export type LoadAuditEntry = {
  id: string
  load_id: string
  user_id: string | null
  user_name: string | null
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_at: string
}

export type LoadBillingCharge = {
  id: string
  load_id: string
  charge_type: string
  description: string | null
  amount: number
  created_at: string
  updated_at: string
}

export type LoadPayment = {
  id: string
  load_id: string
  payment_type: string
  amount: number
  reference: string | null
  paid_at: string | null
  created_at: string
}

export type FreightDescription = {
  id: string
  load_id: string
  commodity: string | null
  description: string | null
  pieces: number | null
  weight_lbs: number | null
  weight_kgs: number | null
  pallets: number | null
  created_at: string
}

// ─── Driver Itinerary ──────────────────────────────────────
export type DriverWithLoads = {
  id: string
  name: string
  phone: string | null
  status: string
  currentLoad: {
    reference_number: string
    pickup_location: string | null
    status: LoadStatus
  } | null
  activeLoadCount: number
}

export type DriverEvent = {
  load_reference: string
  container_number: string | null
  chassis_number: string | null
  event_type: "Hook Container" | "Pick Up Container" | "Deliver Container" | "Drop Container" | "Return Container"
  status: string
  load_assigned_date: string | null
  company: string | null
  address: string | null
}

// ─── Street Turns ──────────────────────────────────────────
export type SSLGroup = {
  ssl: string
  containerSize: string
  importCount: number
  exportCount: number
  imports: LoadWithRelations[]
  exports: LoadWithRelations[]
}

// ─── Problem Container types ───────────────────────────────
export type ProblemType = "problem" | "demurrage" | "missed_cutoff" | "empty_return_closed"

// ─── Filter state ──────────────────────────────────────────
export type DispatcherFilters = {
  search: string
  showAvailable: boolean
  showPending: boolean
  statuses: LoadStatus[]
  loadTypes: LoadType[]
  drivers: string[]
  customers: string[]
  dateFrom: string | null
  dateTo: string | null
  pipelineFilter: string | null
}

// ─── Status colors ─────────────────────────────────────────
export const LOAD_STATUS_COLORS: Record<LoadStatus, { bg: string; text: string; border: string }> = {
  "Available": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "Available At Port": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "Pending": { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  "Customs Hold": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  "Freight Released": { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/20" },
  "Created": { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" },
  "Assigned": { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  "Dispatched": { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  "In Transit": { bg: "bg-[#E8700A]/10", text: "text-[#FF8C21]", border: "border-[#E8700A]/20" },
  "Arrived At Pickup": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  "Arrived At Delivery": { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  "Arrived At Return Empty": { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  "Arrived To Hook Container": { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  "At Warehouse": { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  "Dropped - Empty": { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" },
  "Dropped - Loaded": { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" },
  "Enroute To Drop Container": { bg: "bg-[#E8700A]/10", text: "text-[#FF8C21]", border: "border-[#E8700A]/20" },
  "Enroute To Return Empty": { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  "Delivered": { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  "Completed": { bg: "bg-emerald-600/10", text: "text-emerald-300", border: "border-emerald-600/20" },
  "Cancelled": { bg: "bg-red-600/10", text: "text-red-300", border: "border-red-600/20" },
}

// ─── Valid status transitions ──────────────────────────────
export const VALID_LOAD_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  "Available": ["Assigned", "Dispatched", "Cancelled"],
  "Available At Port": ["Assigned", "Dispatched", "Cancelled"],
  "Pending": ["Available", "Available At Port", "Assigned", "Cancelled"],
  "Customs Hold": ["Freight Released", "Available", "Cancelled"],
  "Freight Released": ["Available", "Available At Port", "Assigned", "Cancelled"],
  "Created": ["Available", "Available At Port", "Assigned", "Cancelled"],
  "Assigned": ["Dispatched", "Available", "Created", "Cancelled"],
  "Dispatched": ["In Transit", "Arrived At Pickup", "Arrived To Hook Container", "Assigned", "Cancelled"],
  "In Transit": ["Arrived At Delivery", "At Warehouse", "Delivered", "Dispatched", "Cancelled"],
  "Arrived At Pickup": ["In Transit", "Dispatched", "Cancelled"],
  "Arrived At Delivery": ["Delivered", "Dropped - Loaded", "In Transit", "Cancelled"],
  "Arrived At Return Empty": ["Completed", "In Transit", "Cancelled"],
  "Arrived To Hook Container": ["In Transit", "Enroute To Drop Container", "Dispatched", "Cancelled"],
  "At Warehouse": ["In Transit", "Delivered", "Cancelled"],
  "Dropped - Empty": ["Arrived To Hook Container", "Enroute To Return Empty", "Completed", "Cancelled"],
  "Dropped - Loaded": ["Enroute To Return Empty", "Dropped - Empty", "Completed", "Cancelled"],
  "Enroute To Drop Container": ["Arrived At Delivery", "Dropped - Loaded", "Dropped - Empty", "Cancelled"],
  "Enroute To Return Empty": ["Arrived At Return Empty", "Completed", "Cancelled"],
  "Delivered": ["Completed", "Arrived At Return Empty", "Enroute To Return Empty", "Dropped - Empty", "In Transit", "Cancelled"],
  "Completed": [],
  "Cancelled": [],
}
