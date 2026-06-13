"use client"

import { useState } from "react"
import { Upload, Loader2 } from "lucide-react"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

interface Customer {
  id: string
  name: string
  email: string
}

interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  amount: number
  amount_paid: number
  billing_status: string
  created_at: string
  container_number?: string
  reference_number?: string
  customers?: { id: string; name: string }
}

interface PaymentLine {
  invoiceId: string
  amount: number
}

interface PaymentsViewProps {
  initialCustomers: Customer[]
  initialInvoices: Invoice[]
  error: string | null
}

export function PaymentsView({
  initialCustomers,
  initialInvoices,
  error,
}: PaymentsViewProps) {
  const [customers] = useState(initialCustomers)
  const [invoices] = useState(initialInvoices)
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [checkNumber, setCheckNumber] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Check")
  const [depositType, setDepositType] = useState("General")
  const [notes, setNotes] = useState("")
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      // TODO: implement file upload to API
    }
  }

  const totalPaymentAmount = paymentLines.reduce((sum, line) => sum + line.amount, 0)

  const updatePaymentLine = (invoiceId: string, amount: number) => {
    const existing = paymentLines.find((l) => l.invoiceId === invoiceId)
    if (existing) {
      setPaymentLines(
        paymentLines.map((l) =>
          l.invoiceId === invoiceId ? { ...l, amount } : l
        )
      )
    } else {
      setPaymentLines([...paymentLines, { invoiceId, amount }])
    }
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg">
        Error loading payment data: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Payment Entry Form */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Enter Payment</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Select */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Customer
            </label>
            <SearchableSelect
              options={customers.map((c) => ({ id: c.id, name: c.name }))}
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              placeholder="Select a customer..."
            />
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] transition-colors"
            />
          </div>

          {/* Check Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Check #
            </label>
            <input
              type="text"
              value={checkNumber}
              onChange={(e) => setCheckNumber(e.target.value)}
              placeholder="Leave blank if not applicable"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] transition-colors"
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] transition-colors"
            >
              <option value="Check">Check</option>
              <option value="ACH">ACH</option>
              <option value="Wire">Wire</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Cash">Cash</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Deposit Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Deposit Type
            </label>
            <select
              value={depositType}
              onChange={(e) => setDepositType(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] transition-colors"
            >
              <option value="General">General</option>
              <option value="Credit Memo">Credit Memo</option>
              <option value="Adjustment">Adjustment</option>
            </select>
          </div>

          {/* Total Amount Display */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Total Payment Amount
            </label>
            <div className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-lg font-semibold">
              ${(totalPaymentAmount || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this payment..."
            rows={4}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] transition-colors resize-none"
          />
        </div>

        {/* File Upload */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
            dragActive
              ? "border-[#E8700A] bg-[#E8700A]/10"
              : "border-white/20 hover:border-white/30 bg-white/5"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-4">
            <Upload className="w-12 h-12 text-gray-400" />
            <div className="text-center">
              <p className="text-sm font-medium text-white">
                Upload supporting documents
              </p>
              <p className="text-xs text-gray-400">
                Drag and drop files here or click to browse
              </p>
            </div>
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium text-white transition-colors">
              Browse Files
            </button>
          </div>
        </div>
      </div>

      {/* Invoices to Apply Payment */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Apply Payment to Invoices</h2>

        <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Payment Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Invoice Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Outstanding
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Invoice Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Charge Set #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Container #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Bill To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Invoiced By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Purchase Order #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                    No invoices available
                  </td>
                </tr>
              ) : (
                invoices
                  .filter((inv) => !selectedCustomerId || inv.customer_id === selectedCustomerId)
                  .map((invoice) => {
                    const paymentLine = paymentLines.find((l) => l.invoiceId === invoice.id)
                    const paymentAmount = paymentLine?.amount || 0

                    return (
                      <tr
                        key={invoice.id}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={paymentAmount === 0 ? "" : paymentAmount}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : 0
                              updatePaymentLine(invoice.id, val)
                            }}
                            placeholder="0.00"
                            step="0.01"
                            className="w-24 px-2 py-1 bg-white/10 border border-white/20 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-white font-medium">
                          {invoice.invoice_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("en-US") : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          ${(((invoice.amount || 0) - (invoice.amount_paid || 0)) || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          ${((invoice.amount || 0) || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300">
                            {invoice.billing_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {invoice.id?.slice(0, 8) || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {invoice.container_number || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {invoice.customers?.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {invoice.customers?.name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">-</td>
                        <td className="px-4 py-3 text-sm text-gray-300">-</td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {invoice.reference_number || "-"}
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          disabled={isSubmitting}
          onClick={async () => {
            if (!selectedCustomerId) {
              alert("Please select a customer")
              return
            }
            if (paymentLines.length === 0 || totalPaymentAmount <= 0) {
              alert("Please add at least one payment line with an amount")
              return
            }

            setIsSubmitting(true)
            try {
              // Convert bare date to local-midnight ISO for TIMESTAMPTZ
              const isoPaymentDate = new Date(paymentDate + "T00:00:00").toISOString()

              const response = await fetch("/api/accounts-receivable/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  customer_id: selectedCustomerId,
                  payment_date: isoPaymentDate,
                  payment_method: paymentMethod,
                  check_number: checkNumber || null,
                  deposit_type: depositType,
                  amount: totalPaymentAmount,
                  note: notes,
                  invoice_applications: paymentLines
                    .filter((line) => line.amount > 0)
                    .map((line) => ({
                      invoice_id: line.invoiceId,
                      applied_amount: line.amount,
                    })),
                }),
              })

              if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: "Unknown error" }))
                alert(`Error submitting payment: ${errData.error || "Unknown error"}`)
              } else {
                alert("Payment submitted successfully!")
                // Reset form
                setSelectedCustomerId("")
                setPaymentDate(new Date().toISOString().split("T")[0])
                setCheckNumber("")
                setPaymentMethod("Check")
                setDepositType("General")
                setNotes("")
                setPaymentLines([])
              }
            } catch (error) {
              alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
            } finally {
              setIsSubmitting(false)
            }
          }}
          className="px-6 py-2 bg-[#E8700A] hover:bg-[#d45f08] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? "Submitting..." : "Submit Payment"}
        </button>
        <button
          onClick={() => {
            setSelectedCustomerId("")
            setPaymentDate(new Date().toISOString().split("T")[0])
            setCheckNumber("")
            setPaymentMethod("Check")
            setDepositType("General")
            setNotes("")
            setPaymentLines([])
          }}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
