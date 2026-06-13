"use client"

import { useState, useEffect } from "react"
import { LoadWithRelations, LoadPayment, LoadBillingCharge } from "@/types/dispatcher"

type PaymentsTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

export function PaymentsTab({ load, onUpdate }: PaymentsTabProps) {
  const [payments, setPayments] = useState<LoadPayment[]>([])
  const [charges, setCharges] = useState<LoadBillingCharge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<LoadPayment>>({})

  useEffect(() => {
    fetchPayments()
  }, [load.id])

  const fetchPayments = async () => {
    setIsLoading(true)
    try {
      const [paymentsRes, chargesRes] = await Promise.all([
        fetch(`/api/dispatcher/loads/${load.id}/payments`),
        fetch(`/api/dispatcher/loads/${load.id}/billing`),
      ])

      if (paymentsRes.ok) {
        const data = await paymentsRes.json()
        setPayments(Array.isArray(data) ? data : data.payments || [])
      }

      if (chargesRes.ok) {
        const data = await chargesRes.json()
        setCharges(Array.isArray(data) ? data : data.charges || [])
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddPayment = async () => {
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_type: "Cash",
          amount: 0,
          reference: "",
          paid_at: new Date().toISOString(),
        }),
      })
      if (response.ok) {
        await fetchPayments()
      }
    } catch (error) {
      console.error("Failed to add payment:", error)
    }
  }

  const handleEditStart = (payment: LoadPayment) => {
    setEditingId(payment.id)
    setEditValues(payment)
  }

  const handleEditChange = (field: keyof LoadPayment, value: any) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditSave = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      })
      if (response.ok) {
        await fetchPayments()
        setEditingId(null)
      }
    } catch (error) {
      console.error("Failed to update payment:", error)
    }
  }

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm("Delete this payment?")) return
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/payments/${paymentId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        await fetchPayments()
      }
    } catch (error) {
      console.error("Failed to delete payment:", error)
    }
  }

  const totalCharges = charges.reduce((sum, charge) => sum + (charge.amount || 0), 0)
  const totalPayments = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0)
  const balance = totalCharges - totalPayments

  if (isLoading) {
    return <div className="text-gray-400">Loading payments...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleAddPayment}
          className="px-4 py-2 rounded-lg bg-[#E8700A] text-white text-sm font-medium hover:bg-[#FF8C21] transition-colors"
        >
          + Add Payment
        </button>
      </div>

      <div className="overflow-x-auto bg-[#1F2937] rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-[#111827]">
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
              <th className="text-right py-3 px-4 text-gray-400 font-semibold">Amount</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Reference</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Paid Date</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-gray-500">
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4">
                    {editingId === payment.id ? (
                      <select
                        value={editValues.payment_type || ""}
                        onChange={(e) => handleEditChange("payment_type", e.target.value)}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Check">Check</option>
                        <option value="ACH">ACH</option>
                        <option value="Wire Transfer">Wire Transfer</option>
                        <option value="Credit">Credit</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <span className="text-gray-300">{payment.payment_type}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {editingId === payment.id ? (
                      <input
                        type="number"
                        value={editValues.amount || 0}
                        onChange={(e) => handleEditChange("amount", parseFloat(e.target.value))}
                        step="0.01"
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-300 text-right focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      />
                    ) : (
                      <span className="text-gray-300 font-mono">${payment.amount?.toFixed(2) || "0.00"}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {editingId === payment.id ? (
                      <input
                        type="text"
                        value={editValues.reference || ""}
                        onChange={(e) => handleEditChange("reference", e.target.value)}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      />
                    ) : (
                      <span className="text-gray-300">{payment.reference || "—"}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {editingId === payment.id ? (
                      <input
                        type="date"
                        value={
                          editValues.paid_at
                            ? new Date(editValues.paid_at).toISOString().split("T")[0]
                            : ""
                        }
                        onChange={(e) =>
                          handleEditChange(
                            "paid_at",
                            e.target.value ? new Date(e.target.value).toISOString() : null
                          )
                        }
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      />
                    ) : (
                      <>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "—"}</>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      {editingId === payment.id ? (
                        <>
                          <button
                            onClick={() => handleEditSave(payment.id)}
                            className="px-2 py-1 rounded text-xs font-medium bg-[#E8700A] text-white hover:bg-[#FF8C21] transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 rounded text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditStart(payment)}
                            className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1F2937] rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Total Charges</div>
          <div className="text-2xl font-bold text-[#FF8C21] font-mono">${totalCharges.toFixed(2)}</div>
        </div>
        <div className="bg-[#1F2937] rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Total Payments</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">${totalPayments.toFixed(2)}</div>
        </div>
        <div className={`rounded-lg p-4 ${balance > 0 ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
          <div className="text-sm text-gray-400 mb-1">Balance</div>
          <div className={`text-2xl font-bold font-mono ${balance > 0 ? "text-red-400" : "text-emerald-400"}`}>
            ${Math.abs(balance).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">{balance > 0 ? "Amount Due" : "Credit"}</div>
        </div>
      </div>
    </div>
  )
}
