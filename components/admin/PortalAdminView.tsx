"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search,
  Plus,
  Trash2,
  X,
  Loader2,
  UserPlus,
  Users,
  ExternalLink,
  Mail,
  Shield,
  Building2,
} from "lucide-react"
import { exportToCSV, type ExportColumn } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

// ─── Styles ──────────────────────────────────────────────────
const S = {
  panel: "bg-[#141922] border-[#1e2530]",
  panelHeader: "bg-[#0B1120] border-[#1e2530]",
  input: "bg-[#1a2030] border border-[#2a3444] text-white placeholder-gray-600 focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A] outline-none",
  label: "text-xs font-medium text-gray-400",
  th: "px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]",
  td: "px-3 py-2.5 text-[11px] text-gray-300 whitespace-nowrap border-b border-[#1e2530]/60",
}

type PortalUser = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  customer_id: string | null
  customers: { id: string; name: string; email: string | null } | null
}

type Customer = {
  id: string
  name: string
  email: string | null
  city: string | null
  state: string | null
}

export function PortalAdminView() {
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [inviting, setInviting] = useState<string | null>(null)

  const fetchPortalUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/portal-users")
      if (res.ok) {
        const data = await res.json()
        setPortalUsers(data.portalUsers || [])
      }
    } catch (err) {
      console.error("Error fetching portal users:", err)
    }
  }, [])

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/customers")
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch (err) {
      console.error("Error fetching customers:", err)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchPortalUsers(), fetchCustomers()])
      setLoading(false)
    }
    load()
  }, [fetchPortalUsers, fetchCustomers])

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this portal user? They will no longer be able to access the portal.")) {
      return
    }
    setDeleting(userId)
    try {
      const res = await fetch(`/api/admin/portal-users?id=${userId}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || "Failed to delete user")
        return
      }
      fetchPortalUsers()
    } catch (err) {
      console.error("Delete error:", err)
    } finally {
      setDeleting(null)
    }
  }

  const handleSendInvite = async (email: string, userId: string) => {
    setInviting(userId)
    try {
      const res = await fetch("/api/admin/portal-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || "Failed to send invite")
        return
      }
      alert(`Magic link invite sent to ${email}. They can click the link in the email to sign in.`)
    } catch (err) {
      console.error("Invite error:", err)
    } finally {
      setInviting(null)
    }
  }

  const filtered = portalUsers.filter((u) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      u.full_name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.customers?.name?.toLowerCase().includes(s)
    )
  })

  const portalUserExportColumns: ExportColumn<PortalUser>[] = [
    { header: "Name", accessor: (u) => u.full_name },
    { header: "Email", accessor: (u) => u.email },
    { header: "Company", accessor: (u) => u.customers?.name },
    { header: "Customer ID", accessor: (u) => u.customer_id },
  ]

  const handleExportPortalUsers = () => {
    exportToCSV("portal-users", portalUserExportColumns, filtered)
  }

  // Group users by customer for summary
  const customerMap = new Map<string, number>()
  portalUsers.forEach((u) => {
    const cid = u.customer_id || "unlinked"
    customerMap.set(cid, (customerMap.get(cid) || 0) + 1)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#E8700A] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield size={20} className="text-[#E8700A]" />
            Customer Portal Admin
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage customer portal user accounts and access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/portal"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-medium rounded-lg bg-[#1a2030] border border-[#2a3444] text-gray-300 hover:text-white hover:border-[#3a4454] transition-colors flex items-center gap-1.5"
          >
            <ExternalLink size={12} /> Preview Portal
          </a>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#E8700A] hover:bg-[#FF8C21] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <UserPlus size={13} /> Add Portal User
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-xl p-4 border ${S.panel}`}>
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-blue-400" />
            <span className="text-xs text-gray-500">Total Portal Users</span>
          </div>
          <div className="text-2xl font-bold text-white">{portalUsers.length}</div>
        </div>
        <div className={`rounded-xl p-4 border ${S.panel}`}>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={14} className="text-green-400" />
            <span className="text-xs text-gray-500">Companies with Portal Access</span>
          </div>
          <div className="text-2xl font-bold text-white">{customerMap.size}</div>
        </div>
        <div className={`rounded-xl p-4 border ${S.panel}`}>
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">Total Customers</span>
          </div>
          <div className="text-2xl font-bold text-white">{customers.length}</div>
        </div>
      </div>

      {/* Search + Table */}
      <div className={`rounded-xl border overflow-hidden ${S.panel}`}>
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${S.panelHeader}`}>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg ${S.input}`}
            />
          </div>
          <span className="text-xs text-gray-500">
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          </span>
          <ExportButton onClick={handleExportPortalUsers} count={filtered.length} />
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {portalUsers.length === 0
                ? "No portal users yet. Click \"Add Portal User\" to create one."
                : "No users match your search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className={S.th}>Name</th>
                  <th className={S.th}>Email</th>
                  <th className={S.th}>Company</th>
                  <th className={S.th}>Customer ID</th>
                  <th className={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-[#1a2030]/50 transition-colors">
                    <td className={S.td}>
                      <span className="text-white font-medium">
                        {user.full_name || "—"}
                      </span>
                    </td>
                    <td className={S.td}>
                      <span className="text-gray-300">{user.email || "—"}</span>
                    </td>
                    <td className={S.td}>
                      <span className="text-gray-300">
                        {user.customers?.name || "—"}
                      </span>
                    </td>
                    <td className={S.td}>
                      <span className="text-gray-500 font-mono text-[10px]">
                        {user.customer_id ? user.customer_id.slice(0, 8) + "..." : "—"}
                      </span>
                    </td>
                    <td className={S.td}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSendInvite(user.email || "", user.id)}
                          disabled={!user.email || inviting === user.id}
                          className="p-1.5 hover:bg-blue-500/20 rounded text-gray-500 hover:text-blue-400 disabled:opacity-30 transition-colors"
                          title="Send magic link invite"
                        >
                          {inviting === user.id ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : (
                            <Mail size={20} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={deleting === user.id}
                          className="p-1.5 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                          title="Remove portal user"
                        >
                          {deleting === user.id ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : (
                            <Trash2 size={20} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreatePortalUserModal
          customers={customers}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchPortalUsers()
          }}
        />
      )}
    </div>
  )
}

// ─── Create Modal ────────────────────────────────────────────
function CreatePortalUserModal({
  customers,
  onClose,
  onCreated,
}: {
  customers: Customer[]
  onClose: () => void
  onCreated: () => void
}) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true
    const s = customerSearch.toLowerCase()
    return (
      c.name.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.city?.toLowerCase().includes(s)
    )
  })

  const selectedCustomer = customers.find((c) => c.id === customerId)

  const handleCreate = async () => {
    if (!email.trim()) { setError("Email is required"); return }
    if (!customerId) { setError("Please select a customer"); return }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email format")
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/admin/portal-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          customer_id: customerId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create user")
        return
      }

      if (data.inviteWarning) {
        alert(data.inviteWarning)
      }

      onCreated()
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl border bg-[#141922] border-[#1e2530]`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b rounded-t-2xl bg-[#0B1120] border-[#1e2530]`}>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus size={18} className="text-[#E8700A]" />
            Add Portal User
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm bg-[#1a2030] border border-[#2a3444] text-white placeholder-gray-600 focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A] outline-none`}
              placeholder="customer@example.com"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              They will sign in using magic links sent to this email.
            </p>
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm bg-[#1a2030] border border-[#2a3444] text-white placeholder-gray-600 focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A] outline-none`}
              placeholder="John Smith"
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">
              Customer / Company *
            </label>

            {selectedCustomer ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1a2030] border border-[#E8700A]/30">
                <div>
                  <span className="text-sm text-white font-medium">
                    {selectedCustomer.name}
                  </span>
                  {selectedCustomer.city && (
                    <span className="text-xs text-gray-500 ml-2">
                      {selectedCustomer.city}
                      {selectedCustomer.state ? `, ${selectedCustomer.state}` : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setCustomerId("")}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 rounded-lg text-sm bg-[#1a2030] border border-[#2a3444] text-white placeholder-gray-600 focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A] outline-none`}
                    placeholder="Search customers..."
                  />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-[#2a3444] bg-[#1a2030]">
                  {filteredCustomers.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-500 text-center">
                      No customers found
                    </div>
                  ) : (
                    filteredCustomers.slice(0, 50).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id)
                          setCustomerSearch("")
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-[#2a3040] transition-colors border-b border-[#1e2530]/40 last:border-b-0"
                      >
                        <div className="text-xs text-white font-medium">{c.name}</div>
                        <div className="text-[10px] text-gray-500">
                          {c.city ? `${c.city}${c.state ? `, ${c.state}` : ""}` : ""}
                          {c.email ? ` · ${c.email}` : ""}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t rounded-b-2xl bg-[#0B1120] border-[#1e2530]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !email || !customerId}
            className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Create Portal User
          </button>
        </div>
      </div>
    </div>
  )
}
