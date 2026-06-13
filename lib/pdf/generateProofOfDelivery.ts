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

export async function generateProofOfDelivery(
  load: LoadWithRelations,
  orgAddresses: Record<string, OrgAddress>
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" })
  const pageWidth = doc.internal.pageSize.getWidth()
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

  // ─── PROOF OF DELIVERY header ───────────────────────────
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("PROOF OF DELIVERY", margin, y + 14)
  y += 24

  // Sub-header with key info
  const subFields = [
    { label: "Delivery Appt", value: fmtDate(load.delivery_apt_from, true) || "—" },
    { label: "Pickup #", value: load.pickup_number || "—" },
    { label: "Reference #", value: load.reference_number },
    { label: "Driver", value: load.drivers?.name || "—" },
  ]
  const subColW = contentWidth / subFields.length
  doc.setFontSize(7)
  for (let i = 0; i < subFields.length; i++) {
    const x = margin + i * subColW
    doc.setFont("helvetica", "normal")
    doc.setTextColor(BRAND.gray)
    doc.text(subFields[i].label, x, y)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BRAND.black)
    doc.text(subFields[i].value, x, y + 11)
    doc.setFontSize(7)
  }
  y += 24

  drawLine(doc, y)
  y += 8

  // ─── Locations (3-column) ────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "LOCATIONS")
  y += 8

  const colWidth = contentWidth / 3
  const col1 = margin
  const col2 = margin + colWidth
  const col3 = margin + colWidth * 2

  // Column headers
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("SHIPPER / PICK UP", col1, y)
  doc.text("CONSIGNEE / DELIVERY", col2, y)
  doc.text("RETURN", col3, y)
  y += 12

  // Helper for location block
  const drawLocCol = (x: number, locName: string | null, startY: number): number => {
    let ly = startY
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BRAND.black)
    doc.text(locName || "—", x, ly)
    ly += 11
    const org = locName ? orgAddresses[locName] : null
    if (org?.address) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(BRAND.gray)
      doc.text(org.address, x, ly)
      ly += 10
      const csz = buildCityStateZip(orgAddresses, locName)
      if (csz) { doc.text(csz, x, ly); ly += 10 }
    }
    return ly
  }

  const y1 = drawLocCol(col1, load.pickup_location, y)
  const y2 = drawLocCol(col2, load.delivery_location, y)
  const y3 = drawLocCol(col3, load.return_location, y)
  y = Math.max(y1, y2, y3) + 10

  // ─── Order Details ───────────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "ORDER DETAILS")
  y += 10

  const detFields = [
    { label: "Reference #", value: load.reference_number },
    { label: "Container #", value: load.containers?.container_number || "—" },
    { label: "Size / Type", value: `${load.container_size || "—"} / ${load.container_type || "—"}` },
    { label: "SSL", value: load.ssl || "—" },
    { label: "BOL #", value: load.mbol || "—" },
    { label: "Seal #", value: load.seal_number || "—" },
    { label: "Chassis #", value: load.chassis_number || "—" },
    { label: "Weight", value: load.total_weight ? `${load.total_weight} lbs` : "—" },
  ]

  const detColW = contentWidth / 4
  for (let i = 0; i < detFields.length; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    const fx = margin + col * detColW
    const fy = y + row * 28

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.gray)
    doc.text(detFields[i].label, fx, fy)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BRAND.black)
    doc.text(detFields[i].value, fx, fy + 11)
  }
  y += Math.ceil(detFields.length / 4) * 28 + 6

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

  const comCols = [margin, margin + 200, margin + 320, margin + 420]
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("Description", comCols[0], y + 12)
  doc.text("Pieces", comCols[1], y + 12)
  doc.text("Weight (lbs)", comCols[2], y + 12)
  doc.text("Pallets", comCols[3], y + 12)
  y += 16
  drawLine(doc, y)
  y += 8

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.black)
  doc.text(load.commodity || "General Freight", comCols[0], y)
  doc.text("—", comCols[1], y)
  doc.text(load.total_weight ? `${load.total_weight}` : "—", comCols[2], y)
  doc.text("—", comCols[3], y)
  y += 24

  // ─── Delivery Confirmation ──────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "DELIVERY CONFIRMATION")
  y += 16

  // Signature box
  doc.setDrawColor(BRAND.gray)
  doc.setLineWidth(0.5)
  doc.rect(margin, y, contentWidth, 60)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(BRAND.grayLight)
  doc.text("Signature", margin + 8, y + 50)
  y += 72

  // Print Name / Receiver Signature / Date
  const sigW = contentWidth / 3 - 10
  drawSignatureLine(doc, margin, y, "Print Name", sigW)
  drawSignatureLine(doc, margin + contentWidth / 3 + 5, y, "Receiver Signature", sigW)
  drawSignatureLine(doc, margin + (contentWidth / 3) * 2 + 10, y, "Date", sigW)
  y += 24

  // Time In/Out row
  const timeW = contentWidth / 4 - 10
  drawSignatureLine(doc, margin, y, "Time In", timeW)
  drawSignatureLine(doc, margin + contentWidth / 4, y, "Time Out", timeW)
  drawSignatureLine(doc, margin + contentWidth / 2, y, "Signature", timeW)
  drawSignatureLine(doc, margin + (contentWidth / 4) * 3, y, "Date", timeW)
  y += 20

  // ─── Legal Disclaimer ───────────────────────────────────
  drawLine(doc, y)
  y += 8

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(BRAND.grayLight)
  const disclaimer =
    "The carrier certifies that the above-described shipment has been received and delivered in apparent good condition, except as noted. " +
    "This is to certify that the above named materials are properly classified, described, packaged, marked and labeled and are in proper condition " +
    "for transportation according to the applicable regulations of the Department of Transportation."
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth)
  doc.text(disclaimerLines, margin, y)

  downloadPdf(doc, `ProofOfDelivery_${load.reference_number}.pdf`)
}
