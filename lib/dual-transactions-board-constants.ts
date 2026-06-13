/**
 * Eligibility for the Dual Transactions board and POST …/dual-transactions/match.
 * Keep in sync: `app/dashboard/dispatcher/dual-transactions/page.tsx` and match route.
 */
export const DUAL_BOARD_IMPORT_RETURN_STATUSES = [
  "Delivered",
  "Arrived At Return Empty",
  "Arrived To Hook Container",
  "Dropped - Empty",
  "Dropped - Loaded",
  "Enroute To Drop Container",
  "Enroute To Return Empty",
  "Completed",
] as const

export const DUAL_BOARD_EXPORT_PICKUP_STATUSES = ["Available", "Available At Port"] as const

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

export function isImportStatusOnDualBoard(status: string | null | undefined): boolean {
  const n = norm(status)
  return DUAL_BOARD_IMPORT_RETURN_STATUSES.some((s) => s.toLowerCase() === n)
}

export function isExportStatusOnDualBoard(status: string | null | undefined): boolean {
  const n = norm(status)
  return DUAL_BOARD_EXPORT_PICKUP_STATUSES.some((s) => s.toLowerCase() === n)
}
