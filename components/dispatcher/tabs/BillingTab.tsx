"use client"

import { useState, useEffect } from "react"
import { LoadWithRelations, LoadBillingCharge } from "@/types/dispatcher"

type BillingTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

export function BillingTab({ load, onUpdate }: BillingTabProps) {
  const [charges, setCharges] = useState<LoadBillingCharge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<LoadBillingCharge>>({})

  useEffect(() => {
    fetchCharges()
  }, [load.id])

  const fetchCharges = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/billing`)
      if (response.ok) {
        const data = await response.json()
        setCharges(Array.isArray(data) ? data : data.charges || [])
      }
    } catch (error) {
      console.error("Failed to fetch charges:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddCharge = async () => {
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          charge_type: "Other",
          description: "",
          amount: 0,
        }),
      })
      if (response.ok) {
        await fetchCharges()
      }
    } catch (error) {
      console.error("Failed to add charge:", error)
    }
  }

  const handleEditStart = (charge: LoadBillingCharge) => {
    setEditingId(charge.id)
    setEditValues(charge)
  }

  const handleEditChange = (field: keyof LoadBillingCharge, value: any) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleEditSave = async (chargeId: string) => {
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/billing/${chargeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      })
      if (response.ok) {
        await fetchCharges()
        setEditingId(null)
      }
    } catch (error) {
      console.error("Failed to update charge:", error)
    }
  }

  const handleDeleteCharge = async (chargeId: string) => {
    if (!confirm("Delete this charge?")) return
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/billing/${chargeId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        await fetchCharges()
      }
    } catch (error) {
      console.error("Failed to delete charge:", error)
    }
  }

  const totalAmount = charges.reduce((sum, charge) => sum + (charge.amount || 0), 0)

  if (isLoading) {
    return <div className="text-gray-400">Loading charges...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleAddCharge}
          className="px-4 py-2 rounded-lg bg-[#E8700A] text-white text-sm font-medium hover:bg-[#FF8C21] transition-colors"
        >
          + Add Charge
        </button>
      </div>

      <div className="overflow-x-auto bg-[#1F2937] rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-[#111827]">
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Charge Type</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Description</th>
              <th className="text-right py-3 px-4 text-gray-400 font-semibold">Amount</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-gray-500">
                  No charges yet. Add one to get started.
                </td>
              </tr>
            ) : (
              charges.map((charge) => (
                <tr key={charge.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4">
                    {editingId === charge.id ? (
                      <select
                        value={editValues.charge_type || ""}
                        onChange={(e) => handleEditChange("charge_type", e.target.value)}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      >
                        <option value="Base Rate">Base Rate</option>
                        <option value="Accessorial">Accessorial</option>
                        <option value="Detention">Detention</option>
                        <option value="Storage">Storage</option>
                        <option value="Demurrage">Demurrage</option>
                        <option value="Other">Other</option>
                      </select>
                    ) : (
                      <span className="text-gray-300">{charge.charge_type}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {editingId === charge.id ? (
                      <input
                        type="text"
                        value={editValues.description || ""}
                        onChange={(e) => handleEditChange("description", e.target.value)}
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      />
                    ) : (
                      <span className="text-gray-300">{charge.description || "—"}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {editingId === charge.id ? (
                      <input
                        type="number"
                        value={editValues.amount || 0}
                        onChange={(e) => handleEditChange("amount", parseFloat(e.target.value))}
                        step="0.01"
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-300 text-right focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      />
                    ) : (
                      <span className="text-gray-300 font-mono">${charge.amount?.toFixed(2) || "0.00"}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {new Date(charge.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      {editingId === charge.id ? (
                        <>
                          <button
                            onClick={() => handleEditSave(charge.id)}
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
                            onClick={() => handleEditStart(charge)}
                            className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteCharge(charge.id)}
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

      {charges.length > 0 && (
        <div className="bg-[#1F2937] rounded-lg p-4 flex justify-end">
          <div className="text-right">
            <div className="text-sm text-gray-400">Total Charges</div>
            <div className="text-2xl font-bold text-[#FF8C21] font-mono">${totalAmount.toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
