// lib/exportCSV.ts
// Shared CSV export utility — generates and downloads a CSV file from column definitions + data rows

export type ExportColumn<T> = {
  header: string
  accessor: (row: T) => string | number | null | undefined
}

export type CSVDelimiter = "," | ";"

export type ExportToCSVOptions = {
  delimiter?: CSVDelimiter
  includeExcelSeparatorHint?: boolean
}

function detectRegionalDelimiter(): CSVDelimiter {
  if (typeof navigator === "undefined") return ","
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language]
  const usesSemicolon = locales.some((locale) => /^(es|pt)(-|$)/i.test(locale))
  return usesSemicolon ? ";" : ","
}

/**
 * Escape a CSV cell value:
 * - Wrap in quotes if it contains delimiter, quote, or newline
 * - Double-escape any existing quotes
 */
function escapeCSV(value: unknown, delimiter: CSVDelimiter): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Export data to a CSV file and trigger browser download.
 *
 * @param filename - Name for the downloaded file (without extension — .csv is appended)
 * @param columns - Column definitions with header label and accessor function
 * @param rows - Array of data rows to export
 */
export function exportToCSV<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
  options: ExportToCSVOptions = {}
): void {
  if (rows.length === 0) return
  const delimiter = options.delimiter ?? detectRegionalDelimiter()
  const includeExcelSeparatorHint = options.includeExcelSeparatorHint ?? true

  // Header row
  const headerRow = columns.map((col) => escapeCSV(col.header, delimiter)).join(delimiter)

  // Data rows
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCSV(col.accessor(row), delimiter)).join(delimiter)
  )

  // Combine with BOM for Excel UTF-8 compatibility
  const bom = "\uFEFF"
  const excelSeparatorHint = includeExcelSeparatorHint ? `sep=${delimiter}\n` : ""
  const csvContent = bom + excelSeparatorHint + [headerRow, ...dataRows].join("\n")

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.csv`
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Format a date string for export (YYYY-MM-DD or empty)
 */
export function formatDateForExport(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
  } catch {
    return ""
  }
}

/**
 * Format a datetime string for export (YYYY-MM-DD HH:MM or empty)
 */
export function formatDateTimeForExport(dateStr: string | null | undefined): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ""
    return d.toLocaleString("en-US", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    })
  } catch {
    return ""
  }
}
