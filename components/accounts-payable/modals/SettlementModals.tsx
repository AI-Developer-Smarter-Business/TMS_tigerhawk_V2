// components/accounts-payable/modals/SettlementModals.tsx
// All settlement-related modals:
//   1. DriverDetailModal – full driver settlement detail with tabs
//   2. ReviewConfirmModal – confirm review action
//   3. FinalizeConfirmModal – confirm finalize action
//   4. EmailSettlementModal – send settlement email (driver email or custom)
"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Loader2, Download, Mail, Eye, AlertTriangle, Check, ChevronLeft, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { generateSettlementPdf, SettlementPdfData } from "@/lib/pdf/generateSettlement"

const formatCurrency = (amount: number) =>
  `$${(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ═══════════════════════════════════════════════════════════════
//  Shared types
// ═══════════════════════════════════════════════════════════════

export interface SettlementRecord {
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

interface PayItem {
  id: string
  load_id: string
  pay_date: string
  amount: number
  status: string
  from_location?: string
  to_location?: string
  container_number?: string
  notes?: string
  loads?: { id: string; reference_number: string } | null
}

interface DeductionItem {
  id: string
  deduction_date: string
  deduction_type: string
  description: string
  amount: number
  status: string
}

// ═══════════════════════════════════════════════════════════════
//  1. Driver Detail Modal
// ═══════════════════════════════════════════════════════════════

interface DriverDetailModalProps {
  isOpen: boolean
  settlement: SettlementRecord
  startDate: Date
  endDate: Date
  onClose: () => void
  onReview: (id: string) => void
  onFinalize: (id: string) => void
  onStatusChange: () => void
}

export function DriverDetailModal({
  isOpen,
  settlement,
  startDate,
  endDate,
  onClose,
  onReview,
  onFinalize,
  onStatusChange,
}: DriverDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"pay" | "deductions" | "notes">("pay")
  const [payItems, setPayItems] = useState<PayItem[]>([])
  const [deductionItems, setDeductionItems] = useState<DeductionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [driverEmail, setDriverEmail] = useState<string | null>(null)

  // Fetch detailed data from the settlement GET endpoint
  const fetchDetail = useCallback(async () => {
    if (!settlement.settlement_record?.id) {
      // No settlement record yet — fetch pay items directly
      setLoading(true)
      try {
        const periodStart = format(startDate, "yyyy-MM-dd")
        const periodEnd = format(endDate, "yyyy-MM-dd")

        const [payRes, dedRes] = await Promise.all([
          fetch(`/api/accounts-payable/driver-pay?driver_id=${settlement.driver_id}&startDate=${periodStart}&endDate=${periodEnd}&status=Approved,Settled,Paid`),
          fetch(`/api/accounts-payable/deductions?driver_id=${settlement.driver_id}&startDate=${periodStart}&endDate=${periodEnd}`),
        ])

        if (payRes.ok) {
          const payData = await payRes.json()
          setPayItems(Array.isArray(payData) ? payData : payData.data || [])
        }
        if (dedRes.ok) {
          const dedData = await dedRes.json()
          setDeductionItems(Array.isArray(dedData) ? dedData : dedData.data || [])
        }
      } catch (err) {
        console.error("Error fetching driver detail:", err)
        setError("Failed to load details")
      } finally {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/accounts-payable/settlements/${settlement.settlement_record.id}`)
      if (!response.ok) throw new Error("Failed to fetch settlement details")

      const result = await response.json()
      setPayItems(result.pay_items || [])
      setDeductionItems(result.deductions || [])

      // Get driver email from the settlement data
      if (result.data?.drivers?.email) {
        setDriverEmail(result.data.drivers.email)
      }
    } catch (err) {
      console.error("Error fetching settlement detail:", err)
      setError("Failed to load settlement details")
    } finally {
      setLoading(false)
    }
  }, [settlement, startDate, endDate])

  useEffect(() => {
    if (isOpen) {
      fetchDetail()
    }
  }, [isOpen, fetchDetail])

  // Also try to fetch driver email if not yet available
  useEffect(() => {
    if (isOpen && !driverEmail) {
      fetch(`/api/drivers/${settlement.driver_id}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.email) setDriverEmail(data.email)
        })
        .catch(() => {})
    }
  }, [isOpen, settlement.driver_id, driverEmail])

  const unapprovedCount = payItems.filter(p => p.status === "Unapproved").length
  const approvedCount = payItems.filter(p => p.status !== "Unapproved").length

  const handleDownloadPdf = () => {
    const pdfData: SettlementPdfData = {
      driverName: settlement.driver.name,
      driverPhone: settlement.driver.phone,
      driverEmail: driverEmail || settlement.driver.email,
      truckNumber: settlement.truck_number || undefined,
      owner: settlement.owner || undefined,
      settlementNumber: settlement.settlement_record?.settlement_number,
      periodStart: settlement.period_start || format(startDate, "yyyy-MM-dd"),
      periodEnd: settlement.period_end || format(endDate, "yyyy-MM-dd"),
      totalDriverPay: settlement.total_driver_pay,
      totalDeductions: settlement.total_deductions,
      netPay: settlement.net_pay,
      status: settlement.status,
      payItems: payItems.map(item => ({
        loadRef: item.loads?.reference_number || "—",
        from: item.from_location || "—",
        to: item.to_location || "—",
        amount: item.amount,
        date: item.pay_date,
        status: item.status,
      })),
      deductionItems: deductionItems.map(item => ({
        type: item.deduction_type,
        description: item.description || "",
        amount: item.amount,
        date: item.deduction_date,
      })),
    }
    generateSettlementPdf(pdfData)
  }

  const handleReviewConfirmed = () => {
    setShowReviewModal(false)
    onReview(settlement.id)
  }

  const handleFinalizeConfirmed = () => {
    setShowFinalizeModal(false)
    onFinalize(settlement.id)
  }

  if (!isOpen) return null

  const periodStr = `${format(startDate, "MM/dd")} - ${format(endDate, "MM/dd/yyyy")}`

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-8 overflow-y-auto">
        <div className="bg-[#0B1120] border border-white/10 rounded-xl w-full max-w-5xl mx-4 mb-8 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#E8700A] flex items-center justify-center text-white font-bold text-sm">
                {settlement.driver.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{settlement.driver.name}</h2>
                <p className="text-xs text-gray-500">{settlement.driver.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500">Driver Pay</p>
                <p className="text-sm font-bold text-white">{formatCurrency(settlement.total_driver_pay)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Deduction</p>
                <p className="text-sm font-bold text-white">{formatCurrency(settlement.total_deductions)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Net Pay</p>
                <p className="text-sm font-bold text-white">{formatCurrency(settlement.net_pay)}</p>
              </div>
              <button onClick={onClose} className="ml-4 text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center border-b border-white/10">
            <button
              onClick={() => setActiveTab("pay")}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "pay"
                  ? "text-[#E8700A] border-[#E8700A]"
                  : "text-gray-400 border-transparent hover:text-gray-300"
              }`}
            >
              Driver Pay
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                activeTab === "pay" ? "bg-[#E8700A]/20 text-[#E8700A]" : "bg-white/10 text-gray-400"
              }`}>
                {payItems.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("deductions")}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "deductions"
                  ? "text-[#E8700A] border-[#E8700A]"
                  : "text-gray-400 border-transparent hover:text-gray-300"
              }`}
            >
              Deduction
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                activeTab === "deductions" ? "bg-[#E8700A]/20 text-[#E8700A]" : "bg-white/10 text-gray-400"
              }`}>
                {deductionItems.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "notes"
                  ? "text-[#E8700A] border-[#E8700A]"
                  : "text-gray-400 border-transparent hover:text-gray-300"
              }`}
            >
              Notes
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                activeTab === "notes" ? "bg-[#E8700A]/20 text-[#E8700A]" : "bg-white/10 text-gray-400"
              }`}>
                0
              </span>
            </button>
          </div>

          {/* Sub-header: status chips + date range */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#111827]/50 border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-red-900/30 text-red-400 border border-red-800 rounded text-xs font-medium">
                Unapproved {unapprovedCount}
              </span>
              <span className="px-2.5 py-1 bg-green-900/30 text-green-400 border border-green-800 rounded text-xs font-medium">
                Approved {approvedCount}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Driver Pay / Deduction Date</span>
              <span className="font-medium text-white">{periodStr}</span>
            </div>
          </div>

          {/* Tab Content */}
          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[#E8700A]" />
                <span className="ml-2 text-gray-400">Loading...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-16 text-red-400">
                {error}
              </div>
            ) : activeTab === "pay" ? (
              <table className="w-full">
                <thead className="bg-[#0B1120] sticky top-0">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">
                      <input type="checkbox" className="rounded border-gray-600" disabled />
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Load #</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Container #</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">From</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">To</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Date & Time</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No pay items found</td>
                    </tr>
                  ) : (
                    payItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2.5">
                          <input type="checkbox" className="rounded border-gray-600" />
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[#E8700A] text-sm font-medium">
                            {item.loads?.reference_number || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-300">{item.container_number || "—"}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-300">
                          {/* Load-level status placeholder */}
                          —
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-300 max-w-[180px] truncate">
                          {item.from_location || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-300 max-w-[180px] truncate">
                          {item.to_location || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium text-white">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-300">
                          {item.pay_date ? format(new Date(item.pay_date), "MM/dd HH:mm a") : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            item.status === "Approved"
                              ? "bg-green-900/30 text-green-400 border border-green-800"
                              : item.status === "Settled"
                              ? "bg-blue-900/30 text-blue-400 border border-blue-800"
                              : "bg-red-900/30 text-red-400 border border-red-800"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : activeTab === "deductions" ? (
              <table className="w-full">
                <thead className="bg-[#0B1120] sticky top-0">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Description</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {deductionItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No deductions found</td>
                    </tr>
                  ) : (
                    deductionItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2.5 text-sm text-gray-300">{item.deduction_type}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-300">{item.description || "—"}</td>
                        <td className="px-4 py-2.5 text-sm text-right font-medium text-red-400">
                          -{formatCurrency(item.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-300">
                          {item.deduction_date ? format(new Date(item.deduction_date), "MM/dd/yyyy") : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            item.status === "Approved"
                              ? "bg-green-900/30 text-green-400 border border-green-800"
                              : "bg-orange-900/30 text-orange-400 border border-orange-800"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center py-16 text-gray-500">
                No notes for this settlement period
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-[#111827]/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg transition-colors"
            >
              Close
            </button>
            {settlement.status === "Pending" && (
              <button
                onClick={() => setShowReviewModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Review
              </button>
            )}
            {(settlement.status === "Pending" || settlement.status === "Reviewed") && (
              <button
                onClick={() => setShowFinalizeModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Finalize Settlement
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      {showReviewModal && (
        <ReviewConfirmModal
          isOpen={showReviewModal}
          periodStart={startDate}
          periodEnd={endDate}
          onConfirm={handleReviewConfirmed}
          onCancel={() => setShowReviewModal(false)}
        />
      )}
      {showFinalizeModal && (
        <FinalizeConfirmModal
          isOpen={showFinalizeModal}
          periodStart={startDate}
          periodEnd={endDate}
          onConfirm={handleFinalizeConfirmed}
          onCancel={() => setShowFinalizeModal(false)}
        />
      )}
      {showEmailModal && (
        <EmailSettlementModal
          isOpen={showEmailModal}
          settlement={settlement}
          driverEmail={driverEmail}
          payItemCount={payItems.length}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
//  2. Review Confirm Modal
// ═══════════════════════════════════════════════════════════════

interface ReviewConfirmModalProps {
  isOpen: boolean
  periodStart: Date
  periodEnd: Date
  onConfirm: () => void
  onCancel: () => void
}

export function ReviewConfirmModal({ isOpen, periodStart, periodEnd, onConfirm, onCancel }: ReviewConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-8 text-center shadow-2xl">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-gray-500" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Are You Sure You Want To Mark This Settlement As Reviewed?
        </h2>

        <p className="text-blue-600 text-sm mb-6">
          All Approved Driver Pay And Deductions Will Be Added To The Settlement.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8 inline-block">
          <p className="text-xs text-gray-500 mb-1">Driver Pay / Deduction Date</p>
          <p className="text-lg font-bold text-gray-900">
            {format(periodStart, "MM/dd")} - {format(periodEnd, "MM/dd")}
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Yes, Review
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  3. Finalize Confirm Modal
// ═══════════════════════════════════════════════════════════════

interface FinalizeConfirmModalProps {
  isOpen: boolean
  periodStart: Date
  periodEnd: Date
  onConfirm: () => void
  onCancel: () => void
}

export function FinalizeConfirmModal({ isOpen, periodStart, periodEnd, onConfirm, onCancel }: FinalizeConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-8 text-center shadow-2xl">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-gray-500" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Are You Sure You Want To Mark This Settlement As Finalized?
        </h2>

        <p className="text-blue-600 text-sm mb-4">
          All Approved Driver Pay And Deductions Will Be Added To The Settlement.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 inline-block">
          <p className="text-xs text-gray-500 mb-1">Driver Pay / Deduction Date</p>
          <p className="text-lg font-bold text-gray-900">
            {format(periodStart, "MM/dd")} - {format(periodEnd, "MM/dd")}
          </p>
        </div>

        <p className="text-red-500 text-sm mb-8">
          You Won&apos;t Be Able To Edit The Settlement After Finalizing.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            Yes, Finalize
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  4. Email Settlement Modal
// ═══════════════════════════════════════════════════════════════

interface EmailSettlementModalProps {
  isOpen: boolean
  settlement: SettlementRecord
  driverEmail: string | null
  payItemCount: number
  startDate: Date
  endDate: Date
  onClose: () => void
}

export function EmailSettlementModal({ isOpen, settlement, driverEmail, payItemCount, startDate, endDate, onClose }: EmailSettlementModalProps) {
  const [emailTarget, setEmailTarget] = useState<"driver" | "custom">(driverEmail ? "driver" : "custom")
  const [customEmail, setCustomEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setResult(null)
      setCustomEmail("")
    }
  }, [isOpen])

  // Update email target when driverEmail becomes available (async fetch)
  useEffect(() => {
    if (isOpen) {
      setEmailTarget(driverEmail ? "driver" : "custom")
    }
  }, [isOpen, driverEmail])

  const targetEmail = emailTarget === "driver" ? (driverEmail || "") : customEmail

  const handleSend = async () => {
    if (!targetEmail) return

    setSending(true)
    setResult(null)
    try {
      const response = await fetch("/api/accounts-payable/settlements/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetEmail,
          driverName: settlement.driver.name,
          periodStart: settlement.period_start || format(startDate, "yyyy-MM-dd"),
          periodEnd: settlement.period_end || format(endDate, "yyyy-MM-dd"),
          totalDriverPay: settlement.total_driver_pay,
          totalDeductions: settlement.total_deductions,
          netPay: settlement.net_pay,
          settlementNumber: settlement.settlement_record?.settlement_number || null,
          payItemCount,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setResult({ success: true, message: `Settlement email sent to ${targetEmail}` })
      } else {
        setResult({ success: false, message: data.error || "Failed to send email" })
      }
    } catch {
      setResult({ success: false, message: "Network error sending email" })
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-[#111827] border border-white/10 rounded-xl w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#E8700A]" />
            Email Settlement
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-gray-400 space-y-1">
            <p>Settlement for <span className="text-white font-medium">{settlement.driver.name}</span></p>
            <p>Net Pay: <span className="text-white font-medium">{formatCurrency(settlement.net_pay)}</span></p>
          </div>

          {/* Email target selection */}
          <div className="space-y-2">
            <label className="block text-xs text-gray-400 uppercase tracking-wider">Send To</label>

            {driverEmail && (
              <label className="flex items-center gap-3 p-3 bg-[#0B1120] border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                <input
                  type="radio"
                  name="emailTarget"
                  checked={emailTarget === "driver"}
                  onChange={() => setEmailTarget("driver")}
                  className="text-[#E8700A]"
                />
                <div>
                  <p className="text-sm text-white">Driver Email</p>
                  <p className="text-xs text-gray-500">{driverEmail}</p>
                </div>
              </label>
            )}

            <label className="flex items-center gap-3 p-3 bg-[#0B1120] border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
              <input
                type="radio"
                name="emailTarget"
                checked={emailTarget === "custom"}
                onChange={() => setEmailTarget("custom")}
                className="text-[#E8700A]"
              />
              <div className="flex-1">
                <p className="text-sm text-white">Custom Email</p>
                {emailTarget === "custom" && (
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="Enter email address..."
                    className="mt-2 w-full bg-[#0B1120] border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                    autoFocus
                  />
                )}
              </div>
            </label>
          </div>

          {/* Result message */}
          {result && (
            <div className={`p-3 rounded-lg text-sm ${
              result.success
                ? "bg-green-900/30 text-green-400 border border-green-800"
                : "bg-red-900/30 text-red-400 border border-red-800"
            }`}>
              {result.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              {result?.success ? "Done" : "Cancel"}
            </button>
            {!result?.success && (
              <button
                onClick={handleSend}
                disabled={sending || !targetEmail}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#E8700A] hover:bg-[#FF9500] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Send Email
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
