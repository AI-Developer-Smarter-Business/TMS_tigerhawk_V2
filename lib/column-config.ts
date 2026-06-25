// lib/column-config.ts
// Canonical column definitions for the Dispatcher LoadsTable

export type ColumnDef = {
  key: string;
  label: string;
  defaultVisible: boolean;
  /** Sort key used by useTableSort – if different from `key`, specify here */
  sortKey?: string;
  /** If true, this column cannot be hidden (e.g. checkbox, row number) */
  locked?: boolean;
  /** Width hint for the column (Tailwind class or px) */
  minWidth?: string;
};

/**
 * Full list of dispatcher table columns in display order.
 * `key` is used as the stable identifier for persistence.
 */
export const DISPATCHER_COLUMNS: ColumnDef[] = [
  // Locked system columns (always visible, not toggleable)
  { key: 'checkbox', label: '', defaultVisible: true, locked: true },
  { key: 'rowNumber', label: '#', defaultVisible: true, locked: true },

  // Warning indicator (port connection, LFD, holds)
  { key: 'warning', label: '⚠', defaultVisible: true, locked: true },

  // Core columns
  {
    key: 'reference_number',
    label: 'Load #',
    defaultVisible: true,
    sortKey: 'reference_number',
  },
  {
    key: 'status',
    label: 'Load Status',
    defaultVisible: true,
    sortKey: 'status',
  },
  { key: 'driver', label: 'Driver', defaultVisible: true },
  {
    key: 'driver_last_seen',
    label: 'Driver Last Seen',
    defaultVisible: true,
    sortKey: 'last_seen_at',
  },
  {
    key: 'event1',
    label: 'Event 1',
    defaultVisible: true,
    sortKey: 'pickup_location',
  },
  {
    key: 'event2',
    label: 'Event 2',
    defaultVisible: true,
    sortKey: 'delivery_location',
  },
  {
    key: 'event3',
    label: 'Event 3',
    defaultVisible: true,
    sortKey: 'return_location',
  },
  {
    key: 'container_number',
    label: 'Container #',
    defaultVisible: true,
    sortKey: 'containerNumber',
  },
  {
    key: 'ref_number',
    label: 'Reference #',
    defaultVisible: true,
    sortKey: 'reference_number',
  },
  {
    key: 'load_type',
    label: 'Load Type',
    defaultVisible: true,
    sortKey: 'load_type',
  },
  { key: 'next_address', label: 'Next Address', defaultVisible: true },
  {
    key: 'container_size',
    label: 'Size',
    defaultVisible: true,
    sortKey: 'container_size',
  },
  {
    key: 'pickup_apt_from',
    label: 'Pick Up Apt From',
    defaultVisible: true,
    sortKey: 'pickup_apt_from',
  },
  {
    key: 'lfd_erd',
    label: 'LFD/ERD',
    defaultVisible: true,
    sortKey: 'lfd_erd',
  },
  {
    key: 'vessel_eta',
    label: 'ETA',
    defaultVisible: true,
    sortKey: 'vessel_eta',
  },
  {
    key: 'delivery_apt_from',
    label: 'Delivery Apt From',
    defaultVisible: true,
    sortKey: 'delivery_apt_from',
  },
  { key: 'cut_off', label: 'Cut Off', defaultVisible: false },
  {
    key: 'per_diem_free_day',
    label: 'Per Diem Free Day',
    defaultVisible: false,
    sortKey: 'per_diem_free_day',
  },
  {
    key: 'container_type',
    label: 'Type',
    defaultVisible: false,
    sortKey: 'container_type',
  },
  {
    key: 'shipment_number',
    label: 'Shipment #',
    defaultVisible: false,
    sortKey: 'shipment_number',
  },
  {
    key: 'customer',
    label: 'Customer',
    defaultVisible: true,
    sortKey: 'customerName',
  },
  { key: 'ssl', label: 'SSL', defaultVisible: false, sortKey: 'ssl' },
  { key: 'mbol', label: 'MBOL/BKG', defaultVisible: false, sortKey: 'mbol' },
  { key: 'ref_container', label: 'Ref Container #', defaultVisible: false },
  {
    key: 'chassis_number',
    label: 'Chassis #',
    defaultVisible: false,
    sortKey: 'chassis_number',
  },
  {
    key: 'total_weight',
    label: 'Total Weight',
    defaultVisible: false,
    sortKey: 'total_weight',
  },
  {
    key: 'delivery_location',
    label: 'Delivery Location',
    defaultVisible: false,
    sortKey: 'delivery_location',
  },
  {
    key: 'pickup_location',
    label: 'Pick Up Location',
    defaultVisible: false,
    sortKey: 'pickup_location',
  },
  {
    key: 'delivery_city_state',
    label: 'Delivery City/State',
    defaultVisible: false,
  },
  {
    key: 'return_location',
    label: 'Return Location',
    defaultVisible: false,
    sortKey: 'return_location',
  },
  { key: 'container_return', label: 'Container Return', defaultVisible: false },
  {
    key: 'vessel_name',
    label: 'Vessel Name',
    defaultVisible: false,
    sortKey: 'vessel_name',
  },
  {
    key: 'route_template',
    label: 'Routing Template',
    defaultVisible: false,
    sortKey: 'route_template',
  },
  {
    key: 'seal_number',
    label: 'Seal #',
    defaultVisible: false,
    sortKey: 'seal_number',
  },
  {
    key: 'return_apt_from',
    label: 'Return Apt From',
    defaultVisible: false,
    sortKey: 'return_apt_from',
  },
  {
    key: 'pickup_number',
    label: 'Pick Up #',
    defaultVisible: false,
    sortKey: 'pickup_number',
  },
  {
    key: 'return_number',
    label: 'Return #',
    defaultVisible: false,
    sortKey: 'return_number',
  },
  { key: 'reset_routing', label: 'Reset Routing', defaultVisible: false },
  { key: 'change_status', label: 'Change Status', defaultVisible: false },
  {
    key: 'last_tracked',
    label: 'Last Tracked',
    defaultVisible: true,
    sortKey: 'last_tracked',
  },
  {
    key: 'genset_number',
    label: 'Genset #',
    defaultVisible: false,
    sortKey: 'genset_number',
  },
  {
    key: 'distance',
    label: 'Distance',
    defaultVisible: false,
    sortKey: 'distance',
  },
  { key: 'csr', label: 'CSR', defaultVisible: false, sortKey: 'csr' },
  {
    key: 'house_bol',
    label: 'House Bill Of Lading',
    defaultVisible: false,
    sortKey: 'house_bol',
  },
  { key: 'voyage', label: 'Voyage', defaultVisible: false, sortKey: 'voyage' },
  {
    key: 'purchase_order',
    label: 'Purchase Order #',
    defaultVisible: false,
    sortKey: 'purchase_order',
  },
  {
    key: 'appointment_number',
    label: 'Appointment #',
    defaultVisible: false,
    sortKey: 'appointment_number',
  },
  {
    key: 'reservation_number',
    label: 'Reservation #',
    defaultVisible: false,
    sortKey: 'reservation_number',
  },
];

/** Get default visible column keys */
export function getDefaultVisibleColumns(): string[] {
  return DISPATCHER_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
}

/** Get locked column keys (cannot be hidden) */
export function getLockedColumns(): string[] {
  return DISPATCHER_COLUMNS.filter((c) => c.locked).map((c) => c.key);
}
