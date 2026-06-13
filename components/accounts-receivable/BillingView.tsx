"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  Copy,
  Mail,
  Layers,
  Loader2,
} from "lucide-react"
import { useUserRole } from "@/lib/auth/useUserRole"

interface Invoice {
  id: string
  invoice_number: string
  charge_set_number: string
  billing_status: string
  amount: number
  amount_paid: number
  created_at: string
  customers?: { id: string; name: string; email: string }
  loads?: {
    id: string
    reference_number: string
    status: string
    customer_id: string
    container_id: string
    driver_id: string
    delivery_location: string
    created_at: string
    drivers?: { id: string; name: string }
  }
}

const statusColors: Record<string, { bg: string; text: string }> = {
  "Drafted": { bg: "bg-blue-900/30", text: "text-blue-300" },
  "Approved": { bg: "bg-green-900/30", text: "text-green-300" },
  "Unapproved": { bg: "bg-yellow-900/30", text: "text-yellow-300" },
  "Billed": { bg: "bg-green-900/30", text: "text-green-300" },
  "Rebilling": { bg: "bg-orange-900/30", text: "text-orange-300" },
  "Available": { bg: "bg-green-900/30", text: "text-green-300" },
  "Pending": { bg: "bg-orange-900/30", text: "text-orange-300" },
  "Completed": { bg: "bg-gray-900/30", text: "text-gray-300" },
  "Consolidated": { bg: "bg-slate-800/50", text: "text-slate-300" },
}

interface BillingViewProps {
  initialData: Invoice[]
  error: string | null
}

type BatchGroup = {
  customer_id: string
  customer_name: string
  invoice_count: number
  total_amount: number
  invoice_ids: string[]
}

export function BillingView({ initialData, error }: BillingViewProps) {
  const router = useRouter()
  const { role, loading: roleLoading } = useUserRole()
  const [invoices, setInvoices] = useState<Invoice[]>(initialData)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState({
    loadStatus: [] as string[],
    billingStatus: [] as string[],
  })
  const [batchPreviewOpen, setBatchPreviewOpen] = useState(false)
  const [batchGroups, setBatchGroups] = useState<BatchGroup[]>([])
  const [batchLoading, setBatchLoading] = useState<"preview" | "commit" | null>(null)
  const [batchError, setBatchError] = useState<string | null>(null)
  const [batchMessage, setBatchMessage] = useState<string | null>(null)

  const canBatchInvoice =
    !roleLoading && !!role && ["admin", "accounting", "finance"].includes(role)

  // Calculate summary statistics
  const stats = useMemo(() => {
    const statusGroups = invoices.reduce((acc, inv) => {
      const status = inv.billing_status || "Drafted"
      if (!acc[status]) {
        acc[status] = { count: 0, total: 0 }
      }
      acc[status].count += 1
      acc[status].total += inv.amount || 0
      return acc
    }, {} as Record<string, { count: number; total: number }>)

    return {
      loadCharges: invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
      drafted: statusGroups["Drafted"] || { count: 0, total: 0 },
      unapproved: statusGroups["Unapproved"] || { count: 0, total: 0 },
      approved: statusGroups["Approved"] || { count: 0, total: 0 },
      billed: statusGroups["Billed"] || { count: 0, total: 0 },
      rebilling: statusGroups["Rebilling"] || { count: 0, total: 0 },
    }
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (filters.billingStatus.length > 0 && !filters.billingStatus.includes(inv.billing_status)) {
        return false
      }
      if (filters.loadStatus.length > 0 && !filters.loadStatus.includes(inv.loads?.status ?? "")) {
        return false
      }
      return true
    })
  }, [invoices, filters])

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const toggleLoadStatusFilter = (status: string) => {
    const newFilters = [...filters.loadStatus]
    const idx = newFilters.indexOf(status)
    if (idx >= 0) {
      newFilters.splice(idx, 1)
    } else {
      newFilters.push(status)
    }
    setFilters({ ...filters, loadStatus: newFilters })
  }

  const toggleBillingStatusFilter = (status: string) => {
    const newFilters = [...filters.billingStatus]
    const idx = newFilters.indexOf(status)
    if (idx >= 0) {
      newFilters.splice(idx, 1)
    } else {
      newFilters.push(status)
    }
    setFilters({ ...filters, billingStatus: newFilters })
  }

  const loadBatchPreview = async () => {
    setBatchError(null)
    setBatchMessage(null)
    setBatchLoading("preview")
    try {
      const res = await fetch("/api/accounts-receivable/invoices/batch?source_status=Approved")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setBatchError(typeof data?.error === "string" ? data.error : "Could not load batch preview")
        setBatchGroups([])
        return
      }
      setBatchGroups(Array.isArray(data.groups) ? data.groups : [])
      setBatchPreviewOpen(true)
    } catch {
      setBatchError("Could not load batch preview")
      setBatchGroups([])
    } finally {
      setBatchLoading(null)
    }
  }

  const runBatchCommit = async () => {
    if (batchGroups.length === 0) return
    setBatchError(null)
    setBatchMessage(null)
    setBatchLoading("commit")
    try {
      const res = await fetch("/api/accounts-receivable/invoices/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_billing_status: "Approved" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setBatchError(typeof data?.error === "string" ? data.error : "Batch invoicing failed")
        return
      }
      const n = typeof data.batches_created === "number" ? data.batches_created : 0
      setBatchMessage(
        n > 0
          ? `Created ${n} batch invoice(s). Line items marked Consolidated; see Charge Set # on each row.`
          : "No batches created (nothing eligible or all groups failed). Check errors from the API."
      )
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        setBatchError(
          data.errors.map((e: { customer_id: string; error: string }) => `${e.customer_id}: ${e.error}`).join(" · ")
        )
      }
      setBatchPreviewOpen(false)
      router.refresh()
    } catch {
      setBatchError("Batch invoicing failed")
    } finally {
      setBatchLoading(null)
    }
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg">
        Error loading billing data: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <SummaryCard
          title="Load Charges"
          value={`$${(stats.loadCharges || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-[#111827]"
        />
        <SummaryCard
          title="Drafted"
          value={`${stats.drafted.count}`}
          subtitle={`$${(stats.drafted.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-blue-900/20"
        />
        <SummaryCard
          title="Unapproved"
          value={`${stats.unapproved.count}`}
          subtitle={`$${(stats.unapproved.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-yellow-900/20"
        />
        <SummaryCard
          title="Approved"
          value={`${stats.approved.count}`}
          subtitle={`$${(stats.approved.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-green-900/20"
        />
        <SummaryCard
          title="Billed"
          value={`${stats.billed.count}`}
          subtitle={`$${(stats.billed.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-emerald-900/20"
        />
        <SummaryCard
          title="Rebilling"
          value={`${stats.rebilling.count}`}
          subtitle={`$${(stats.rebilling.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          bg="bg-orange-900/20"
        />
      </div>

      {/* Batch A/R (approved load charges → one invoice per customer) */}
      {canBatchInvoice && (
        <div className="bg-[#111827] border border-white/10 rounded-lg p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#E8700A]" />
                Batch customer invoicing
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Groups unpaid <span className="text-gray-300">Approved</span> lines by customer, creates one{" "}
                <span className="text-gray-300">Billed</span> batch invoice per group, marks originals{" "}
                <span className="text-gray-300">Consolidated</span> (excluded from aging totals).
              </p>
            </div>
            <button
              type="button"
              onClick={loadBatchPreview}
              disabled={batchLoading !== null}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#E8700A] hover:bg-[#c75f08] disabled:opacity-50 text-white rounded text-sm font-medium"
            >
              {batchLoading === "preview" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Preview batch
            </button>
          </div>
          {batchMessage && <p className="text-xs text-green-400">{batchMessage}</p>}
          {batchError && <p className="text-xs text-red-400">{batchError}</p>}
        </div>
      )}

      {batchPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-white/10 rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <h4 className="text-lg font-semibold text-white">Batch preview</h4>
            <p className="text-sm text-gray-400">
              {batchGroups.length === 0
                ? "No eligible Approved invoices (unpaid, not already batch headers)."
                : `${batchGroups.length} customer group(s) ready.`}
            </p>
            {batchGroups.length > 0 && (
              <ul className="text-sm space-y-2 border border-white/10 rounded divide-y divide-white/5">
                {batchGroups.map((g) => (
                  <li key={g.customer_id} className="px-3 py-2 flex justify-between gap-2 text-gray-300">
                    <span className="truncate">{g.customer_name}</span>
                    <span className="text-white whitespace-nowrap">
                      {g.invoice_count} × ${g.total_amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBatchPreviewOpen(false)}
                className="px-4 py-2 border border-white/20 text-gray-300 rounded text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runBatchCommit}
                disabled={batchGroups.length === 0 || batchLoading !== null}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-medium inline-flex items-center gap-2"
              >
                {batchLoading === "commit" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create batch invoices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Load Status Filters */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Load Status
            </label>
            <div className="space-y-2">
              {["Pending", "In Progress", "Completed"].map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.loadStatus.includes(status)}
                    onChange={() => toggleLoadStatusFilter(status)}
                    className="w-4 h-4 rounded bg-white/10 border border-white/20"
                  />
                  <span className="text-sm text-gray-300">{status}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Billing Status Filters */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Billing Status
            </label>
            <div className="space-y-2">
              {["Drafted", "Approved", "Billed", "Rebilling"].map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.billingStatus.includes(status)}
                    onChange={() => toggleBillingStatusFilter(status)}
                    className="w-4 h-4 rounded bg-white/10 border border-white/20"
                  />
                  <span className="text-sm text-gray-300">{status}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-10">

              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-10">

              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Invoice #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Charge Set #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Driver
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Delivered To
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Load Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Load Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Billing Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Container #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Bill To
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Reference #
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleRow(invoice.id)}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      {expandedRows.has(invoice.id) ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 flex gap-1">
                    <button
                      title="Email Invoice"
                      onClick={() => {
                        if (invoice.customers?.email) {
                          const subject = `Invoice ${invoice.invoice_number}`
                          window.location.href = `mailto:${invoice.customers.email}?subject=${encodeURIComponent(subject)}`
                        }
                      }}
                      disabled={!invoice.customers?.email}
                      className="text-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      title="Copy"
                      onClick={() => {
                        navigator.clipboard.writeText(invoice.invoice_number)
                      }}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-white font-medium">
                    <Link
                      href={`/dashboard/accounts-receivable/invoices/${invoice.id}`}
                      className="hover:text-[#E8700A] transition-colors"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.charge_set_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.loads?.drivers?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.customers?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.loads?.delivery_location || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.loads?.created_at
                      ? new Date(invoice.loads.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        statusColors[invoice.loads?.status || "Pending"]?.bg ||
                        "bg-gray-900/30"
                      } ${
                        statusColors[invoice.loads?.status || "Pending"]?.text ||
                        "text-gray-300"
                      }`}
                    >
                      {invoice.loads?.status || "Unknown"}
                    </span>
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
                      {invoice.billing_status || "Drafted"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.loads?.container_id || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.customers?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {invoice.loads?.reference_number || "-"}
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
