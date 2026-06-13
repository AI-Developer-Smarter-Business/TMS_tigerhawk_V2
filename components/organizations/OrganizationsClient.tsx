// components/organizations/OrganizationsClient.tsx
"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTableSort } from "@/hooks/useTableSort"
import { SortableHeader } from "@/components/ui/SortableHeader"
import { AddOrganizationModal } from "./AddOrganizationModal"
import { createClient } from "@/lib/supabase/client"

type OrgRecord = {
  id: string
  name: string
  phone: string | null
  main_contact_name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  customer_type: string | null
  credit_limit: number | null
  default_payment_terms: number | null
  credit_hold: boolean
  account_hold: boolean
  currency: string | null
  created_at?: string
}

type TabKey = "customers" | "terminals" | "warehouses" | "yards"

type Props = {
  customers: OrgRecord[]
  terminals: OrgRecord[]
  warehouses: OrgRecord[]
  yards: OrgRecord[]
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "customers", label: "Customers" },
  { key: "terminals", label: "Terminals" },
  { key: "warehouses", label: "Warehouses" },
  { key: "yards", label: "Yards" },
]

const TABLE_MAP: Record<TabKey, string> = {
  customers: "customers",
  terminals: "terminals",
  warehouses: "warehouses",
  yards: "yards",
}

function TypeBadges({ types }: { types: string | null }) {
  if (!types) return <span className="text-gray-600">—</span>
  const badges = types.split(",").map(t => t.trim()).filter(Boolean)
  if (badges.length === 0) return <span className="text-gray-600">—</span>

  const colorMap: Record<string, string> = {
    caller: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    consignee: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    shipper: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    containerReturn: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    chassisTermination: "bg-red-500/15 text-red-400 border-red-500/20",
    chassisPick: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
    ALL: "bg-[#E8700A]/15 text-[#FF8C21] border-[#E8700A]/20",
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map(b => (
        <span
          key={b}
          className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium border ${colorMap[b] || "bg-gray-500/15 text-gray-400 border-gray-500/20"}`}
        >
          {b}
        </span>
      ))}
    </div>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); setConfirming(false) }}
          className="p-0.5 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          title="Confirm delete"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false) }}
          className="p-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          title="Cancel"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
      className="p-0.5 rounded text-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
      title="Delete"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
      </svg>
    </button>
  )
}

function OrgTable({ data, tableName, onDeleted }: { data: OrgRecord[]; tableName: string; onDeleted: () => void }) {
  const [search, setSearch] = useState("")
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      r.city?.toLowerCase().includes(q) ||
      r.state?.toLowerCase().includes(q) ||
      r.customer_type?.toLowerCase().includes(q) ||
      r.main_contact_name?.toLowerCase().includes(q) ||
      r.address?.toLowerCase().includes(q)
    )
  }, [data, search])

  const { sortedData, sortConfig, requestSort } = useTableSort(filtered, { key: "name", direction: "asc" })

  const hp = (label: string, sortKey: string) => ({
    label,
    sortKey,
    currentSortKey: sortConfig?.key as string | null,
    currentDirection: sortConfig?.direction ?? null,
    onSort: requestSort,
  })

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id)
    try {
      const supabase = createClient()
      const { error } = await supabase.from(tableName).delete().eq("id", id)
      if (error) {
        console.error("Delete error:", error.message)
        alert(`Failed to delete: ${error.message}`)
      } else {
        onDeleted()
      }
    } catch (err) {
      console.error("Delete error:", err)
    } finally {
      setDeleting(null)
    }
  }, [tableName, onDeleted])

  return (
    <div>
      {/* Search + count */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
          />
        </div>
        <span className="text-sm text-gray-500">
          {sortedData.length} of {data.length} records
        </span>
      </div>

      {/* Table */}
      <div className="bg-[#111827] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
          <table className="min-w-max w-full text-xs">
            <thead className="sticky top-0 z-10 bg-[#111827]">
              <tr className="border-b border-white/10">
                <th className="px-1 py-2 w-6" />
                <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-8">#</th>
                <SortableHeader {...hp("Company Name", "name")} />
                <SortableHeader {...hp("Phone", "phone")} />
                <SortableHeader {...hp("Main Contact", "main_contact_name")} />
                <SortableHeader {...hp("Address", "address")} />
                <SortableHeader {...hp("City", "city")} />
                <SortableHeader {...hp("State", "state")} />
                <SortableHeader {...hp("Zip", "zip_code")} />
                <th className="px-2 py-2"><span className="text-[10px] font-medium text-gray-500 uppercase">Type</span></th>
                <SortableHeader {...hp("Credit Limit", "credit_limit")} />
                <SortableHeader {...hp("Terms", "default_payment_terms")} />
                <th className="px-2 py-2"><span className="text-[10px] font-medium text-gray-500 uppercase">Credit Hold</span></th>
                <th className="px-2 py-2"><span className="text-[10px] font-medium text-gray-500 uppercase">Acct Hold</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-sm text-gray-500">
                    No records found
                  </td>
                </tr>
              ) : (
                sortedData.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`group hover:bg-white/[0.03] transition-colors ${deleting === row.id ? "opacity-50" : ""}`}
                  >
                    <td className="px-1 py-2">
                      <DeleteButton onDelete={() => handleDelete(row.id)} />
                    </td>
                    <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-2 py-2 text-gray-200 font-medium whitespace-nowrap">{row.name}</td>
                    <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{row.phone || "—"}</td>
                    <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{row.main_contact_name || "—"}</td>
                    <td className="px-2 py-2 text-gray-400 truncate max-w-[200px]">{row.address || "—"}</td>
                    <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{row.city || "—"}</td>
                    <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{row.state || "—"}</td>
                    <td className="px-2 py-2 text-gray-400 whitespace-nowrap">{row.zip_code || "—"}</td>
                    <td className="px-2 py-2"><TypeBadges types={row.customer_type} /></td>
                    <td className="px-2 py-2 text-gray-300 whitespace-nowrap">
                      {row.credit_limit ? `$${Number(row.credit_limit).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-gray-400 whitespace-nowrap">
                      {row.default_payment_terms ? `${row.default_payment_terms} days` : "—"}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {row.credit_hold ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">HOLD</span>
                      ) : (
                        <span className="text-gray-600 text-[10px]">No</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {row.account_hold ? (
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20">HOLD</span>
                      ) : (
                        <span className="text-gray-600 text-[10px]">No</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function OrganizationsClient({ customers, terminals, warehouses, yards }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>("customers")
  const [addModalOpen, setAddModalOpen] = useState(false)

  const tabData: Record<TabKey, OrgRecord[]> = { customers, terminals, warehouses, yards }
  const tabCounts: Record<TabKey, number> = {
    customers: customers.length,
    terminals: terminals.length,
    warehouses: warehouses.length,
    yards: yards.length,
  }

  const handleCreated = useCallback(() => {
    router.refresh()
  }, [router])

  const handleDeleted = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Organizations</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customers, terminals, warehouses, and yards</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] font-semibold text-red-400 uppercase tracking-wide">
            Admin Only
          </span>
          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors"
          >
            + Add New Organization
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/5 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.key ? "text-white" : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {tab.label}
              <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === tab.key
                  ? "bg-[#E8700A] text-white"
                  : "bg-white/5 text-gray-500"
              }`}>
                {tabCounts[tab.key]}
              </span>
            </div>
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E8700A]" />
            )}
          </button>
        ))}
      </div>

      {/* Active table */}
      <OrgTable
        data={tabData[activeTab]}
        tableName={TABLE_MAP[activeTab]}
        onDeleted={handleDeleted}
      />

      {/* Add Organization Modal */}
      <AddOrganizationModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  )
}
