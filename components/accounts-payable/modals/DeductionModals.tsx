"use client"

import { useState, useEffect } from "react"
import { X, Loader2, Plus, Zap, Check, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

// ─── Types ────────────────────────────────────────────────
interface Driver {
  id: string
  name: string
}

// ─── AddDeductionModal ────────────────────────────────────
interface AddDeductionModalProps {
  isOpen: boolean
  onClose: () => void
  drivers: Driver[]
  periodStart: Date
  onSuccess: () => void
}

const DEDUCTION_TYPES = [
  "Fuel",
  "Escrow",
  "Equipment Rental (Samsara)",
  "Liability Insurance",
  "Cargo Insurance",
  "Plate Rental",
  "Truck Payment",
]

const UNIT_OF_MEASURES = ["Flat Amount", "Percentage", "Per Mile"]
const MATH_OPERATIONS = ["Subtract", "Add"]

type AddStep = "configure" | "submitting" | "complete"

interface AddResult {
  created: number
  failed: number
  errors: string[]
}

export function AddDeductionModal({
  isOpen,
  onClose,
  drivers,
  periodStart,
  onSuccess,
}: AddDeductionModalProps) {
  const [step, setStep] = useState<AddStep>("configure")
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [description, setDescription] = useState("")
  const [unitOfMeasure, setUnitOfMeasure] = useState("Flat Amount")
  const [mathOperation, setMathOperation] = useState("Subtract")
  const [amount, setAmount] = useState("")
  const [deductionDate, setDeductionDate] = useState(format(periodStart, "yyyy-MM-dd"))
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AddResult | null>(null)
  const [driverSearch, setDriverSearch] = useState("")

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("configure")
      setSelectedDriverIds(new Set())
      setSelectedTypes(new Set())
      setDescription("")
      setUnitOfMeasure("Flat Amount")
      setMathOperation("Subtract")
      setAmount("")
      setDeductionDate(format(periodStart, "yyyy-MM-dd"))
      setError(null)
      setResult(null)
      setDriverSearch("")
    }
  }, [isOpen, periodStart])

  if (!isOpen) return null

  const toggleDriver = (id: string) => {
    const next = new Set(selectedDriverIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedDriverIds(next)
  }

  const toggleAllDrivers = () => {
    if (selectedDriverIds.size === drivers.length) {
      setSelectedDriverIds(new Set())
    } else {
      setSelectedDriverIds(new Set(drivers.map((d) => d.id)))
    }
  }

  const toggleType = (type: string) => {
    const next = new Set(selectedTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    setSelectedTypes(next)
  }

  const toggleAllTypes = () => {
    if (selectedTypes.size === DEDUCTION_TYPES.length) {
      setSelectedTypes(new Set())
    } else {
      setSelectedTypes(new Set(DEDUCTION_TYPES))
    }
  }

  const totalToCreate = selectedDriverIds.size * selectedTypes.size

  const filteredDrivers = driverSearch.trim()
    ? drivers.filter((d) => d.name.toLowerCase().includes(driverSearch.toLowerCase()))
    : drivers

  const handleSubmit = async () => {
    if (selectedDriverIds.size === 0) {
      setError("Please select at least one driver")
      return
    }
    if (selectedTypes.size === 0) {
      setError("Please select at least one deduction type")
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setStep("submitting")
    setError(null)

    const numAmount = parseFloat(amount)
    let created = 0
    let failed = 0
    const errors: string[] = []

    // Create one deduction per driver × type combination
    const driverIds = Array.from(selectedDriverIds)
    const types = Array.from(selectedTypes)

    const requests = driverIds.flatMap((driverId) =>
      types.map((deductionType) => ({
        driverId,
        deductionType,
        driverName: drivers.find((d) => d.id === driverId)?.name || driverId,
      }))
    )

    const results = await Promise.allSettled(
      requests.map(({ driverId, deductionType }) =>
        fetch("/api/accounts-payable/deductions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driver_id: driverId,
            deduction_type: deductionType,
            description: description || null,
            unit_of_measure: unitOfMeasure,
            math_operation: mathOperation,
            amount: numAmount,
            final_amount: numAmount,
            // Convert bare "yyyy-MM-dd" to local-midnight ISO for TIMESTAMPTZ column
            deduction_date: new Date(deductionDate + "T00:00:00").toISOString(),
            status: "Unapproved",
          }),
        })
      )
    )

    for (let i = 0; i < results.length; i++) {
      const res = results[i]
      const req = requests[i]
      if (res.status === "fulfilled" && res.value.ok) {
        created++
      } else {
        failed++
        let errMsg = "Unknown error"
        if (res.status === "fulfilled") {
          const body = await res.value.json().catch(() => ({ error: "Unknown error" }))
          errMsg = body.error || "API error"
        } else {
          errMsg = "Network error"
        }
        errors.push(`${req.driverName} / ${req.deductionType}: ${errMsg}`)
      }
    }

    setResult({ created, failed, errors })
    setStep("complete")
  }

  const handleDone = () => {
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#E8700A]" />
            Add Deductions
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: Configure */}
        {step === "configure" && (
          <div className="space-y-4">
            {/* Drivers multi-select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400 uppercase tracking-wider">
                  Drivers * ({selectedDriverIds.size} selected)
                </label>
                <button
                  onClick={toggleAllDrivers}
                  className="text-xs text-[#E8700A] hover:text-[#ff8c2a] transition-colors"
                >
                  {selectedDriverIds.size === drivers.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <input
                type="text"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                placeholder="Search drivers..."
                className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A] mb-2"
              />
              <div className="bg-[#0B1120] border border-white/10 rounded-lg p-2 max-h-40 overflow-y-auto space-y-0.5">
                {filteredDrivers.map((driver) => (
                  <label
                    key={driver.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDriverIds.has(driver.id)}
                      onChange={() => toggleDriver(driver.id)}
                      className="rounded border-gray-600 text-[#E8700A]"
                    />
                    <span className="text-sm text-gray-300">{driver.name}</span>
                  </label>
                ))}
                {filteredDrivers.length === 0 && (
                  <p className="text-xs text-gray-500 px-2 py-2">No drivers match search</p>
                )}
              </div>
            </div>

            {/* Deduction Types multi-select */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400 uppercase tracking-wider">
                  Deduction Types * ({selectedTypes.size} selected)
                </label>
                <button
                  onClick={toggleAllTypes}
                  className="text-xs text-[#E8700A] hover:text-[#ff8c2a] transition-colors"
                >
                  {selectedTypes.size === DEDUCTION_TYPES.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="bg-[#0B1120] border border-white/10 rounded-lg p-2 space-y-0.5">
                {DEDUCTION_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(type)}
                      onChange={() => toggleType(type)}
                      className="rounded border-gray-600 text-[#E8700A]"
                    />
                    <span className="text-sm text-gray-300">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description (applies to all)..."
                className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
              />
            </div>

            {/* Unit of Measure + Math Operation */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Unit of Measure
                </label>
                <select
                  value={unitOfMeasure}
                  onChange={(e) => setUnitOfMeasure(e.target.value)}
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                >
                  {UNIT_OF_MEASURES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Math Operation
                </label>
                <select
                  value={mathOperation}
                  onChange={(e) => setMathOperation(e.target.value)}
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                >
                  {MATH_OPERATIONS.map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Deduction Date
                </label>
                <input
                  type="date"
                  value={deductionDate}
                  onChange={(e) => setDeductionDate(e.target.value)}
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#E8700A]"
                />
              </div>
            </div>

            {/* Summary line */}
            {totalToCreate > 0 && (
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  This will create <span className="font-bold text-blue-200">{totalToCreate}</span> deduction{totalToCreate !== 1 ? "s" : ""} ({selectedDriverIds.size} driver{selectedDriverIds.size !== 1 ? "s" : ""} × {selectedTypes.size} type{selectedTypes.size !== 1 ? "s" : ""})
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={totalToCreate === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add {totalToCreate > 0 ? `${totalToCreate} Deduction${totalToCreate !== 1 ? "s" : ""}` : "Deductions"}
              </button>
            </div>
          </div>
        )}

        {/* Step: Submitting */}
        {step === "submitting" && (
          <div className="flex flex-col items-center py-12 gap-4">
            <Loader2 className="w-10 h-10 text-[#E8700A] animate-spin" />
            <p className="text-gray-400 text-sm">
              Creating {totalToCreate} deduction{totalToCreate !== 1 ? "s" : ""}...
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && result && (
          <div className="space-y-5">
            <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4 flex items-center gap-3">
              <Check className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-green-400 font-medium">Complete</p>
                <p className="text-sm text-gray-400 mt-1">
                  {result.created} created{result.failed > 0 ? `, ${result.failed} failed` : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0B1120] border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{result.created}</p>
                <p className="text-xs text-gray-400 mt-1">Created</p>
              </div>
              <div className="bg-[#0B1120] border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{result.failed}</p>
                <p className="text-xs text-gray-400 mt-1">Failed</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                <p className="text-xs text-red-400 font-medium mb-2">Errors:</p>
                <ul className="space-y-1">
                  {result.errors.map((err, idx) => (
                    <li key={idx} className="text-xs text-red-300">{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleDone}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── GenerateDeductionsModal ──────────────────────────────
interface GenerateDeductionsModalProps {
  isOpen: boolean
  onClose: () => void
  drivers: Driver[]
  periodStart: Date
  periodEnd: Date
  onSuccess: () => void
}

type GenerateStep = "configure" | "generating" | "complete"

interface GenerateResult {
  generated: number
  skipped: number
  errors: string[]
  message: string
}

export function GenerateDeductionsModal({
  isOpen,
  onClose,
  drivers,
  periodStart,
  periodEnd,
  onSuccess,
}: GenerateDeductionsModalProps) {
  const [step, setStep] = useState<GenerateStep>("configure")
  const [scope, setScope] = useState<"all" | "selected">("all")
  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("configure")
      setScope("all")
      setSelectedDriverIds(new Set())
      setResult(null)
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const toggleDriver = (driverId: string) => {
    const newSet = new Set(selectedDriverIds)
    if (newSet.has(driverId)) {
      newSet.delete(driverId)
    } else {
      newSet.add(driverId)
    }
    setSelectedDriverIds(newSet)
  }

  const handleGenerate = async () => {
    setStep("generating")
    setError(null)

    try {
      const payload: Record<string, any> = {
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
      }

      if (scope === "selected" && selectedDriverIds.size > 0) {
        payload.driver_ids = Array.from(selectedDriverIds)
      }

      const response = await fetch("/api/accounts-payable/deductions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        setStep("complete")
      } else {
        setError(data.error || "Failed to generate deductions")
        setStep("configure")
      }
    } catch (err) {
      setError("Network error generating deductions")
      setStep("configure")
    }
  }

  const handleDone = () => {
    onSuccess()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#E8700A]" />
            Generate Weekly Deductions
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: Configure */}
        {step === "configure" && (
          <div className="space-y-5">
            {/* Period Display */}
            <div className="bg-[#0B1120] border border-white/10 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Period</p>
              <p className="text-white font-medium">
                {format(periodStart, "MMM dd")} - {format(periodEnd, "MMM dd, yyyy")}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Deductions will be auto-generated from each driver&apos;s settlement settings
              </p>
            </div>

            {/* Scope */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-3">
                Driver Scope
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                    className="text-[#E8700A]"
                  />
                  <span className="text-sm text-gray-300">
                    All Active Drivers ({drivers.length})
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scope === "selected"}
                    onChange={() => setScope("selected")}
                    className="text-[#E8700A]"
                  />
                  <span className="text-sm text-gray-300">Select Specific Drivers</span>
                </label>
              </div>
            </div>

            {/* Driver Selection (when scope === "selected") */}
            {scope === "selected" && (
              <div className="bg-[#0B1120] border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                {drivers.map((driver) => (
                  <label
                    key={driver.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDriverIds.has(driver.id)}
                      onChange={() => toggleDriver(driver.id)}
                      className="rounded border-gray-600 text-[#E8700A]"
                    />
                    <span className="text-sm text-gray-300">{driver.name}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Info notice */}
            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-300">
                Existing deductions for the same driver and type within this period will be skipped
                to prevent duplicates. Only enabled templates with non-zero amounts will be processed.
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={scope === "selected" && selectedDriverIds.size === 0}
                className="px-4 py-2 bg-[#E8700A] hover:bg-[#d4650a] text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Generate Deductions
              </button>
            </div>
          </div>
        )}

        {/* Step: Generating */}
        {step === "generating" && (
          <div className="flex flex-col items-center py-12 gap-4">
            <Loader2 className="w-10 h-10 text-[#E8700A] animate-spin" />
            <p className="text-gray-400 text-sm">
              Generating deductions for{" "}
              {scope === "all" ? "all active drivers" : `${selectedDriverIds.size} driver(s)`}...
            </p>
          </div>
        )}

        {/* Step: Complete */}
        {step === "complete" && result && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4 flex items-center gap-3">
              <Check className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-green-400 font-medium">Generation Complete</p>
                <p className="text-sm text-gray-400 mt-1">{result.message}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0B1120] border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{result.generated}</p>
                <p className="text-xs text-gray-400 mt-1">Generated</p>
              </div>
              <div className="bg-[#0B1120] border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
                <p className="text-xs text-gray-400 mt-1">Skipped</p>
              </div>
              <div className="bg-[#0B1120] border border-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{result.errors.length}</p>
                <p className="text-xs text-gray-400 mt-1">Errors</p>
              </div>
            </div>

            {/* Errors list */}
            {result.errors.length > 0 && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                <p className="text-xs text-red-400 font-medium mb-2">Errors:</p>
                <ul className="space-y-1">
                  {result.errors.map((err, idx) => (
                    <li key={idx} className="text-xs text-red-300">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleDone}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
