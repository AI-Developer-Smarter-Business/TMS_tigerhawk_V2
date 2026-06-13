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

export async function generateBillOfLading(
  load: LoadWithRelations,
  orgAddresses: Record<string, OrgAddress>
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 36
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // ─── Header ──────────────────────────────────────────────
  drawLogoText(doc, margin, y + 16)

  // Right side info
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("BILL OF LADING", pageWidth - margin, y + 6, { align: "right" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.gray)
  doc.text(`Date: ${fmtDate(new Date().toISOString())}`, pageWidth - margin, y + 20, { align: "right" })
  y += 30

  drawLine(doc, y, BRAND.orange)
  y += 8

  // ─── Carrier / Reference Info ────────────────────────────
  const infoColW = contentWidth / 4
  const infoFields = [
    { label: "Carrier", value: "TigerHawk Transportation" },
    { label: "SCAC", value: load.scac || "—" },
    { label: "Reference #", value: load.reference_number },
    { label: "BOL #", value: load.mbol || "—" },
  ]

  for (let i = 0; i < infoFields.length; i++) {
    const x = margin + i * infoColW
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.gray)
    doc.text(infoFields[i].label, x, y)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BRAND.black)
    doc.text(infoFields[i].value, x, y + 11)
  }
  y += 28

  // ─── Legal preamble ──────────────────────────────────────
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(BRAND.gray)
  const preamble =
    "Received, subject to the classifications and tariffs in effect on the date of issue of this Bill of Lading, " +
    "the property described below in apparent good order, except as noted (contents and condition of contents of packages unknown), " +
    "marked, consigned, and destined as indicated below, which said carrier agrees to carry to its usual place of delivery."
  const preambleLines = doc.splitTextToSize(preamble, contentWidth)
  doc.text(preambleLines, margin, y)
  y += preambleLines.length * 8 + 8

  drawLine(doc, y)
  y += 8

  // ─── Origin / Destination ────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "ORIGIN / DESTINATION")
  y += 10

  const halfW = contentWidth / 2 - 10

  // FROM
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("FROM (SHIPPER)", margin, y)
  doc.text("TO (CONSIGNEE)", margin + halfW + 20, y)
  y += 12

  // Origin details
  const drawLocation = (x: number, locName: string | null, startY: number): number => {
    let ly = startY
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(BRAND.black)
    doc.text(locName || "—", x, ly)
    ly += 12
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

  const fromY = drawLocation(margin, load.pickup_location, y)
  const toY = drawLocation(margin + halfW + 20, load.delivery_location, y)
  y = Math.max(fromY, toY) + 12

  // ─── Item Description Table ──────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "DESCRIPTION OF ARTICLES")
  y += 4

  // Table headers
  const descCols = [margin, margin + 120, margin + 210, margin + 290, margin + 370, margin + 440]
  const descHeaders = ["Container #", "Seal #", "BOL #", "PO #", "Reference #", "Weight (lbs)"]
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(BRAND.blueHeader)
  for (let i = 0; i < descHeaders.length; i++) {
    doc.text(descHeaders[i], descCols[i], y + 12)
  }
  y += 16
  drawLine(doc, y)
  y += 8

  // Row data
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(BRAND.black)
  const rowData = [
    load.containers?.container_number || "—",
    load.seal_number || "—",
    load.mbol || "—",
    load.purchase_order || "—",
    load.reference_number,
    load.total_weight ? `${load.total_weight}` : "—",
  ]
  for (let i = 0; i < rowData.length; i++) {
    doc.text(rowData[i], descCols[i], y)
  }
  y += 14

  // Commodity description
  if (load.commodity) {
    doc.setFontSize(8)
    doc.setTextColor(BRAND.gray)
    doc.text(`Commodity: ${load.commodity}`, margin, y)
    y += 12
  }

  // Size/Type
  doc.setFontSize(8)
  doc.setTextColor(BRAND.gray)
  doc.text(`Container Size: ${load.container_size || "—"}  |  Type: ${load.container_type || "—"}  |  Chassis: ${load.chassis_number || "—"}`, margin, y)
  y += 12

  // Flags
  const flags = getActiveFlags(load)
  if (flags.length > 0) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.orange)
    doc.text(`FLAGS: ${flags.join(" | ")}`, margin, y)
    y += 12
  }

  // Empty rows for additional items
  for (let i = 0; i < 3; i++) {
    drawLine(doc, y, "#F3F4F6")
    y += 18
  }

  drawLine(doc, y)
  y += 12

  // ─── Delivery / Signature Section ────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "DELIVERY RECEIPT")
  y += 16

  // Delivery appointment
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(BRAND.gray)
  doc.text(`Delivery Appointment: ${fmtDate(load.delivery_apt_from, true) || "—"}`, margin, y)
  y += 18

  // Signature lines
  const sigW = contentWidth / 2 - 15
  drawSignatureLine(doc, margin, y, "Shipper Signature", sigW)
  drawSignatureLine(doc, margin + sigW + 30, y, "Date", sigW)
  y += 10
  drawSignatureLine(doc, margin, y, "Carrier Signature", sigW)
  drawSignatureLine(doc, margin + sigW + 30, y, "Date", sigW)
  y += 10
  drawSignatureLine(doc, margin, y, "Consignee Signature", sigW)
  drawSignatureLine(doc, margin + sigW + 30, y, "Date", sigW)
  y += 16

  // ─── Legal Footer ───────────────────────────────────────
  drawLine(doc, y)
  y += 6

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6)
  doc.setTextColor(BRAND.grayLight)
  const legalText =
    "The carrier or party in possession of any of the property herein described shall be liable as at common law for any loss thereof " +
    "or damage thereto, except as hereinafter provided. Every service to be performed hereunder shall be subject to all the conditions " +
    "not prohibited by law, whether printed or written, herein contained, including the conditions on back hereof, which are hereby agreed " +
    "to by the shipper and accepted for himself and his assigns."
  const legalLines = doc.splitTextToSize(legalText, contentWidth)
  doc.text(legalLines, margin, y)

  downloadPdf(doc, `BillOfLading_${load.reference_number}.pdf`)
}
