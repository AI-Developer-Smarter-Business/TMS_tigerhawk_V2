"use client"

import { useState, useMemo } from "react"
import { Filter } from "lucide-react"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

interface Invoice {
  id: string
  invoice_number: string
  customer_id: string
  billing_status: string
  amount: number
  amount_paid?: number
  created_at: string
  customers?: { id: string; name: string }
  ar_credit_memos?: { id: string }[]
}

interface Customer {
  id: string
  name: string
}

interface ProblemSyncViewProps {
  initialInvoices: Invoice[]
  initialCustomers: Customer[]
  error: string | null
}

export function ProblemSyncView({
  initialInvoices,
  initialCustomers,
  error,
}: ProblemSyncViewProps) {
  const [invoices] = useState(initialInvoices)
  const [customers] = useState(initialCustomers)
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [problemFilter, setProblemFilter] = useState<string | null>(null)

  // Calculate problem counts
  const problemCounts = useMemo(() => {
    const creditMemos = new Set(
      invoices
        .filter((inv) => inv.ar_credit_memos && inv.ar_credit_memos.length > 0)
        .map((inv) => inv.id)
    )

    // Calculate paymentsAndCredits: invoices with partial/overpayments
    // (amount_paid > 0 && amount_paid != amount, or amount_paid > amount)
    const paymentsAndCredits = invoices.filter((inv) => {
      const amountPaid = inv.amount_paid || 0
      const amount = inv.amount || 0
      // Partial payment or overpayment situations
      return amountPaid > 0 && amountPaid !== amount
    }).length

    return {
      creditMemos: creditMemos.size,
      paymentsAndCredits,
      customers: new Set(invoices.map((inv) => inv.customer_id)).size,
    }
  }, [invoices])

  // Get problem invoices based on selected filter
  const getProblemInvoices = () => {
    let filtered = invoices

    // Apply customer filter
    if (selectedCustomerId) {
      filtered = filtered.filter(
        (inv) => inv.customer_id === selectedCustomerId
      )
    }

    // Apply problem type filter
    if (problemFilter === "creditMemos") {
      filtered = filtered.filter(
        (inv) => inv.ar_credit_memos && inv.ar_credit_memos.length > 0
      )
    } else if (problemFilter === "paymentsAndCredits") {
      filtered = filtered.filter((inv) => {
        const amountPaid = inv.amount_paid || 0
        const amount = inv.amount || 0
        return amountPaid > 0 && amountPaid !== amount
      })
    }

    return filtered
  }

  const problemInvoices = getProblemInvoices()

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg">
        Error loading problem sync data: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Problem Filter Buttons */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => setProblemFilter(null)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            problemFilter === null
              ? "bg-[#E8700A] text-white"
              : "bg-white/10 text-gray-300 hover:bg-white/20"
          }`}
        >
          All Problems
        </button>
        <button
          onClick={() => setProblemFilter("creditMemos")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            problemFilter === "creditMemos"
              ? "bg-[#E8700A] text-white"
              : "bg-white/10 text-gray-300 hover:bg-white/20"
          }`}
        >
          Credit Memos ({problemCounts.creditMemos})
        </button>
        <button
          onClick={() => setProblemFilter("paymentsAndCredits")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            problemFilter === "paymentsAndCredits"
              ? "bg-[#E8700A] text-white"
              : "bg-white/10 text-gray-300 hover:bg-white/20"
          }`}
        >
          Payments & Credits ({problemCounts.paymentsAndCredits})
        </button>
        <button
          onClick={() => setProblemFilter("customers")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            problemFilter === "customers"
              ? "bg-[#E8700A] text-white"
              : "bg-white/10 text-gray-300 hover:bg-white/20"
          }`}
        >
          Customers ({problemCounts.customers})
        </button>
      </div>

      {/* Customer Filter */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <label className="text-sm font-medium text-gray-300">
            Filter by Customer
          </label>
        </div>
        <div className="w-full md:w-64">
          <SearchableSelect
            options={customers.map((c) => ({ id: c.id, name: c.name }))}
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
            placeholder="Select a customer..."
          />
        </div>
      </div>

      {/* Problems Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Invoice #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Invoice Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Bill To
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Error
              </th>
            </tr>
          </thead>
          <tbody>
            {problemInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No problem invoices found
                </td>
              </tr>
            ) : (
              problemInvoices.map((invoice) => {
                let errorMessage = ""
                if (invoice.ar_credit_memos && invoice.ar_credit_memos.length > 0) {
                  errorMessage = "Credit memo applied"
                } else if (problemFilter === "paymentsAndCredits") {
                  const amountPaid = invoice.amount_paid || 0
                  const amount = invoice.amount || 0
                  if (amountPaid > amount) {
                    errorMessage = `Overpayment: $${(amountPaid - amount).toFixed(2)}`
                  } else if (amountPaid > 0 && amountPaid < amount) {
                    errorMessage = `Partial payment: ${((amountPaid / amount) * 100).toFixed(0)}% paid`
                  }
                }

                return (
                  <tr
                    key={invoice.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300">
                        {invoice.billing_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {invoice.customers?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {invoice.customers?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white font-medium">
                      ${((invoice.amount || 0) || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300">
                        {errorMessage || "Sync error"}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
