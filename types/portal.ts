// types/portal.ts
// Types for the Customer Portal

import { LoadStatus } from "./dispatcher"

// ─── Portal Load ──────────────────────────────────────────────
// Flexible type for portal loads — supports both full and partial selects
// from Supabase. Uses Record<string, unknown> as base so partial selects
// pass type checks, with well-known fields typed explicitly.
export type PortalLoad = {
  id: string
  reference_number: string
  status: string
  load_type: string | null
  route_type?: string | null
  container_size?: string | null
  ssl?: string | null
  pickup_location?: string | null
  delivery_location?: string | null
  return_location?: string | null
  vessel_eta?: string | null
  vessel_name?: string | null
  actual_pickup?: string | null
  actual_delivery?: string | null
  created_at: string
  updated_at?: string | null
  completed_date?: string | null
  discharge_date?: string | null
  customer_id?: string | null
  container_id?: string | null
  driver_id?: string | null
  container_number?: string | null
  chassis_number?: string | null
  seal_number?: string | null
  commodity?: string | null
  total_weight?: number | null
  shipment_number?: string | null
  purchase_order?: string | null
  mbol?: string | null
  house_bol?: string | null
  notes?: string | null
  pickup_apt_from?: string | null
  delivery_apt_from?: string | null
  per_diem_free_day?: string | null
  outgate_date?: string | null
  is_hazmat?: boolean
  is_hot?: boolean
  is_overweight?: boolean
  freight_hold?: string
  customs_hold?: string
  terminal_hold?: string
  fees_hold?: string
  containers?: {
    id: string
    container_number: string
    bol_number?: string | null
    size?: string | null
    type?: string | null
    status?: string
    last_free_day?: string | null
    shipping_line?: string | null
    transit_state?: string | null
    seal_number?: string | null
    time_in?: string | null
    time_out?: string | null
    stopped_road?: boolean | null
    stopped_vessel?: boolean | null
    stopped_rail?: boolean | null
    impediment_road?: string | null
    equipment_type?: string | null
    ph_synced_at?: string | null
    vessel_id?: string | null
    vessels?: {
      id: string
      name: string
      voyage_number?: string | null
      eta?: string | null
      terminal?: string | null
      shipping_line?: string | null
    } | null
  } | null
  customers?: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    zip_code?: string | null
  } | null
  drivers?: {
    id: string
    name: string
    phone?: string | null
    status?: string
  } | null
  [key: string]: unknown // Allow additional fields from Supabase
}

// ─── Portal Document ──────────────────────────────────────────
export type PortalDocument = {
  id: string
  load_id: string
  filename: string
  url: string
  storage_path: string | null
  document_type: string
  file_size: number | null
  uploaded_at: string
  uploaded_by: string | null
  // Joined from load
  load_reference_number?: string
}

// ─── Portal Customer ─────────────────────────────────────────
export type PortalCustomer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

// ─── Portal Dashboard Summary ────────────────────────────────
export type PortalSummary = {
  activeLoads: number
  inTransit: number
  deliveredLast30: number
  pending: number
}

// ─── Statuses considered "active" (not completed/cancelled) ──
export const ACTIVE_LOAD_STATUSES: LoadStatus[] = [
  "Available",
  "Available At Port",
  "Pending",
  "Customs Hold",
  "Freight Released",
  "Created",
  "Assigned",
  "Dispatched",
  "In Transit",
  "Arrived At Pickup",
  "Arrived At Delivery",
  "Arrived At Return Empty",
  "Arrived To Hook Container",
  "At Warehouse",
  "Dropped - Empty",
  "Dropped - Loaded",
  "Enroute To Drop Container",
  "Enroute To Return Empty",
  "Delivered",
]

// ─── Statuses considered "completed" (historical) ────────────
export const COMPLETED_LOAD_STATUSES: LoadStatus[] = [
  "Completed",
  "Cancelled",
]

// ─── Statuses considered "in transit" ────────────────────────
export const IN_TRANSIT_STATUSES: LoadStatus[] = [
  "Dispatched",
  "In Transit",
  "Arrived At Pickup",
  "Arrived At Delivery",
  "Arrived At Return Empty",
  "Arrived To Hook Container",
  "Enroute To Drop Container",
  "Enroute To Return Empty",
]
