"use client"

import { useState, useEffect } from "react"
import { LoadWithRelations } from "@/types/dispatcher"

type DriverPayTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

type Expense = {
  id?: string
  type: string
  amount: number
  description: string
  date: string
}

export function DriverPayTab({ load, onUpdate }: DriverPayTabProps) {
  const [formData, setFormData] = useState({
    driverName: load.drivers?.name || "—",
    driverPhone: load.drivers?.phone || "—",
    basePay: load.driver_pay || 0,
    payNotes: load.driver_pay_notes || "",
  })
  const [expenses, setExpenses] = useState<Expense[]>([
    {
      type: "Fuel",
      amount: 0,
      description: "",
      date: new Date().toISOString().split("T")[0],
    },
  ])
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setFormData({
      driverName: load.drivers?.name || "—",
      driverPhone: load.drivers?.phone || "—",
      basePay: load.driver_pay || 0,
      payNotes: load.driver_pay_notes || "",
    })
  }, [load])

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleExpenseChange = (index: number, field: string, value: any) => {
    const updated = [...expenses]
    updated[index] = { ...updated[index], [field]: value }
    setExpenses(updated)
  }

  const addExpense = () => {
    setExpenses((prev) => [
      ...prev,
      {
        type: "Other",
        amount: 0,
        description: "",
        date: new Date().toISOString().split("T")[0],
      },
    ])
  }

  const handleBlur = () => {
    if (hasChanges) {
      onUpdate({
        driver_pay: formData.basePay,
        driver_pay_notes: formData.payNotes || null,
      })
      setHasChanges(false)
    }
  }

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
  const totalPay = (formData.basePay || 0) + totalExpenses

  return (
    <div className="space-y-6">
      {/* Driver Info */}
      <div className="bg-[#1F2937] rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-semibold text-white mb-4">Driver Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Driver Name</label>
            <div className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-gray-300 opacity-70">
              {formData.driverName}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Phone</label>
            <div className="px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-gray-300 opacity-70">
              {formData.driverPhone}
            </div>
          </div>
        </div>
      </div>

      {/* Base Pay */}
      <div className="bg-[#1F2937] rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-semibold text-white mb-4">Base Pay</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Base Pay Amount ($)</label>
            <input
              type="number"
              value={formData.basePay || ""}
              onChange={(e) => handleFieldChange("basePay", e.target.value ? parseFloat(e.target.value) : 0)}
              onBlur={handleBlur}
              placeholder="0.00"
              step="0.01"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Pay Notes</label>
            <textarea
              value={formData.payNotes || ""}
              onChange={(e) => handleFieldChange("payNotes", e.target.value)}
              onBlur={handleBlur}
              placeholder="Add notes about driver pay..."
              rows={3}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-[#1F2937] rounded-lg p-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-white">Expenses</h4>
          <button
            onClick={addExpense}
            className="text-xs text-[#FF8C21] hover:text-[#E8700A] font-medium"
          >
            + Add Expense
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-2 text-gray-500">Type</th>
                <th className="text-right py-2 px-2 text-gray-500">Amount</th>
                <th className="text-left py-2 px-2 text-gray-500">Description</th>
                <th className="text-left py-2 px-2 text-gray-500">Date</th>
                <th className="text-center py-2 px-2 text-gray-500">Remove</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-2">
                    <select
                      value={expense.type}
                      onChange={(e) => handleExpenseChange(idx, "type", e.target.value)}
                      className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                    >
                      <option value="Fuel">Fuel</option>
                      <option value="Tolls">Tolls</option>
                      <option value="Meals">Meals</option>
                      <option value="Lodging">Lodging</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Other">Other</option>
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      value={expense.amount}
                      onChange={(e) => handleExpenseChange(idx, "amount", parseFloat(e.target.value))}
                      step="0.01"
                      placeholder="0.00"
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 text-right focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={expense.description}
                      onChange={(e) => handleExpenseChange(idx, "description", e.target.value)}
                      placeholder="Optional notes"
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="date"
                      value={expense.date}
                      onChange={(e) => handleExpenseChange(idx, "date", e.target.value)}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#E8700A]/40"
                    />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => setExpenses((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1F2937] rounded-lg p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Base Pay</div>
          <div className="text-2xl font-bold text-[#FF8C21] font-mono">${(formData.basePay || 0).toFixed(2)}</div>
        </div>
        <div className="bg-[#1F2937] rounded-lg p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Total Expenses</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">${totalExpenses.toFixed(2)}</div>
        </div>
        <div className="bg-[#1F2937] rounded-lg p-4 border-2 border-[#E8700A]/30">
          <div className="text-xs text-gray-500 font-medium mb-1">Total Pay</div>
          <div className="text-2xl font-bold text-white font-mono">${totalPay.toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}
