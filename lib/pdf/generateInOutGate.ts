import jsPDF from "jspdf"
import { LoadWithRelations } from "@/types/dispatcher"
import {
  OrgAddress,
  BRAND,
  fmtDate,
  buildCityStateZip,
  drawHeaderBar,
  drawLine,
  drawSignatureLine,
  drawLogoText,
  downloadPdf,
  getActiveFlags,
} from "./pdfHelpers"

export async function generateInOutGate(
  load: LoadWithRelations,
  orgAddresses: Record<string, OrgAddress>
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // ─── Header with orange accent ───────────────────────────
  drawLogoText(doc, margin, y + 16)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(BRAND.orange)
  doc.text("IN / OUT GATE RECEIPT", pageWidth - margin, y + 10, { align: "right" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.gray)
  doc.text(`Date: ${fmtDate(new Date().toISOString())}`, pageWidth - margin, y + 22, { align: "right" })
  y += 30

  // Orange accent line
  doc.setFillColor(BRAND.orange)
  doc.rect(margin, y, contentWidth, 3, "F")
  y += 10

  // ─── Customer / Last Dropped / Return ────────────────────
  const colWidth = contentWidth / 3
  const col1 = margin
  const col2 = margin + colWidth
  const col3 = margin + colWidth * 2

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.orange)
  doc.text("CUSTOMER", col1, y)
  doc.text("LAST DROPPED", col2, y)
  doc.text("RETURN TO", col3, y)
  y += 12

  // Customer
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  doc.text(load.customers?.name || "—", col1, y)
  let custY = y + 11
  if (load.customers?.address) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(BRAND.gray)
    doc.text(load.customers.address, col1, custY)
    custY += 10
    const csz = [load.customers.city, load.customers.state].filter(Boolean).join(", ")
    if (csz) { doc.text(`${csz} ${load.customers.zip_code || ""}`.trim(), col1, custY); custY += 10 }
  }

  // Last Dropped (delivery)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  doc.text(load.delivery_location || "—", col2, y)
  let delY = y + 11
  const delOrg = load.delivery_location ? orgAddresses[load.delivery_location] : null
  if (delOrg?.address) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(BRAND.gray)
    doc.text(delOrg.address, col2, delY)
    delY += 10
    const csz = buildCityStateZip(orgAddresses, load.delivery_location)
    if (csz) { doc.text(csz, col2, delY); delY += 10 }
  }

  // Return
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  doc.text(load.return_location || "—", col3, y)
  let retY = y + 11
  const retOrg = load.return_location ? orgAddresses[load.return_location] : null
  if (retOrg?.address) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(BRAND.gray)
    doc.text(retOrg.address, col3, retY)
    retY += 10
    const csz = buildCityStateZip(orgAddresses, load.return_location)
    if (csz) { doc.text(csz, col3, retY); retY += 10 }
  }

  y = Math.max(custY, delY, retY) + 10

  // ─── Order Details ───────────────────────────────────────
  drawLine(doc, y, BRAND.orange)
  y += 4

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.orange)
  doc.text("ORDER DETAILS", margin, y + 10)
  y += 18

  const detColW = contentWidth / 4
  const detFields = [
    { label: "Reference #", value: load.reference_number },
    { label: "Container #", value: load.containers?.container_number || "—" },
    { label: "Size / Type", value: `${load.container_size || "—"} / ${load.container_type || "—"}` },
    { label: "SSL", value: load.ssl || "—" },
    { label: "Chassis #", value: load.chassis_number || "—" },
    { label: "Seal #", value: load.seal_number || "—" },
    { label: "Weight", value: load.total_weight ? `${load.total_weight} lbs` : "—" },
    { label: "Genset #", value: load.genset_number || "—" },
  ]

  for (let i = 0; i < detFields.length; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    const fx = margin + col * detColW
    const fy = y + row * 26

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.gray)
    doc.text(detFields[i].label, fx, fy)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BRAND.black)
    doc.text(detFields[i].value, fx, fy + 11)
  }

  y += Math.ceil(detFields.length / 4) * 26 + 6

  // Flags
  const flags = getActiveFlags(load)
  if (flags.length > 0) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.orange)
    doc.text(`FLAGS: ${flags.join(" | ")}`, margin, y)
    y += 14
  }

  // ─── Company / Signature ─────────────────────────────────
  drawLine(doc, y, BRAND.orange)
  y += 12

  const sigHalfW = contentWidth / 2 - 15
  drawSignatureLine(doc, margin, y, "Company Name", sigHalfW)
  drawSignatureLine(doc, margin + sigHalfW + 30, y, "Date", sigHalfW)
  y += 8
  drawSignatureLine(doc, margin, y, "Driver Signature", sigHalfW)
  drawSignatureLine(doc, margin + sigHalfW + 30, y, "License Plate #", sigHalfW)
  y += 16

  // ─── Container Inspection Diagram ────────────────────────
  drawLine(doc, y, BRAND.orange)
  y += 4

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.orange)
  doc.text("CONTAINER INSPECTION", margin, y + 10)
  y += 18

  // Draw 6 container views in a 3x2 grid
  const viewWidth = (contentWidth - 20) / 3
  const viewHeight = 70
  const views = ["LEFT SIDE", "FRONT", "RIGHT SIDE", "TOP", "REAR", "FLOOR"]

  for (let i = 0; i < views.length; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const vx = margin + col * (viewWidth + 10)
    const vy = y + row * (viewHeight + 22)

    // Box
    doc.setDrawColor(BRAND.gray)
    doc.setLineWidth(0.5)
    doc.rect(vx, vy, viewWidth, viewHeight)

    // Label
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.blueHeader)
    doc.text(views[i], vx + viewWidth / 2, vy + viewHeight + 10, { align: "center" })
  }

  y += 2 * (viewHeight + 22) + 10

  // ─── Damage Legend ───────────────────────────────────────
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(BRAND.black)
  doc.text("DAMAGE LEGEND:", margin, y)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(BRAND.gray)
  const legend = "B = Bent  |  BR = Broken  |  C = Cut  |  CR = Cracked  |  D = Dented  |  G = Gouged  |  H = Hole  |  M = Missing  |  R = Rusted  |  S = Scratched"
  doc.text(legend, margin, y + 10)
  y += 24

  // ─── Notes ──────────────────────────────────────────────
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(BRAND.gray)
  doc.text("Notes / Damage Description:", margin, y)
  y += 4
  doc.setDrawColor(BRAND.gray)
  doc.setLineWidth(0.3)
  for (let i = 0; i < 3; i++) {
    doc.line(margin, y + i * 16, margin + contentWidth, y + i * 16)
  }

  // ─── Footer ──────────────────────────────────────────────
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(BRAND.grayLight)
  doc.text(
    "Driver acknowledges inspection of the container and certifies accuracy of recorded damage.",
    pageWidth / 2,
    pageHeight - 24,
    { align: "center" }
  )

  downloadPdf(doc, `InOutGateReceipt_${load.reference_number}.pdf`)
}
