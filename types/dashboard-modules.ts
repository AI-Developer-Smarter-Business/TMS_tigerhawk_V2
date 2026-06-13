// types/dashboard-modules.ts
// Configuration types for the modular dashboard system

export type DashboardModuleId =
  | "per_diem_lfd"
  | "holds"
  | "appointments"
  | "ar_aging"
  | "load_pipeline"
  | "driver_summary"
  | "recent_shipments"
  | "incoming_vessels"
  | "warehouse_summary"

export type ModuleSize = "small" | "medium" | "large"

export interface DashboardModuleDef {
  id: DashboardModuleId
  label: string
  description: string
  defaultEnabled: boolean
  /** Grid size: small=1col, medium=1col, large=2col on lg screens */
  size: ModuleSize
  /** Only show for these roles (empty = all roles) */
  staffOnly: boolean
}

export interface DashboardModuleLayout {
  id: DashboardModuleId
  enabled: boolean
  order: number
}

/** The full module registry — every available module */
export const MODULE_REGISTRY: DashboardModuleDef[] = [
  {
    id: "per_diem_lfd",
    label: "Per Diem / LFD",
    description: "Loads approaching or past their last free day",
    defaultEnabled: true,
    size: "medium",
    staffOnly: true,
  },
  {
    id: "holds",
    label: "Holds Dashboard",
    description: "Loads with active freight, customs, terminal, or fee holds",
    defaultEnabled: true,
    size: "medium",
    staffOnly: true,
  },
  {
    id: "appointments",
    label: "Today's Appointments",
    description: "Pickup and delivery appointments scheduled for today",
    defaultEnabled: true,
    size: "medium",
    staffOnly: true,
  },
  {
    id: "ar_aging",
    label: "AR Aging",
    description: "Outstanding invoices grouped by aging buckets",
    defaultEnabled: true,
    size: "medium",
    staffOnly: true,
  },
  {
    id: "load_pipeline",
    label: "Load Pipeline",
    description: "Load counts grouped by status stage",
    defaultEnabled: true,
    size: "medium",
    staffOnly: true,
  },
  {
    id: "driver_summary",
    label: "Driver Summary",
    description: "Condensed driver availability counts",
    defaultEnabled: true,
    size: "small",
    staffOnly: true,
  },
  {
    id: "recent_shipments",
    label: "Recent Shipments",
    description: "Latest shipments with status and assignment",
    defaultEnabled: true,
    size: "large",
    staffOnly: false,
  },
  {
    id: "incoming_vessels",
    label: "Incoming Vessels",
    description: "Vessels with upcoming ETAs",
    defaultEnabled: true,
    size: "medium",
    staffOnly: true,
  },
  {
    id: "warehouse_summary",
    label: "Warehouse Summary",
    description: "Baytown warehouse capacity and activity",
    defaultEnabled: true,
    size: "medium",
    staffOnly: true,
  },
]

/** Get default layout for a role */
export function getDefaultLayout(isStaff: boolean): DashboardModuleLayout[] {
  return MODULE_REGISTRY
    .filter((m) => isStaff || !m.staffOnly)
    .map((m, i) => ({
      id: m.id,
      enabled: m.defaultEnabled,
      order: i,
    }))
}

/** Preference key for dashboard module config */
export const DASHBOARD_MODULES_PREF_KEY = "dashboard_modules"
