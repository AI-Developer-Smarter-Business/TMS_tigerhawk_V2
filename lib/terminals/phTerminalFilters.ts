/**
 * Port Houston vessel / sync codes (BCT, BAY) aligned with `lib/port-houston/mappers.ts`.
 * Filter labels are derived from `terminals.name` in Supabase when rows match known facilities.
 */

/** Port Houston terminal filter row (from `terminals` + vessel codes). */
export type PhTerminalFilterOption = {
  code: string
  /** Full label for `<select>` options */
  label: string
  /** Short label for pill buttons */
  pillLabel: string
}

const FALLBACK: PhTerminalFilterOption[] = [
  { code: "BCT", label: "Barbours Cut (BCT)", pillLabel: "Barbours Cut" },
  { code: "BAY", label: "Bayport (BAY)", pillLabel: "Bayport" },
]

/**
 * Map a `terminals` row name to a PH facility code when the name clearly indicates Barbours Cut or Bayport.
 */
export function inferPhTerminalCodeFromOrgName(name: string): "BCT" | "BAY" | null {
  const n = name.toUpperCase()
  if (n.includes("BARBOUR") || /\bBCT\b/.test(n)) return "BCT"
  if (n.includes("BAYPORT") || /\bBPT\b/.test(n)) return "BAY"
  return null
}

/**
 * Optional explicit sync/filter code at end of org terminal name, e.g. `New Pier (NPT)`.
 * Keeps vessel-style short codes aligned with `vessels.terminal` without a DB migration.
 */
export function inferExplicitTerminalCodeFromOrgName(name: string): string | null {
  const m = name.trim().match(/\(([A-Za-z0-9][A-Za-z0-9_-]{1,7})\)\s*$/)
  return m ? m[1].toUpperCase() : null
}

/** PH code first, then parenthetic facility code; otherwise no filter row (avoids listing every warehouse). */
export function inferOrgTerminalFilterCode(name: string): string | null {
  return inferPhTerminalCodeFromOrgName(name) ?? inferExplicitTerminalCodeFromOrgName(name)
}

function pillLabelForCode(code: string): string {
  if (code === "BCT") return "Barbours Cut"
  if (code === "BAY") return "Bayport"
  return code
}

/** Build filter options from `terminals` rows (PH names + optional `Name (CODE)`). Uses fallback if no row matches. */
export function buildPhTerminalFilterOptions(rows: { name: string }[]): PhTerminalFilterOption[] {
  const byCode = new Map<string, PhTerminalFilterOption>()

  for (const row of rows) {
    const name = row.name?.trim()
    if (!name) continue
    const code = inferOrgTerminalFilterCode(name)
    if (!code || byCode.has(code)) continue

    const ph = inferPhTerminalCodeFromOrgName(name)
    const label = ph ? `${name} (${code})` : name
    const pillLabel = ph ? pillLabelForCode(code) : name.length > 28 ? `${name.slice(0, 25)}…` : name

    byCode.set(code, { code, label, pillLabel })
  }

  if (byCode.size === 0) return [...FALLBACK]

  const preferred = ["BCT", "BAY"]
  const keys = [...byCode.keys()]
  const orderedKeys = [
    ...preferred.filter((k) => byCode.has(k)),
    ...keys.filter((k) => !preferred.includes(k)).sort((a, b) =>
      byCode.get(a)!.label.localeCompare(byCode.get(b)!.label),
    ),
  ]
  return orderedKeys.map((k) => byCode.get(k)!)
}

/** Add any extra vessel/container `terminal` codes not already listed (e.g. future PH codes). */
export function mergePhFilterOptionsWithVesselTerminals(
  base: PhTerminalFilterOption[],
  vesselTerminals: (string | null | undefined)[]
): PhTerminalFilterOption[] {
  const map = new Map<string, PhTerminalFilterOption>()
  for (const o of base) map.set(o.code, o)
  for (const t of vesselTerminals) {
    const c = t?.trim()
    if (!c || map.has(c)) continue
    map.set(c, { code: c, label: `${c} (${c})`, pillLabel: c })
  }
  const preferred = ["BCT", "BAY"]
  const keys = [...map.keys()]
  const ordered = [
    ...preferred.filter((k) => map.has(k)),
    ...keys.filter((k) => !preferred.includes(k)).sort(),
  ]
  return ordered.map((code) => map.get(code)!)
}

/** Merge `terminals` catalog rows with vessel terminal codes present on loads (dispatcher / dual / street-turn). */
export function mergePhTerminalOptionsForLoadRows(
  terminalNameRows: { name: string }[],
  loads: { containers?: { vessels?: { terminal?: string | null } | null } | null }[],
): PhTerminalFilterOption[] {
  const base = buildPhTerminalFilterOptions(terminalNameRows)
  const codes = loads.map((l) => l.containers?.vessels?.terminal)
  return mergePhFilterOptionsWithVesselTerminals(base, codes)
}

export type LoadForPhTerminalFilter = {
  pickup_location?: string | null
  delivery_location?: string | null
  return_location?: string | null
  containers?: {
    transit_state?: string | null
    vessels?: { terminal?: string | null } | null
  } | null
}

function searchTokensForCode(code: string): string[] {
  const c = code.toUpperCase()
  if (c === "BCT") return ["bct", "barbours", "barbour"]
  if (c === "BAY") return ["bayport", "bpt", "bay"]
  return [code.toLowerCase()]
}

/** Match loads the same way as the legacy Barbours Cut / Bayport filters, but for any PH-style code. */
export function loadMatchesPhTerminalFilter(
  load: LoadForPhTerminalFilter,
  filterCode: string
): boolean {
  if (filterCode === "All") return true
  const filterCodeUpper = filterCode.toUpperCase()

  // Prefer exact vessel terminal code when present to avoid false negatives
  // on loads whose address text does not include the terminal code/name.
  const vesselTerminal = load.containers?.vessels?.terminal?.trim().toUpperCase()
  if (vesselTerminal && vesselTerminal === filterCodeUpper) return true

  const tokens = searchTokensForCode(filterCode)
  const locations = [load.pickup_location, load.delivery_location, load.return_location]
  for (const loc of locations) {
    if (!loc) continue
    const low = loc.toLowerCase()
    for (const tok of tokens) {
      if (tok.length >= 3 && low.includes(tok)) return true
    }
    if (low.includes(filterCode.toLowerCase())) return true
  }
  const ts = load.containers?.transit_state
  if (ts && typeof ts === "string") {
    const up = ts.toUpperCase()
    if (up.includes(filterCodeUpper)) return true
    for (const tok of tokens) {
      if (tok.length >= 3 && up.includes(tok.toUpperCase())) return true
    }
  }
  return false
}
