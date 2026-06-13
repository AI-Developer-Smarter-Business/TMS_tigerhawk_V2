// lib/pdf/generateSettlement.ts
// Generate a PDF settlement statement for a driver's pay period

import jsPDF from "jspdf"
import {
  BRAND,
  fmtDate,
  fmtCurrency,
  drawHeaderBar,
  drawField,
  drawLine,
  drawSignatureLine,
  drawLogoText,
  downloadPdf,
} from "./pdfHelpers"

export type SettlementPdfData = {
  driverName: string
  driverPhone?: string
  driverEmail?: string
  truckNumber?: string
  owner?: string
  settlementNumber?: string
  periodStart: string
  periodEnd: string
  totalDriverPay: number
  totalDeductions: number
  netPay: number
  status: string
  payItems: {
    loadRef: string
    from: string
    to: string
    amount: number
    date: string
    status: string
  }[]
  deductionItems: {
    type: string
    description: string
    amount: number
    date: string
  }[]
}

export function generateSettlementPdf(data: SettlementPdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" })
  const pageWidth = doc.internal.pageSize.getWidth() // 612
  const pageHeight = doc.internal.pageSize.getHeight() // 792
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

  // ─── SETTLEMENT STATEMENT header ──────────────────────────
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(BRAND.blueHeader)
  doc.text("DRIVER SETTLEMENT STATEMENT", margin, y + 14)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(BRAND.gray)
  doc.text(`Generated: ${fmtDate(new Date().toISOString())}`, pageWidth - margin, y + 6, { align: "right" })
  if (data.settlementNumber) {
    doc.text(`Settlement #: ${data.settlementNumber}`, pageWidth - margin, y + 18, { align: "right" })
  }
  y += 28

  drawLine(doc, y)
  y += 10

  // ─── Driver Information ──────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "DRIVER INFORMATION")
  y += 8

  const col1 = margin
  const col2 = margin + contentWidth / 3
  const col3 = margin + (contentWidth / 3) * 2

  drawField(doc, col1, y, "Driver Name", data.driverName, 160)
  drawField(doc, col2, y, "Phone", data.driverPhone || "—", 120)
  drawField(doc, col3, y, "Email", data.driverEmail || "—", 160)
  y += 28

  drawField(doc, col1, y, "Truck #", data.truckNumber || "—", 120)
  drawField(doc, col2, y, "Owner", data.owner || "—", 120)
  drawField(doc, col3, y, "Status", data.status, 120)
  y += 28

  // ─── Pay Period ──────────────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "PAY PERIOD")
  y += 8

  drawField(doc, col1, y, "Period Start", fmtDate(data.periodStart), 120)
  drawField(doc, col2, y, "Period End", fmtDate(data.periodEnd), 120)
  y += 28

  // ─── Summary Totals ──────────────────────────────────────
  y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, "SUMMARY")
  y += 10

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(BRAND.black)

  const summaryCol1 = margin + 20
  const summaryCol2 = pageWidth - margin - 20

  doc.text("Total Driver Pay:", summaryCol1, y)
  doc.setTextColor("#16a34a") // green
  doc.text(fmtCurrency(data.totalDriverPay), summaryCol2, y, { align: "right" })
  y += 16

  doc.setTextColor(BRAND.black)
  doc.text("Total Deductions:", summaryCol1, y)
  doc.setTextColor("#dc2626") // red
  doc.text(`-${fmtCurrency(data.totalDeductions)}`, summaryCol2, y, { align: "right" })
  y += 16

  drawLine(doc, y)
  y += 8

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(BRAND.black)
  doc.text("Net Pay:", summaryCol1, y)
  doc.text(fmtCurrency(data.netPay), summaryCol2, y, { align: "right" })
  y += 20

  // ─── Pay Items Table ─────────────────────────────────────
  if (data.payItems.length > 0) {
    y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, `DRIVER PAY ITEMS (${data.payItems.length})`)
    y += 6

    // Table headers
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.gray)
    doc.text("Load #", margin + 4, y + 8)
    doc.text("From", margin + 80, y + 8)
    doc.text("To", margin + 230, y + 8)
    doc.text("Date", margin + 380, y + 8)
    doc.text("Amount", pageWidth - margin - 4, y + 8, { align: "right" })
    y += 14
    drawLine(doc, y, "#d1d5db")
    y += 4

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)

    for (const item of data.payItems) {
      if (y > pageHeight - 80) {
        doc.addPage()
        y = margin
      }

      doc.setTextColor(BRAND.black)
      doc.text(item.loadRef || "—", margin + 4, y + 8, { maxWidth: 72 })
      doc.setTextColor(BRAND.gray)
      const fromText = doc.splitTextToSize(item.from || "—", 145)
      doc.text(fromText[0] || "—", margin + 80, y + 8)
      const toText = doc.splitTextToSize(item.to || "—", 145)
      doc.text(toText[0] || "—", margin + 230, y + 8)
      doc.text(fmtDate(item.date), margin + 380, y + 8)
      doc.setTextColor("#16a34a")
      doc.text(fmtCurrency(item.amount), pageWidth - margin - 4, y + 8, { align: "right" })
      y += 14
    }

    y += 6
  }

  // ─── Deduction Items Table ────────────────────────────────
  if (data.deductionItems.length > 0) {
    if (y > pageHeight - 100) {
      doc.addPage()
      y = margin
    }

    y = drawHeaderBar(doc, y, 18, BRAND.blueHeader, `DEDUCTIONS (${data.deductionItems.length})`)
    y += 6

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.gray)
    doc.text("Type", margin + 4, y + 8)
    doc.text("Description", margin + 120, y + 8)
    doc.text("Date", margin + 380, y + 8)
    doc.text("Amount", pageWidth - margin - 4, y + 8, { align: "right" })
    y += 14
    drawLine(doc, y, "#d1d5db")
    y += 4

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)

    for (const item of data.deductionItems) {
      if (y > pageHeight - 80) {
        doc.addPage()
        y = margin
      }

      doc.setTextColor(BRAND.black)
      doc.text(item.type || "—", margin + 4, y + 8, { maxWidth: 110 })
      doc.setTextColor(BRAND.gray)
      const descText = doc.splitTextToSize(item.description || "—", 250)
      doc.text(descText[0] || "—", margin + 120, y + 8)
      doc.text(fmtDate(item.date), margin + 380, y + 8)
      doc.setTextColor("#dc2626")
      doc.text(`-${fmtCurrency(item.amount)}`, pageWidth - margin - 4, y + 8, { align: "right" })
      y += 14
    }

    y += 6
  }

  // ─── Signature Lines ──────────────────────────────────────
  if (y > pageHeight - 100) {
    doc.addPage()
    y = margin
  }

  y += 20
  drawLine(doc, y)
  y += 20

  drawSignatureLine(doc, margin, y, "Driver Signature", 200)
  drawSignatureLine(doc, pageWidth - margin - 200, y, "Date", 200)
  y += 30

  drawSignatureLine(doc, margin, y, "Authorized Signature", 200)
  drawSignatureLine(doc, pageWidth - margin - 200, y, "Date", 200)

  // ─── Footer ────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(BRAND.grayLight)
    doc.text(
      `TigerHawk TMS — Settlement Statement — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    )
  }

  const filename = `settlement-${data.driverName.replace(/\s+/g, "-")}-${data.periodStart}-to-${data.periodEnd}.pdf`
  downloadPdf(doc, filename)
}
