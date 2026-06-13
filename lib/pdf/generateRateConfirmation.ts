import jsPDF from "jspdf"
import { LoadWithRelations } from "@/types/dispatcher"
import {
  OrgAddress,
  BRAND,
  fmtDate,
  fmtCurrency,
  buildCityStateZip,
  drawHeaderBar,
  drawField,
  drawLine,
  drawSignatureLine,
  drawLogoText,
  downloadPdf,
  getActiveFlags,
} from "./pdfHelpers"

export async function generateRateConfirmation(
  load: LoadWithRelations,
  orgAddresses: Record<string, OrgAddress>
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" })
  const pageWidth = doc.internal.pageSize.getWidth() // 612
  const margin = 36
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // ─── Logo & Company Info ─────────────────────────────────
  drawLogoText(doc, margin, y + 16)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.gray)
  doc.text("TigerHawk Transportation Management", pageWidth - margin, y + 6, { align: "right" })
  doc.text("Houston, TX", pageWidth - margin, y + 16, { align: "right" })
  y += 30

  drawLine(doc, y, BRAND.orange)
  y += 8

  // ─── RATE CONFIRMATION header ────────────────────────────
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("RATE CONFIRMATION", margin, y + 14)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.gray)
  doc.text(`Date: ${fmtDate(new Date().toISOString())}`, pageWidth - margin, y + 6, { align: "right" })
  doc.text(`Reference #: ${load.reference_number}`, pageWidth - margin, y + 18, { align: "right" })
  y += 28

  drawLine(doc, y)
  y += 10

  // ─── Bill To / Pickup / Delivery columns ─────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "LOCATIONS")
  y += 8

  const colWidth = contentWidth / 3
  const col1 = margin
  const col2 = margin + colWidth
  const col3 = margin + colWidth * 2

  // Bill To
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("BILL TO", col1, y)
  doc.text("PICK UP", col2, y)
  doc.text("DELIVERY", col3, y)
  y += 10

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)

  // Bill To column
  const custName = load.customers?.name || "—"
  doc.text(custName, col1, y)
  let billY = y + 11
  if (load.customers?.address) {
    doc.setFontSize(8)
    doc.setTextColor(BRAND.gray)
    doc.text(load.customers.address, col1, billY)
    billY += 10
    const custCSZ = [load.customers.city, load.customers.state].filter(Boolean).join(", ")
    if (custCSZ) {
      doc.text(`${custCSZ} ${load.customers.zip_code || ""}`.trim(), col1, billY)
      billY += 10
    }
    if (load.customers.phone) {
      doc.text(load.customers.phone, col1, billY)
      billY += 10
    }
  }

  // Pickup column
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  doc.text(load.pickup_location || "—", col2, y)
  let pickY = y + 11
  const pickOrg = load.pickup_location ? orgAddresses[load.pickup_location] : null
  if (pickOrg?.address) {
    doc.setFontSize(8)
    doc.setTextColor(BRAND.gray)
    doc.text(pickOrg.address, col2, pickY)
    pickY += 10
    const csz = buildCityStateZip(orgAddresses, load.pickup_location)
    if (csz) { doc.text(csz, col2, pickY); pickY += 10 }
  }
  if (load.pickup_apt_from) {
    doc.setFontSize(7)
    doc.setTextColor(BRAND.gray)
    doc.text(`Appt: ${fmtDate(load.pickup_apt_from, true)}`, col2, pickY)
    pickY += 10
  }

  // Delivery column
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  doc.text(load.delivery_location || "—", col3, y)
  let delY = y + 11
  const delOrg = load.delivery_location ? orgAddresses[load.delivery_location] : null
  if (delOrg?.address) {
    doc.setFontSize(8)
    doc.setTextColor(BRAND.gray)
    doc.text(delOrg.address, col3, delY)
    delY += 10
    const csz = buildCityStateZip(orgAddresses, load.delivery_location)
    if (csz) { doc.text(csz, col3, delY); delY += 10 }
  }
  if (load.delivery_apt_from) {
    doc.setFontSize(7)
    doc.setTextColor(BRAND.gray)
    doc.text(`Appt: ${fmtDate(load.delivery_apt_from, true)}`, col3, delY)
    delY += 10
  }

  y = Math.max(billY, pickY, delY) + 10

  // ─── Load Information ────────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "LOAD INFORMATION")
  y += 10

  const infoColW = contentWidth / 4
  const fields = [
    { label: "Reference #", value: load.reference_number },
    { label: "Container #", value: load.containers?.container_number || "—" },
    { label: "Size / Type", value: `${load.container_size || "—"} / ${load.container_type || "—"}` },
    { label: "SSL", value: load.ssl || "—" },
    { label: "BOL #", value: load.mbol || "—" },
    { label: "Seal #", value: load.seal_number || "—" },
    { label: "Chassis #", value: load.chassis_number || "—" },
    { label: "Weight", value: load.total_weight ? `${load.total_weight} lbs` : "—" },
  ]

  for (let i = 0; i < fields.length; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    const fx = margin + col * infoColW
    const fy = y + row * 28

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.gray)
    doc.text(fields[i].label, fx, fy)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BRAND.black)
    doc.text(fields[i].value, fx, fy + 11)
  }

  y += Math.ceil(fields.length / 4) * 28 + 6

  // Flags
  const flags = getActiveFlags(load)
  if (flags.length > 0) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.orange)
    doc.text(`FLAGS: ${flags.join(" | ")}`, margin, y)
    y += 14
  }

  // ─── Commodity ───────────────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "COMMODITY")
  y += 4

  // Table header
  const commodityCols = [margin, margin + 200, margin + 320, margin + 420]
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("Description", commodityCols[0], y + 12)
  doc.text("Pieces", commodityCols[1], y + 12)
  doc.text("Weight (lbs)", commodityCols[2], y + 12)
  doc.text("Pallets", commodityCols[3], y + 12)
  y += 16
  drawLine(doc, y)
  y += 8

  // Commodity row
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  doc.text(load.commodity || "General Freight", commodityCols[0], y)
  doc.text("—", commodityCols[1], y)
  doc.text(load.total_weight ? `${load.total_weight}` : "—", commodityCols[2], y)
  doc.text("—", commodityCols[3], y)
  y += 20

  // ─── Charges ─────────────────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "CHARGES")
  y += 4

  // Charges table header
  const chargesCols = [margin, margin + 300, margin + 420]
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("Description", chargesCols[0], y + 12)
  doc.text("Rate", chargesCols[1], y + 12)
  doc.text("Amount", chargesCols[2], y + 12)
  y += 16
  drawLine(doc, y)
  y += 8

  // Line haul
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  doc.text("Line Haul", chargesCols[0], y)
  doc.text(fmtCurrency(load.rate), chargesCols[1], y)
  doc.text(fmtCurrency(load.rate), chargesCols[2], y)
  y += 14

  // Accessorial
  if (load.accessorial_charges && load.accessorial_charges > 0) {
    doc.text("Accessorial Charges", chargesCols[0], y)
    doc.text(fmtCurrency(load.accessorial_charges), chargesCols[1], y)
    doc.text(fmtCurrency(load.accessorial_charges), chargesCols[2], y)
    y += 14
  }

  // Detention
  if (load.detention_charges && load.detention_charges > 0) {
    doc.text("Detention", chargesCols[0], y)
    doc.text(fmtCurrency(load.detention_charges), chargesCols[1], y)
    doc.text(fmtCurrency(load.detention_charges), chargesCols[2], y)
    y += 14
  }

  drawLine(doc, y)
  y += 8

  // Total
  const total = (load.rate || 0) + (load.accessorial_charges || 0) + (load.detention_charges || 0)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("TOTAL ESTIMATED RATE", chargesCols[0], y)
  doc.text(fmtCurrency(total), chargesCols[2], y)
  y += 24

  // ─── Signature ───────────────────────────────────────────
  drawLine(doc, y)
  y += 16

  const sigCol1 = margin
  const sigCol2 = margin + contentWidth / 2 + 20

  drawSignatureLine(doc, sigCol1, y, "Authorized Signature", contentWidth / 2 - 30)
  drawSignatureLine(doc, sigCol2, y, "Date", contentWidth / 2 - 30)

  // ─── Footer ──────────────────────────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(BRAND.grayLight)
  doc.text(
    "This rate confirmation is subject to the terms and conditions agreed upon between the parties.",
    pageWidth / 2,
    pageHeight - 24,
    { align: "center" }
  )

  downloadPdf(doc, `RateConfirmation_${load.reference_number}.pdf`)
}
