"use client"

import { useState, useRef } from "react"
import { ChevronLeft, ChevronRight, Download, Mail, Eye, Loader2, Calendar, X, Check } from "lucide-react"
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns"
import { useRouter } from "next/navigation"
import { SearchableSelect } from "@/components/ui/SearchableSelect"
import {
  DriverDetailModal,
  ReviewConfirmModal,
  FinalizeConfirmModal,
  EmailSettlementModal,
  SettlementRecord,
} from "@/components/accounts-payable/modals/SettlementModals"
import { generateSettlementPdf, SettlementPdfData } from "@/lib/pdf/generateSettlement"
import { useUserRole } from "@/lib/auth/useUserRole"

const formatCurrency = (amount: number) => `$${(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Settlement {
  id: string
  driver_id: string
  driver: {
    id: string
    name: string
    phone: string
    email?: string
  }
  truck_number: string | null
  owner: string | null
  total_driver_pay: number
  total_deductions: number
  net_pay: number
  status: "Pending" | "Reviewed" | "Finalized" | "Paid"
  period_start?: string
  period_end?: string
  settlement_record?: any
}

interface Driver {
  id: string
  name: string
}

interface FleetOwner {
  id: string
  name: string
}

interface Stats {
  pending: { count: number }
  reviewed: { count: number }
  finalized: { count: number }
}

interface SettlementsViewProps {
  initialData: Settlement[]
  drivers: Driver[]
  fleetOwners: FleetOwner[]
  stats: Stats
  initialStartDate: Date
  initialEndDate: Date
}

export function SettlementsView({
  initialData,
  drivers,
  fleetOwners,
  stats,
  initialStartDate,
  initialEndDate,
}: SettlementsViewProps) {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [selectedDriver, setSelectedDriver] = useState<string>("all")
  const [selectedOwner, setSelectedOwner] = useState<string>("all")
  const [data, setData] = useState(initialData)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedDeductions, setUploadedDeductions] = useState<any[]>([])
  const [showUploadPreview, setShowUploadPreview] = useState(false)

  // Modal state
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null)
  const [showDriverDetail, setShowDriverDetail] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [csvDownloadType, setCsvDownloadType] = useState<"pay-breakdown" | "deductions" | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null)
  const [finalizeTargetId, setFinalizeTargetId] = useState<string | null>(null)
  const canExportFinancialCsv =
    role === "admin" || role === "finance" || role === "accounting"
  const canGenerateSettlements =
    role === "admin" || role === "finance" || role === "accounting"

  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [generatePreview, setGeneratePreview] = useState<{
    driver_count: number
    pay_record_count: number
    drivers: Array<{
      driver_id: string
      driver_name: string
      pay_record_count: number
      total_driver_pay: number
      net_pay: number
    }>
  } | null>(null)
  const [generateLoading, setGenerateLoading] = useState<"preview" | "post" | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generateMessage, setGenerateMessage] = useState<string | null>(null)
  const [settlementActionError, setSettlementActionError] = useState<string | null>(null)

  const handlePreviousWeek = () => {
    const prev = addWeeks(startDate, -1)
    const newStart = startOfWeek(prev, { weekStartsOn: 0 })
    const newEnd = endOfWeek(prev, { weekStartsOn: 0 })
    setStartDate(newStart)
    setEndDate(newEnd)
    updateURL(newStart, newEnd)
  }

  const handleNextWeek = () => {
    const next = addWeeks(startDate, 1)
    const newStart = startOfWeek(next, { weekStartsOn: 0 })
    const newEnd = endOfWeek(next, { weekStartsOn: 0 })
    setStartDate(newStart)
    setEndDate(newEnd)
    updateURL(newStart, newEnd)
  }

  const updateURL = (start: Date, end: Date) => {
    const query = new URLSearchParams({
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    })
    router.push(`/dashboard/accounts-payable/settlements?${query.toString()}`)
  }

  const filteredData = data.filter((settlement) => {
    if (selectedDriver !== "all" && settlement.driver_id !== selectedDriver) return false
    if (selectedOwner !== "all" && settlement.owner !== selectedOwner)
      return false
    return true
  })

  const getAvatarColor = (driverId: string): string => {
    const colors = [
      "bg-[#E8700A]",
      "bg-[#2a3040]",
      "bg-[#363f52]",
      "bg-[#E8700A]/80",
      "bg-[#2a3040]/90",
      "bg-[#363f52]/80",
      "bg-[#E8700A]/70",
      "bg-[#2a3040]/80",
      "bg-[#363f52]/90",
      "bg-[#E8700A]/60",
    ]
    const index = driverId.charCodeAt(0) % colors.length
    return colors[index]
  }

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // ─── Review & Finalize with confirmation modals ──────────
  const openReviewConfirm = (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setReviewTargetId(settlement.id)
    setShowReviewModal(true)
  }

  const openFinalizeConfirm = (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setFinalizeTargetId(settlement.id)
    setShowFinalizeModal(true)
  }

  const handleReviewConfirmed = async () => {
    if (!reviewTargetId) return
    setShowReviewModal(false)
    setSettlementActionError(null)
    setLoadingId(reviewTargetId)
    try {
      const response = await fetch(`/api/accounts-payable/settlements/${reviewTargetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Reviewed" }),
      })

      if (response.ok) {
        setData((prev) =>
          prev.map((s) =>
            s.id === reviewTargetId ? { ...s, status: "Reviewed" } : s
          )
        )
        router.refresh()
      } else {
        const payload = await response.json().catch(() => null)
        setSettlementActionError(
          typeof payload?.error === "string" ? payload.error : `Review failed (${response.status})`
        )
      }
    } catch (error) {
      console.error("Error updating settlement:", error)
      setSettlementActionError("Could not update settlement. Try again.")
    } finally {
      setLoadingId(null)
      setReviewTargetId(null)
    }
  }

  const handleFinalizeConfirmed = async () => {
    if (!finalizeTargetId) return
    setShowFinalizeModal(false)
    setSettlementActionError(null)
    setLoadingId(finalizeTargetId)
    try {
      const response = await fetch(`/api/accounts-payable/settlements/${finalizeTargetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Finalized" }),
      })

      if (response.ok) {
        setData((prev) =>
          prev.map((s) =>
            s.id === finalizeTargetId ? { ...s, status: "Finalized" } : s
          )
        )
        router.refresh()
      } else {
        const payload = await response.json().catch(() => null)
        setSettlementActionError(
          typeof payload?.error === "string" ? payload.error : `Finalize failed (${response.status})`
        )
      }
    } catch (error) {
      console.error("Error finalizing settlement:", error)
      setSettlementActionError("Could not finalize settlement. Try again.")
    } finally {
      setLoadingId(null)
      setFinalizeTargetId(null)
    }
  }

  const periodStartStr = format(startDate, "yyyy-MM-dd")
  const periodEndStr = format(endDate, "yyyy-MM-dd")

  const openGenerateModal = async () => {
    setGenerateError(null)
    setGenerateMessage(null)
    setGenerateLoading("preview")
    try {
      const qs = new URLSearchParams({
        period_start: periodStartStr,
        period_end: periodEndStr,
      })
      if (selectedDriver !== "all") {
        qs.set("driver_id", selectedDriver)
      }
      const res = await fetch(`/api/accounts-payable/settlements/generate?${qs.toString()}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setGenerateError(typeof data?.error === "string" ? data.error : "Preview failed")
        setGeneratePreview(null)
        return
      }
      setGeneratePreview({
        driver_count: data.driver_count ?? 0,
        pay_record_count: data.pay_record_count ?? 0,
        drivers: Array.isArray(data.drivers) ? data.drivers : [],
      })
      setGenerateModalOpen(true)
    } catch {
      setGenerateError("Preview failed")
      setGeneratePreview(null)
    } finally {
      setGenerateLoading(null)
    }
  }

  const runGenerateSettlements = async () => {
    setGenerateError(null)
    setGenerateMessage(null)
    setGenerateLoading("post")
    try {
      const body: { period_start: string; period_end: string; driver_id?: string } = {
        period_start: periodStartStr,
        period_end: periodEndStr,
      }
      if (selectedDriver !== "all") {
        body.driver_id = selectedDriver
      }
      const res = await fetch("/api/accounts-payable/settlements/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setGenerateError(typeof data?.error === "string" ? data.error : `Generate failed (${res.status})`)
        return
      }
      const n = typeof data.settlements_created === "number" ? data.settlements_created : 0
      setGenerateMessage(`Created ${n} settlement(s). Pay lines updated to Settled where linked.`)
      setGenerateModalOpen(false)
      router.refresh()
    } catch {
      setGenerateError("Generate failed")
    } finally {
      setGenerateLoading(null)
    }
  }

  // ─── Download settlement as PDF ──────────────────────────
  const handleDownloadSettlement = async (settlement: Settlement) => {
    let payItems: SettlementPdfData["payItems"] = []
    let deductionItems: SettlementPdfData["deductionItems"] = []

    // Fetch full detail data before generating the PDF
    if (settlement.settlement_record?.id) {
      try {
        const res = await fetch(`/api/accounts-payable/settlements/${settlement.settlement_record.id}`)
        if (res.ok) {
          const result = await res.json()
          payItems = (result.pay_items || []).map((item: any) => ({
            loadRef: item.loads?.reference_number || "—",
            from: item.from_location || "—",
            to: item.to_location || "—",
            amount: item.amount,
            date: item.pay_date,
            status: item.status,
          }))
          deductionItems = (result.deductions || []).map((item: any) => ({
            type: item.deduction_type,
            description: item.description || "",
            amount: item.amount,
            date: item.deduction_date,
          }))
        }
      } catch (err) {
        console.error("Error fetching settlement details for PDF:", err)
      }
    }

    generateSettlementPdf({
      driverName: settlement.driver.name,
      driverPhone: settlement.driver.phone,
      driverEmail: settlement.driver.email,
      truckNumber: settlement.truck_number || undefined,
      owner: settlement.owner || undefined,
      settlementNumber: settlement.settlement_record?.settlement_number,
      periodStart: settlement.period_start || format(startDate, "yyyy-MM-dd"),
      periodEnd: settlement.period_end || format(endDate, "yyyy-MM-dd"),
      totalDriverPay: settlement.total_driver_pay,
      totalDeductions: settlement.total_deductions,
      netPay: settlement.net_pay,
      status: settlement.status,
      payItems,
      deductionItems,
    })
  }

  // ─── Email settlement modal ──────────────────────────────
  const openEmailModal = (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setShowEmailModal(true)
  }

  // ─── Row click → driver detail modal ─────────────────────
  const openDriverDetail = (settlement: Settlement) => {
    setSelectedSettlement(settlement)
    setShowDriverDetail(true)
  }

  // ─── CSV exports ─────────────────────────────────────────
  const downloadCsv = async (type: "pay-breakdown" | "deductions") => {
    if (!canExportFinancialCsv) {
      setCsvError("Only admin and finance users can export settlements CSVs.")
      return
    }

    setCsvError(null)
    setCsvDownloadType(type)
    try {
      const response = await fetch(
        `/api/accounts-payable/settlements/csv?type=${type}&startDate=${format(
          startDate,
          "yyyy-MM-dd"
        )}&endDate=${format(endDate, "yyyy-MM-dd")}`
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const apiError = payload && typeof payload.error === "string" ? payload.error : "CSV export failed"
        setCsvError(apiError)
        return
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${type}-${format(new Date(), "yyyy-MM-dd")}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error(`[SettlementsView] Error downloading ${type} CSV:`, error)
      setCsvError("Could not download CSV right now. Please try again.")
    } finally {
      setCsvDownloadType(null)
    }
  }

  const handleDownloadPayBreakdown = async () => {
    await downloadCsv("pay-breakdown")
  }

  const handleDownloadDeductions = async () => {
    await downloadCsv("deductions")
  }

  // ─── Deduction upload ────────────────────────────────────
  const handleUploadDeductionsClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const lines = text.split("\n").filter((line) => line.trim())

      if (lines.length < 2) {
        alert("CSV file must contain headers and at least one row")
        return
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
      const deductions = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim())
        const row: any = {}
        headers.forEach((header, index) => {
          row[header] = values[index]
        })
        return row
      })

      setUploadedDeductions(deductions)
      setShowUploadPreview(true)
    } catch (error) {
      console.error("Error parsing CSV:", error)
      alert("Error parsing CSV file")
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleConfirmUploadDeductions = async () => {
    try {
      for (const deduction of uploadedDeductions) {
        const response = await fetch("/api/accounts-payable/deductions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driver_id: deduction.driver_id,
            deduction_type: deduction.deduction_type,
            description: deduction.description || null,
            amount: parseFloat(deduction.amount),
            deduction_date: deduction.deduction_date || new Date().toISOString(),
            status: "Unapproved",
          }),
        })

        if (!response.ok) {
          console.error("Error uploading deduction:", response.statusText)
        }
      }

      alert("Deductions uploaded successfully")
      setShowUploadPreview(false)
      setUploadedDeductions([])
    } catch (error) {
      console.error("Error confirming upload:", error)
      alert("Error uploading deductions")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Reviewed":
        return "bg-blue-900/30 text-blue-400 border border-blue-800"
      case "Finalized":
        return "bg-green-900/30 text-green-400 border border-green-800"
      case "Paid":
        return "bg-purple-900/30 text-purple-400 border border-purple-800"
      default:
        return "bg-orange-900/30 text-orange-400 border border-orange-800"
    }
  }

  // Callback when status changes inside the driver detail modal
  const handleDriverDetailStatusChange = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-white mt-2">{stats.pending.count}</p>
        </div>

        <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Reviewed</p>
          <p className="text-2xl font-bold text-white mt-2">{stats.reviewed.count}</p>
        </div>

        <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Finalized</p>
          <p className="text-2xl font-bold text-white mt-2">{stats.finalized.count}</p>
        </div>
      </div>

      {/* Action Buttons and Period Selector */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
          {canGenerateSettlements && (
            <button
              type="button"
              onClick={openGenerateModal}
              disabled={generateLoading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-[#E8700A] hover:bg-[#c75f08] disabled:opacity-50 text-white rounded font-medium transition-colors whitespace-nowrap"
              title="Create settlements from Unapproved/Approved pay in this period"
            >
              {generateLoading === "preview" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              Generate settlements
            </button>
          )}
          <button
            onClick={handleDownloadPayBreakdown}
            disabled={roleLoading || !canExportFinancialCsv || csvDownloadType !== null}
            className="flex items-center gap-2 px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded font-medium transition-colors whitespace-nowrap"
            title={!canExportFinancialCsv ? "Only admin and finance can export this report" : "Export pay breakdown CSV"}
          >
            {csvDownloadType === "pay-breakdown" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Pay Breakdown CSV
          </button>

          <button
            onClick={handleDownloadDeductions}
            disabled={roleLoading || !canExportFinancialCsv || csvDownloadType !== null}
            className="flex items-center gap-2 px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded font-medium transition-colors whitespace-nowrap"
            title={!canExportFinancialCsv ? "Only admin and finance can export this report" : "Export deductions CSV"}
          >
            {csvDownloadType === "deductions" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Deductions CSV
          </button>

          <button
            onClick={handleUploadDeductionsClick}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors whitespace-nowrap">
            + Upload Deductions
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleFileSelected}
          />
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-4 pt-2 border-t border-white/10">
          <button
            onClick={handlePreviousWeek}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">
              {format(startDate, "MMM dd")} - {format(endDate, "MMM dd, yyyy")}
            </span>
          </div>

          <button
            onClick={handleNextWeek}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Next week"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        {csvError && (
          <p className="text-xs text-red-400">{csvError}</p>
        )}
        {settlementActionError && (
          <p className="text-xs text-red-400">{settlementActionError}</p>
        )}
        {generateError && !generateModalOpen && (
          <p className="text-xs text-red-400">{generateError}</p>
        )}
        {generateMessage && (
          <p className="text-xs text-green-400">{generateMessage}</p>
        )}
      </div>

      {generateModalOpen && generatePreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-white/10 rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <h4 className="text-lg font-semibold text-white">Generate settlements</h4>
            <p className="text-sm text-gray-400">
              Period {periodStartStr} → {periodEndStr}
              {selectedDriver !== "all" ? " (filtered driver)" : ""}.{" "}
              {generatePreview.pay_record_count} pay line(s) across {generatePreview.driver_count} driver(s).
            </p>
            {generatePreview.drivers.length > 0 && (
              <ul className="text-xs space-y-1 max-h-48 overflow-y-auto border border-white/10 rounded p-2 text-gray-300">
                {generatePreview.drivers.map((d) => (
                  <li key={d.driver_id} className="flex justify-between gap-2">
                    <span className="truncate">{d.driver_name}</span>
                    <span className="text-white whitespace-nowrap">${(d.net_pay ?? 0).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
            {generateError && <p className="text-xs text-red-400">{generateError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setGenerateModalOpen(false)
                  setGenerateError(null)
                }}
                className="px-4 py-2 border border-white/20 text-gray-300 rounded text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runGenerateSettlements}
                disabled={generatePreview.driver_count === 0 || generateLoading !== null}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-medium inline-flex items-center gap-2"
              >
                {generateLoading === "post" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Search Driver
            </label>
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              All Drivers
            </label>
            <SearchableSelect
              options={[{ id: "all", name: "All Drivers" }, ...drivers.map(d => ({ id: d.id, name: d.name }))]}
              value={selectedDriver}
              onChange={(value) => setSelectedDriver(value)}
              placeholder="Select driver..."
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              All Fleet Owners
            </label>
            <SearchableSelect
              options={[{ id: "all", name: "All Fleet Owners" }, ...fleetOwners.map(o => ({ id: o.id, name: o.name }))]}
              value={selectedOwner}
              onChange={(value) => setSelectedOwner(value)}
              placeholder="Select owner..."
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0B1120] border-b border-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Fleet Owner
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Truck
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Driver Pay ($)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Deduction ($)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Net Pay ($)
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Download
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                    No settlements found
                  </td>
                </tr>
              ) : (
                filteredData.map((settlement, index) => (
                  <tr
                    key={settlement.id}
                    className="hover:bg-white/5 border-b border-white/5 transition-colors cursor-pointer"
                    onClick={() => openDriverDetail(settlement)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full ${getAvatarColor(
                            settlement.driver_id
                          )} flex items-center justify-center text-white text-xs font-bold`}
                        >
                          {getInitials(settlement.driver.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {settlement.driver.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {settlement.driver.phone}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {settlement.owner || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {settlement.truck_number || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-green-400">
                      {formatCurrency(settlement.total_driver_pay)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-400">
                      {formatCurrency(settlement.total_deductions)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-white">
                      {formatCurrency(settlement.net_pay)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          await handleDownloadSettlement(settlement)
                        }}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                        title="Download settlement PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEmailModal(settlement)
                        }}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                        title="Email settlement"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                          settlement.status
                        )}`}
                      >
                        {settlement.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {settlement.status === "Pending" && (
                          <button
                            onClick={() => openReviewConfirm(settlement)}
                            disabled={loadingId === settlement.id}
                            className="px-3 py-1 border border-white/10 text-gray-400 hover:text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {loadingId === settlement.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                            Review
                          </button>
                        )}
                        {(settlement.status === "Pending" ||
                          settlement.status === "Reviewed") && (
                          <button
                            onClick={() => openFinalizeConfirm(settlement)}
                            disabled={loadingId === settlement.id}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {loadingId === settlement.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Finalize
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Preview Modal */}
      {showUploadPreview && uploadedDeductions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#111827] border border-white/10 rounded-lg p-6 max-w-2xl max-h-96 overflow-y-auto w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Preview Deductions</h2>
              <button
                onClick={() => setShowUploadPreview(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-gray-400">
                {uploadedDeductions.length} deduction(s) ready to upload
              </div>

              <div className="bg-[#0B1120] rounded border border-white/10 p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-xs text-gray-400 pb-2">Driver ID</th>
                      <th className="text-left text-xs text-gray-400 pb-2">Type</th>
                      <th className="text-left text-xs text-gray-400 pb-2">Amount</th>
                      <th className="text-left text-xs text-gray-400 pb-2">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {uploadedDeductions.map((ded, idx) => (
                      <tr key={idx}>
                        <td className="py-2 text-gray-300">{ded.driver_id}</td>
                        <td className="py-2 text-gray-300">{ded.deduction_type}</td>
                        <td className="py-2 text-gray-300">${parseFloat(ded.amount || 0).toFixed(2)}</td>
                        <td className="py-2 text-gray-300 text-xs">{ded.description || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowUploadPreview(false)}
                  className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUploadDeductions}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                >
                  Confirm Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Driver Detail Modal ───────────────────────────── */}
      {showDriverDetail && selectedSettlement && (
        <DriverDetailModal
          isOpen={showDriverDetail}
          settlement={selectedSettlement as SettlementRecord}
          startDate={startDate}
          endDate={endDate}
          onClose={() => {
            setShowDriverDetail(false)
            setSelectedSettlement(null)
          }}
          onReview={(id) => {
            setShowDriverDetail(false)
            setReviewTargetId(id)
            setShowReviewModal(true)
          }}
          onFinalize={(id) => {
            setShowDriverDetail(false)
            setFinalizeTargetId(id)
            setShowFinalizeModal(true)
          }}
          onStatusChange={handleDriverDetailStatusChange}
        />
      )}

      {/* ─── Review Confirmation Modal ─────────────────────── */}
      {showReviewModal && (
        <ReviewConfirmModal
          isOpen={showReviewModal}
          periodStart={startDate}
          periodEnd={endDate}
          onConfirm={handleReviewConfirmed}
          onCancel={() => {
            setShowReviewModal(false)
            setReviewTargetId(null)
          }}
        />
      )}

      {/* ─── Finalize Confirmation Modal ───────────────────── */}
      {showFinalizeModal && (
        <FinalizeConfirmModal
          isOpen={showFinalizeModal}
          periodStart={startDate}
          periodEnd={endDate}
          onConfirm={handleFinalizeConfirmed}
          onCancel={() => {
            setShowFinalizeModal(false)
            setFinalizeTargetId(null)
          }}
        />
      )}

      {/* ─── Email Settlement Modal ────────────────────────── */}
      {showEmailModal && selectedSettlement && (
        <EmailSettlementModal
          isOpen={showEmailModal}
          settlement={selectedSettlement as SettlementRecord}
          driverEmail={selectedSettlement.driver.email || null}
          payItemCount={filteredData.length}
          startDate={startDate}
          endDate={endDate}
          onClose={() => {
            setShowEmailModal(false)
            setSelectedSettlement(null)
          }}
        />
      )}
    </div>
  )
}
