"use client"

import { useState, useMemo } from "react"
import { Filter } from "lucide-react"

interface Invoice {
  id: string
  invoice_number: string
  charge_set_number: string
  billing_status: string
  amount: number
  amount_paid: number
  created_at: string
  customer_id: string
  container_number?: string
  reference_number?: string
  customers?: { id: string; name: string }
  ar_credit_memos?: { id: string; amount: number }[]
}

const statusColors: Record<string, { bg: string; text: string }> = {
  "Invoiced": { bg: "bg-green-900/30", text: "text-green-300" },
  "Rebilling": { bg: "bg-orange-900/30", text: "text-orange-300" },
  "Paid": { bg: "bg-blue-900/30", text: "text-blue-300" },
  "Voided": { bg: "bg-red-900/30", text: "text-red-300" },
  "Partially Paid": { bg: "bg-yellow-900/30", text: "text-yellow-300" },
}

interface InvoicesViewProps {
  initialData: Invoice[]
  error: string | null
}

export function InvoicesView({ initialData, error }: InvoicesViewProps) {
  const [invoices] = useState<Invoice[]>(initialData)
  const [filters, setFilters] = useState({
    billingStatus: [] as string[],
  })

  // Calculate summary statistics
  const stats = useMemo(() => {
    const statusGroups = invoices.reduce((acc, inv) => {
      const status = inv.billing_status || "Invoiced"
      if (!acc[status]) {
        acc[status] = { count: 0, total: 0 }
      }
      acc[status].count += 1
      acc[status].total += inv.amount || 0
      return acc
    }, {} as Record<string, { count: number; total: number }>)

    return {
      invoiced: statusGroups["Invoiced"] || { count: 0, total: 0 },
      rebilling: statusGroups["Rebilling"] || { count: 0, total: 0 },
      partiallyPaid: statusGroups["Partially Paid"] || { count: 0, total: 0 },
      paid: statusGroups["Paid"] || { count: 0, total: 0 },
      voided: invoices.filter((i) => i.billing_status === "Voided").length,
    }
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filters.billingStatus.length > 0 && !filters.billingStatus.includes(inv.billing_status)) {
        return false
      }
      return true
    })
  }, [invoices, filters])

  const toggleStatusFilter = (status: string) => {
    const newFilters = [...filters.billingStatus]
    const idx = newFilters.indexOf(status)
    if (idx >= 0) {
      newFilters.splice(idx, 1)
    } else {
      newFilters.push(status)
    }
    setFilters({ ...filters, billingStatus: newFilters })
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg">
        Error loading invoices: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="Invoiced"
          value={`${stats.invoiced.count}`}
          subtitle={`$${(stats.invoiced.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-green-900/20"
        />
        <SummaryCard
          title="Rebilling"
          value={`${stats.rebilling.count}`}
          subtitle={`$${(stats.rebilling.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-orange-900/20"
        />
        <SummaryCard
          title="Partially Paid"
          value={`${stats.partiallyPaid.count}`}
          subtitle={`$${(stats.partiallyPaid.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-yellow-900/20"
        />
        <SummaryCard
          title="Paid"
          value={`${stats.paid.count}`}
          subtitle={`$${(stats.paid.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-blue-900/20"
        />
        <SummaryCard
          title="Voided"
          value={`${stats.voided}`}
          bg="bg-red-900/20"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Billing Status</h3>
        </div>

        <div className="flex flex-wrap gap-4">
          {["Invoiced", "Rebilling", "Partially Paid", "Paid", "Voided"].map((status) => (
            <label key={status} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.billingStatus.includes(status)}
                onChange={() => toggleStatusFilter(status)}
                className="w-4 h-4 rounded bg-white/10 border border-white/20"
              />
              <span className="text-sm text-gray-300">{status}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Invoice #
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
                Invoice Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Billing Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Credit Applied
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Credit Memos
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Load #
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Total Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-white font-medium">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.charge_set_number}
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
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.created_at
                      ? new Date(invoice.created_at).toLocaleDateString("en-US")
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        statusColors[invoice.billing_status]?.bg || "bg-gray-900/30"
                      } ${
                        statusColors[invoice.billing_status]?.text ||
                        "text-gray-300"
                      }`}
                    >
                      {invoice.billing_status || "Invoiced"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    ${(invoice.ar_credit_memos?.reduce((sum, memo) => sum + (memo.amount || 0), 0) || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.ar_credit_memos?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.reference_number || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-white font-medium">
                    ${(invoice.amount || 0).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  bg,
}: {
  title: string
  value: string
  subtitle?: string
  bg: string
}) {
  return (
    <div className={`${bg} border border-white/10 rounded-lg p-4`}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
