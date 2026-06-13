"use client"

import { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

interface Driver {
  id: string
  name: string
}

interface AddDriverPayModalProps {
  isOpen: boolean
  onClose: () => void
  drivers: Driver[]
  onSuccess: (record: any) => void
}

export function AddDriverPayModal({
  isOpen,
  onClose,
  drivers,
  onSuccess,
}: AddDriverPayModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    driver_id: "",
    load_id: "",
    container_number: "",
    from_location: "",
    to_location: "",
    amount: "",
    notes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !formData.driver_id ||
      !formData.load_id ||
      !formData.amount ||
      !formData.from_location ||
      !formData.to_location
    ) {
      alert("Please fill in all required fields")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/accounts-payable/driver-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        onSuccess(data)
        setFormData({
          driver_id: "",
          load_id: "",
          container_number: "",
          from_location: "",
          to_location: "",
          amount: "",
          notes: "",
        })
      }
    } catch (error) {
      console.error("Error creating driver pay:", error)
      alert("Failed to create driver pay record")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#111827] border border-white/10 rounded-lg max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Add Driver Pay</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Driver */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Driver <span className="text-red-400">*</span>
            </label>
            <SearchableSelect
              options={drivers.map(d => ({ id: d.id, name: d.name }))}
              value={formData.driver_id}
              onChange={(value) => setFormData({ ...formData, driver_id: value })}
              placeholder="Select a driver"
            />
          </div>

          {/* Load # */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Load # <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.load_id}
              onChange={(e) => setFormData({ ...formData, load_id: e.target.value })}
              placeholder="e.g., LOAD-001"
              className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
              required
            />
          </div>

          {/* Container # */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Container #
            </label>
            <input
              type="text"
              value={formData.container_number}
              onChange={(e) => setFormData({ ...formData, container_number: e.target.value })}
              placeholder="e.g., CONT-001"
              className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
            />
          </div>

          {/* From */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              From <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.from_location}
              onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
              placeholder="Origin location"
              className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
              required
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              To <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.to_location}
              onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
              placeholder="Destination location"
              className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Amount <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
              className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A] resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-white/10 text-gray-400 rounded font-medium hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-700 disabled:opacity-50 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
