import jsPDF from "jspdf"
import { LoadWithRelations } from "@/types/dispatcher"

// Shared types
export type OrgAddress = {
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

// TigerHawk brand colors
export const BRAND = {
  orange: "#E8700A",
  orangeLight: "#FF8C21",
  blue: "#1A2332",
  blueDark: "#0F1724",
  blueHeader: "#1E3A5F",
  white: "#FFFFFF",
  gray: "#6B7280",
  grayLight: "#9CA3AF",
  black: "#111827",
}

// Format a date string to readable format
export function fmtDate(d: string | null | undefined, includeTime = false): string {
  if (!d) return ""
  const date = new Date(d)
  if (includeTime) {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// Format currency
export function fmtCurrency(amount: number | null | undefined): string {
  if (amount == null) return "$0.00"
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Build full address string from org
export function buildAddress(orgAddresses: Record<string, OrgAddress>, locationName: string | null): string {
  if (!locationName) return ""
  const org = orgAddresses[locationName]
  if (org?.address) {
    const parts = [org.address, org.city, org.state, org.zip_code].filter(Boolean)
    return parts.join(", ")
  }
  return locationName
}

// Build city, state zip string
export function buildCityStateZip(orgAddresses: Record<string, OrgAddress>, locationName: string | null): string {
  if (!locationName) return ""
  const org = orgAddresses[locationName]
  if (org) {
    const cityState = [org.city, org.state].filter(Boolean).join(", ")
    return org.zip_code ? `${cityState} ${org.zip_code}` : cityState
  }
  return ""
}

// Draw a colored header bar across page width
export function drawHeaderBar(doc: jsPDF, y: number, height: number, color: string, text: string, textColor = "#FFFFFF") {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  doc.setFillColor(color)
  doc.rect(margin, y, pageWidth - margin * 2, height, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(textColor)
  doc.text(text, margin + 6, y + height / 2 + 3)
  return y + height
}

// Draw a labeled field (label above value)
export function drawField(doc: jsPDF, x: number, y: number, label: string, value: string, maxWidth = 100) {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(BRAND.gray)
  doc.text(label, x, y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  const lines = doc.splitTextToSize(value || "—", maxWidth)
  doc.text(lines, x, y + 9)
  return y + 9 + lines.length * 10
}

// Draw a horizontal line
export function drawLine(doc: jsPDF, y: number, color = "#E5E7EB") {
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  doc.setDrawColor(color)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  return y + 2
}

// Draw signature line
export function drawSignatureLine(doc: jsPDF, x: number, y: number, label: string, width = 120) {
  doc.setDrawColor(BRAND.black)
  doc.setLineWidth(0.5)
  doc.line(x, y, x + width, y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(BRAND.gray)
  doc.text(label, x, y + 9)
  return y + 18
}

// Save and download PDF
export function downloadPdf(doc: jsPDF, filename: string) {
  doc.save(filename)
}

// Draw the TigerHawk logo text (since we don't have an image file embedded)
export function drawLogoText(doc: jsPDF, x: number, y: number) {
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(BRAND.orange)
  doc.text("TIGERHAWK", x, y)
  doc.setFontSize(10)
  doc.setTextColor(BRAND.gray)
  doc.text("TMS", x + doc.getTextWidth("TIGERHAWK") * (18 / doc.getFontSize()) + 2, y)
}

// Get all active flags for a load
export function getActiveFlags(load: LoadWithRelations): string[] {
  const flags: string[] = []
  if (load.is_hazmat) flags.push("HAZMAT")
  if (load.is_hot) flags.push("HOT")
  if (load.is_overweight) flags.push("OVERWEIGHT")
  if (load.is_overheight) flags.push("OVERHEIGHT")
  if (load.is_oog) flags.push("OOG")
  if (load.is_tanker) flags.push("TANKER")
  if (load.is_bonded) flags.push("BONDED")
  if (load.is_genset) flags.push("GENSET")
  if (load.is_scale) flags.push("SCALE")
  if (load.is_ev) flags.push("EV")
  if (load.is_double) flags.push("DOUBLE")
  if (load.is_liquor) flags.push("LIQUOR")
  if (load.is_street_turn) flags.push("STREET TURN")
  return flags
}
