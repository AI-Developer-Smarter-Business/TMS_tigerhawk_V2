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
  Shield,
  Pencil,
  Key,
  Mail,
  ShieldCheck,
  ShieldOff,
} from "lucide-react"
import { exportToCSV, type ExportColumn } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

// ─── Styles ──────────────────────────────────────────────────
const S = {
  panel: "bg-[#141922] border-[#1e2530]",
  panelHeader: "bg-[#0B1120] border-[#1e2530]",
  input:
    "bg-[#1a2030] border border-[#2a3444] text-white placeholder-gray-600 focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A] outline-none",
  th: "px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]",
  td: "px-3 py-2.5 text-[11px] text-gray-300 whitespace-nowrap border-b border-[#1e2530]/60",
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/20 text-red-300 border-red-500/30",
  dispatcher: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  accounting: "bg-green-500/20 text-green-300 border-green-500/30",
  driver: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
}

type StaffUser = {
  id: string
  full_name: string | null
  email: string | null
  role: string
  last_sign_in_at: string | null
  created_at: string
  mfa_enabled: boolean
}

export function UserManagementView() {
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null)
  const [passwordUser, setPasswordUser] = useState<StaffUser | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [disabling2FA, setDisabling2FA] = useState<string | null>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users")
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch (err) {
      console.error("Error fetching users:", err)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchUsers()
      setLoading(false)
    }
    load()
  }, [fetchUsers])

  const handleDelete = async (user: StaffUser) => {
    if (
      !confirm(
        `Are you sure you want to delete ${user.full_name || user.email}? This will remove their login access permanently.`
      )
    ) {
      return
    }
    setDeleting(user.id)
    try {
      const res = await fetch(`/api/admin/users?id=${user.id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || "Failed to delete user")
        return
      }
      fetchUsers()
    } catch (err) {
      console.error("Delete error:", err)
    } finally {
      setDeleting(null)
    }
  }

  const handleDisable2FA = async (user: StaffUser) => {
    if (
      !confirm(
        `Are you sure you want to disable 2FA for ${user.full_name || user.email}? They will need to re-enroll to use 2FA again.`
      )
    ) {
      return
    }
    setDisabling2FA(user.id)
    try {
      const res = await fetch(`/api/admin/users/mfa?userId=${user.id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || "Failed to disable 2FA")
        return
      }
      fetchUsers()
    } catch (err) {
      console.error("Disable 2FA error:", err)
    } finally {
      setDisabling2FA(null)
    }
  }

  const handleSendInvite = async (user: StaffUser) => {
    if (!user.email) return
    setSendingInvite(user.id)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, sendInvite: true, email: user.email }),
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error || "Failed to send invite")
        return
      }
      alert(`Magic link sent to ${user.email}`)
    } catch (err) {
      console.error("Send invite error:", err)
    } finally {
      setSendingInvite(null)
    }
  }

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)
    )
  })

  const exportColumns: ExportColumn<StaffUser>[] = [
    { header: "Name", accessor: (u) => u.full_name },
    { header: "Email", accessor: (u) => u.email },
    { header: "Role", accessor: (u) => u.role },
    { header: "2FA", accessor: (u) => (u.mfa_enabled ? "Enabled" : "Disabled") },
    { header: "Last Sign In", accessor: (u) => u.last_sign_in_at },
    { header: "Created", accessor: (u) => u.created_at },
  ]

  const handleExport = () => {
    exportToCSV("staff-users", exportColumns, filtered)
  }

  // Summary counts
  const roleCounts = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

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
            <Users size={20} className="text-[#E8700A]" />
            User Management
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage staff accounts, roles, and access
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#E8700A] hover:bg-[#FF8C21] text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <UserPlus size={13} /> Add Staff User
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className={`rounded-xl p-4 border ${S.panel}`}>
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500">Total Staff</span>
          </div>
          <div className="text-2xl font-bold text-white">{users.length}</div>
        </div>
        {(["admin", "dispatcher", "accounting", "driver"] as const).map((r) => (
          <div key={r} className={`rounded-xl p-4 border ${S.panel}`}>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} className="text-gray-400" />
              <span className="text-xs text-gray-500 capitalize">{r}s</span>
            </div>
            <div className="text-2xl font-bold text-white">{roleCounts[r] || 0}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter + Table */}
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
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={`px-3 py-1.5 text-xs rounded-lg ${S.input}`}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="accounting">Accounting</option>
            <option value="driver">Driver</option>
          </select>
          <span className="text-xs text-gray-500">
            {filtered.length} user{filtered.length !== 1 ? "s" : ""}
          </span>
          <ExportButton onClick={handleExport} count={filtered.length} />
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {users.length === 0
                ? 'No staff users found. Click "Add Staff User" to create one.'
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
                  <th className={S.th}>Role</th>
                  <th className={S.th}>2FA</th>
                  <th className={S.th}>Last Sign In</th>
                  <th className={S.th}>Created</th>
                  <th className={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-[#1a2030]/50 transition-colors">
                    <td className={S.td}>
                      <span className="text-white font-medium">
                        {u.full_name || "—"}
                      </span>
                    </td>
                    <td className={S.td}>{u.email || "—"}</td>
                    <td className={S.td}>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${ROLE_COLORS[u.role] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className={S.td}>
                      {u.mfa_enabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                          <ShieldCheck size={10} /> Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-gray-500/20 text-gray-500 border border-gray-500/30">
                          <ShieldOff size={10} /> Off
                        </span>
                      )}
                    </td>
                    <td className={S.td}>
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Never"}
                    </td>
                    <td className={S.td}>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className={S.td}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSendInvite(u)}
                          disabled={sendingInvite === u.id || !u.email}
                          className="p-1.5 hover:bg-green-500/20 rounded text-gray-500 hover:text-green-400 disabled:opacity-30 transition-colors"
                          title="Send magic link invite"
                        >
                          {sendingInvite === u.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Mail size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => setEditingUser(u)}
                          className="p-1.5 hover:bg-blue-500/20 rounded text-gray-500 hover:text-blue-400 transition-colors"
                          title="Edit user"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setPasswordUser(u)}
                          className="p-1.5 hover:bg-yellow-500/20 rounded text-gray-500 hover:text-yellow-400 transition-colors"
                          title="Reset password"
                        >
                          <Key size={14} />
                        </button>
                        {u.mfa_enabled && (
                          <button
                            onClick={() => handleDisable2FA(u)}
                            disabled={disabling2FA === u.id}
                            className="p-1.5 hover:bg-orange-500/20 rounded text-gray-500 hover:text-orange-400 disabled:opacity-30 transition-colors"
                            title="Disable 2FA"
                          >
                            {disabling2FA === u.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <ShieldOff size={14} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(u)}
                          disabled={deleting === u.id}
                          className="p-1.5 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                          title="Delete user"
                        >
                          {deleting === u.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
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
        <CreateStaffUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchUsers()
          }}
        />
      )}

      {/* Edit Role Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null)
            fetchUsers()
          }}
        />
      )}

      {/* Reset Password Modal */}
      {passwordUser && (
        <ResetPasswordModal
          user={passwordUser}
          onClose={() => setPasswordUser(null)}
        />
      )}
    </div>
  )
}

// ─── Create Staff User Modal ────────────────────────────────
function CreateStaffUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("dispatcher")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [inviteWarning, setInviteWarning] = useState("")

  const handleCreate = async () => {
    if (!email.trim()) {
      setError("Email is required")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email format")
      return
    }

    setSaving(true)
    setError("")
    setInviteWarning("")
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim() || undefined,
          role,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create user")
        return
      }
      if (data.inviteWarning) {
        setInviteWarning(data.inviteWarning)
      }
      setSuccess(true)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl border bg-[#141922] border-[#1e2530]">
        <div className="flex items-center justify-between px-6 py-4 border-b rounded-t-2xl bg-[#0B1120] border-[#1e2530]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus size={18} className="text-[#E8700A]" />
            Add Staff User
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
          {success && !inviteWarning && (
            <div className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
              Invitation email sent to <span className="font-medium">{email}</span>. They will receive a magic link to set up their account and password.
            </div>
          )}
          {success && inviteWarning && (
            <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
              User account created, but the invitation email could not be sent. You can resend the invite from the user table using the mail icon.
            </div>
          )}

          {!success && (
            <>
              <div>
                <label className="block mb-1 text-xs font-medium text-gray-400">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
                  placeholder="staff@tigerhawklogistics.com"
                />
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-gray-400">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block mb-1 text-xs font-medium text-gray-400">Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
                >
                  <option value="admin">Admin</option>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="accounting">Accounting</option>
                  <option value="driver">Driver</option>
                </select>
                <p className="text-[10px] text-gray-600 mt-1">
                  {role === "admin" && "Full access to all features including user management"}
                  {role === "dispatcher" && "Load management, driver assignment, and operational access"}
                  {role === "accounting" && "Financial access: invoices, payments, settlements"}
                  {role === "driver" && "View assigned loads and documents only"}
                </p>
              </div>

              <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                An invitation email with a magic link will be sent. The user will set their own password when they first sign in.
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t rounded-b-2xl bg-[#0B1120] border-[#1e2530]">
          <button
            onClick={() => {
              if (success) onCreated()
              else onClose()
            }}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {success ? "Close" : "Cancel"}
          </button>
          {!success && (
            <button
              onClick={handleCreate}
              disabled={saving || !email}
              className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Send Invitation
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Edit User Modal ────────────────────────────────────────
function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: StaffUser
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(user.full_name || "")
  const [role, setRole] = useState(user.role)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          full_name: fullName.trim(),
          role,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to update user")
        return
      }
      onSaved()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl border bg-[#141922] border-[#1e2530]">
        <div className="flex items-center justify-between px-6 py-4 border-b rounded-t-2xl bg-[#0B1120] border-[#1e2530]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Pencil size={18} className="text-[#E8700A]" />
            Edit User
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

          <div className="text-xs text-gray-400">
            Editing: <span className="text-white">{user.email}</span>
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-medium text-gray-400">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
            >
              <option value="admin">Admin</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="accounting">Accounting</option>
              <option value="driver">Driver</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t rounded-b-2xl bg-[#0B1120] border-[#1e2530]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reset Password Modal ───────────────────────────────────
function ResetPasswordModal({
  user,
  onClose,
}: {
  user: StaffUser
  onClose: () => void
}) {
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to reset password")
        return
      }
      setSuccess(true)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl border bg-[#141922] border-[#1e2530]">
        <div className="flex items-center justify-between px-6 py-4 border-b rounded-t-2xl bg-[#0B1120] border-[#1e2530]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={18} className="text-[#E8700A]" />
            Reset Password
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
          {success && (
            <div className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
              Password has been reset successfully.
            </div>
          )}

          <div className="text-xs text-gray-400">
            Resetting password for: <span className="text-white">{user.email}</span>
          </div>

          {!success && (
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-400">New Password *</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm ${S.input}`}
                placeholder="Minimum 8 characters"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t rounded-b-2xl bg-[#0B1120] border-[#1e2530]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            {success ? "Close" : "Cancel"}
          </button>
          {!success && (
            <button
              onClick={handleReset}
              disabled={saving || !newPassword}
              className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Reset Password
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
