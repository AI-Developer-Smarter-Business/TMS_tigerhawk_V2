"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, Plus, Pencil, X, Users, Loader2, UserPlus, Trash2, FileUp } from "lucide-react"
import { ImportStaffCsvModal } from "@/components/drivers/ImportStaffCsvModal"
import { createClient } from "@/lib/supabase/client"
import { AccessorialCatalogView } from "./AccessorialCatalogView"
import PayCalculatorView from "./PayCalculatorView"
import RateProfilesView from "./RateProfilesView"
/* Lane Rate Matrix — oculto a petición del cliente (2026-05); el código sigue en el repo para reactivar rápido.
   Descomentar: import + tipo + estado/callback + entrada en tabs + toolbar + rama de contenido. */
// import LaneRateMatrixView, { LaneRateActions } from "./LaneRateMatrixView"

// type LaneMatrixToolbarActions = {
//   onAddOrigin: () => void
//   onAddZone: () => void
//   onDeleteOrigin: () => void
//   originName: string | null
// }

// ─── Types ──────────────────────────────────────────────────────
type Driver = {
  id: string
  name: string
  first_name: string | null
  last_name: string | null
  phone: string
  truck_owner: string | null
  enabled: boolean
  status: string
  driver_pay: number | null
  driver_pay_notes: string | null
}

type DriverGroup = {
  id: string
  name: string
  pay_type: string
  base_rate: number
  is_company_driver: boolean
  default_service_type: string
  notes: string | null
  is_active: boolean
}

type DriverGroupAssignment = {
  id: string
  driver_id: string
  driver_group_id: string
  effective_date: string
  expires_date: string | null
}

interface DriverPayRatesViewProps {
  drivers: Driver[]
}

// ─── Helpers ──────────────────────────────────────────────────
function getAvatarColor(name: string): string {
  const colors = [
    "bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-pink-500", "bg-indigo-500", "bg-cyan-500", "bg-amber-500",
    "bg-emerald-500", "bg-rose-500", "bg-teal-500", "bg-orange-500",
    "bg-violet-500", "bg-yellow-500",
  ]
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

function formatPayType(payType: string): string {
  switch (payType) {
    case "hourly": return "Hourly"
    case "per_move": return "Per Move"
    case "per_mile": return "Per Mile"
    case "percentage": return "Percentage"
    case "flat": return "Flat"
    default: return payType
  }
}

function payTypeBadgeColor(payType: string): string {
  switch (payType) {
    case "hourly": return "bg-blue-500/10 text-blue-400"
    case "per_move": return "bg-green-500/10 text-green-400"
    case "per_mile": return "bg-purple-500/10 text-purple-400"
    case "percentage": return "bg-amber-500/10 text-amber-400"
    default: return "bg-gray-500/10 text-gray-400"
  }
}

// ─── Driver Avatars ──────────────────────────────────────────
function DriverAvatars({ driverNames }: { driverNames: string[] }) {
  const displayed = driverNames.slice(0, 4)
  const remaining = driverNames.length - 4

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-1.5">
        {displayed.map((name, idx) => (
          <div
            key={idx}
            className={`${getAvatarColor(name)} flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white border-2 border-[#111827]`}
            title={name}
          >
            {getInitials(name)}
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <span className="text-xs text-gray-500 ml-1">+{remaining}</span>
      )}
    </div>
  )
}

// ─── Add/Edit Group Modal ────────────────────────────────────
function GroupModal({
  open,
  onClose,
  onSaved,
  editGroup,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editGroup?: DriverGroup | null
}) {
  const [name, setName] = useState("")
  const [payType, setPayType] = useState("hourly")
  const [baseRate, setBaseRate] = useState("")
  const [isCompanyDriver, setIsCompanyDriver] = useState(false)
  const [serviceType, setServiceType] = useState("Drayage")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (editGroup) {
      setName(editGroup.name)
      setPayType(editGroup.pay_type)
      setBaseRate(editGroup.base_rate?.toString() || "")
      setIsCompanyDriver(editGroup.is_company_driver)
      setServiceType(editGroup.default_service_type)
      setNotes(editGroup.notes || "")
    } else {
      setName(""); setPayType("hourly"); setBaseRate(""); setIsCompanyDriver(false)
      setServiceType("Drayage"); setNotes("")
    }
    setError("")
  }, [editGroup, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim()) { setError("Group name is required"); return }
    setSaving(true)
    setError("")

    try {
      const body = {
        name: name.trim(),
        pay_type: payType,
        base_rate: parseFloat(baseRate) || 0,
        is_company_driver: isCompanyDriver,
        default_service_type: serviceType,
        notes: notes.trim() || null,
        ...(editGroup ? { id: editGroup.id } : {}),
      }

      const res = await fetch("/api/drivers/pay-rates/groups", {
        method: editGroup ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save group")
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111827]">
          <h2 className="text-lg font-bold text-white">{editGroup ? "Edit Group" : "Add New Group"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Group Name *</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              placeholder="e.g. Owner Operator - Per Move"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Pay Type</label>
              <select
                value={payType} onChange={(e) => setPayType(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              >
                <option value="hourly">Hourly</option>
                <option value="per_move">Per Move</option>
                <option value="per_mile">Per Mile</option>
                <option value="percentage">Percentage</option>
                <option value="flat">Flat Rate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Base Rate {payType === "hourly" ? "($/hr)" : payType === "per_mile" ? "($/mi)" : "($)"}
              </label>
              <input
                type="number" step="0.01" value={baseRate} onChange={(e) => setBaseRate(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="e.g. 27.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Service Type</label>
              <select
                value={serviceType} onChange={(e) => setServiceType(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              >
                <option value="Drayage">Drayage</option>
                <option value="Yard Pull">Yard Pull</option>
                <option value="Empty Return">Empty Return</option>
                <option value="Air Bags">Air Bags</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={isCompanyDriver} onChange={(e) => setIsCompanyDriver(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-[#E8700A] focus:ring-[#E8700A]"
                />
                <span className="text-sm text-gray-400">Company Driver</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A] resize-none"
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-[#111827]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {editGroup ? "Update Group" : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Drivers Modal ────────────────────────────────────
function AssignDriversModal({
  open,
  onClose,
  group,
  allDrivers,
  allGroups,
  assignments,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  group: DriverGroup | null
  allDrivers: Driver[]
  allGroups: DriverGroup[]
  assignments: DriverGroupAssignment[]
  onSaved: () => void
}) {
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState("")

  if (!open || !group) return null

  const assignedDriverIds = new Set(
    assignments
      .filter((a) => a.driver_group_id === group.id)
      .map((a) => a.driver_id)
  )

  const handleToggle = async (driverId: string) => {
    setSaving(driverId)
    setError("")
    try {
      if (assignedDriverIds.has(driverId)) {
        // Remove assignment
        const assignment = assignments.find((a) => a.driver_group_id === group.id && a.driver_id === driverId)
        if (assignment) {
          const res = await fetch(`/api/drivers/pay-rates/assignments?id=${assignment.id}`, { method: "DELETE" })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || "Failed to remove assignment")
          }
        }
      } else {
        // Add assignment — effective_date is required by the API
        const res = await fetch("/api/drivers/pay-rates/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driver_id: driverId,
            driver_group_id: group.id,
            effective_date: new Date().toISOString().split("T")[0],
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to assign driver")
        }
      }
      onSaved()
    } catch (err) {
      console.error("Assignment error:", err)
      setError(err instanceof Error ? err.message : "Failed to update assignment")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111827]">
          <div>
            <h2 className="text-lg font-bold text-white">Assign Drivers</h2>
            <p className="text-xs text-gray-500">{group.name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {error && (
            <div className="px-3 py-2 mb-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
          )}
          {allDrivers.map((driver) => {
            const isAssigned = assignedDriverIds.has(driver.id)
            const isSaving = saving === driver.id
            // Check if driver is assigned to a different group
            const otherAssignment = assignments.find(
              (a) => a.driver_id === driver.id && a.driver_group_id !== group.id
            )
            const otherGroupName = otherAssignment
              ? allGroups.find((g) => g.id === otherAssignment.driver_group_id)?.name
              : null
            return (
              <button
                key={driver.id}
                onClick={() => handleToggle(driver.id)}
                disabled={isSaving}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isAssigned ? "bg-[#E8700A]/10 border border-[#E8700A]/20" : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className={`${getAvatarColor(driver.name)} flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white`}>
                  {getInitials(driver.name)}
                </div>
                <div className="flex-1 text-left">
                  <span className="text-sm text-white">{driver.name}</span>
                  {otherGroupName && !isAssigned && (
                    <span className="block text-[10px] text-amber-400/70">Assigned to {otherGroupName}</span>
                  )}
                </div>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                ) : (
                  <div className={`w-4 h-4 rounded-full border-2 ${
                    isAssigned ? "bg-[#E8700A] border-[#E8700A]" : "border-white/20"
                  }`} />
                )}
              </button>
            )
          })}
        </div>

        <div className="px-6 py-3 border-t border-white/10 bg-[#111827]">
          <button onClick={onClose} className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Driver Groups Tab Content ───────────────────────────────
function DriverGroupsTab({ drivers }: { drivers: Driver[] }) {
  const supabase = createClient()
  const [groups, setGroups] = useState<DriverGroup[]>([])
  const [assignments, setAssignments] = useState<DriverGroupAssignment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<DriverGroup | null>(null)
  const [assignGroup, setAssignGroup] = useState<DriverGroup | null>(null)
  const [importGroupsOpen, setImportGroupsOpen] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const [groupsRes, assignRes] = await Promise.all([
      supabase.from("driver_groups").select("*").order("name"),
      supabase.from("driver_group_assignments").select("*"),
    ])
    setGroups(groupsRes.data || [])
    setAssignments(assignRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [supabase])

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups
    const q = searchQuery.toLowerCase()
    return groups.filter((g) => g.name.toLowerCase().includes(q))
  }, [groups, searchQuery])

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Delete group "${groupName}"? This will also remove all driver assignments for this group.`)) return
    try {
      const res = await fetch(`/api/drivers/pay-rates/groups?id=${groupId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Failed to delete group")
        return
      }
      fetchData()
    } catch {
      alert("Failed to delete group")
    }
  }

  const getDriverNamesForGroup = (groupId: string): string[] => {
    const driverIds = assignments
      .filter((a) => a.driver_group_id === groupId)
      .map((a) => a.driver_id)
    return drivers
      .filter((d) => driverIds.includes(d.id))
      .map((d) => d.name)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#E8700A] animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <ImportStaffCsvModal
        open={importGroupsOpen}
        onClose={() => setImportGroupsOpen(false)}
        entity="driver_groups"
        templateUrl="/api/admin/csv-template/driver_groups"
        title="Import driver groups (CSV)"
      />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-white">
          {filteredGroups.length} Group{filteredGroups.length !== 1 ? "s" : ""}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportGroupsOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-white/15 text-gray-200 hover:bg-white/5 px-4 py-2 transition-colors font-medium text-sm"
          >
            <FileUp size={16} />
            Import CSV
          </button>
          <button
            onClick={() => { setEditGroup(null); setGroupModalOpen(true) }}
            className="flex items-center gap-2 rounded-lg bg-[#E8700A] hover:bg-[#FF8C21] text-white px-4 py-2 transition-colors font-medium text-sm"
          >
            <Plus size={16} />
            Add New Group
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
        />
      </div>

      <div className="bg-[#0B1120] rounded-lg border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Group Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pay Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Base Rate</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Drivers</th>
              <th className="px-6 py-3 text-right w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredGroups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  {groups.length === 0 ? "No groups created yet. Add your first driver group." : "No groups match your search."}
                </td>
              </tr>
            ) : (
              filteredGroups.map((group) => {
                const driverNames = getDriverNamesForGroup(group.id)
                return (
                  <tr key={group.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[#FF8C21] font-medium">{group.name}</span>
                        {group.is_company_driver && (
                          <span className="px-2 py-0.5 bg-blue-500/10 rounded text-[10px] font-medium text-blue-400">Company</span>
                        )}
                        {!group.is_active && (
                          <span className="px-2 py-0.5 bg-red-500/10 rounded text-[10px] font-medium text-red-400">Inactive</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payTypeBadgeColor(group.pay_type)}`}>
                        {formatPayType(group.pay_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">
                      {group.pay_type === "hourly" ? `$${group.base_rate}/hr` :
                       group.pay_type === "per_mile" ? `$${group.base_rate}/mi` :
                       group.base_rate ? `$${group.base_rate}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      {driverNames.length > 0 ? (
                        <DriverAvatars driverNames={driverNames} />
                      ) : (
                        <span className="text-xs text-gray-600">No drivers assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAssignGroup(group)}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                          title="Assign drivers"
                        >
                          <UserPlus size={15} className="text-gray-500 hover:text-white" />
                        </button>
                        <button
                          onClick={() => { setEditGroup(group); setGroupModalOpen(true) }}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors"
                          title="Edit group"
                        >
                          <Pencil size={15} className="text-gray-500 hover:text-white" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                          title="Delete group"
                        >
                          <Trash2 size={15} className="text-gray-500 hover:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <GroupModal
        open={groupModalOpen}
        onClose={() => { setGroupModalOpen(false); setEditGroup(null) }}
        onSaved={fetchData}
        editGroup={editGroup}
      />

      <AssignDriversModal
        open={!!assignGroup}
        allGroups={groups}
        onClose={() => setAssignGroup(null)}
        group={assignGroup}
        allDrivers={drivers}
        assignments={assignments}
        onSaved={fetchData}
      />
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────
export default function DriverPayRatesView({ drivers }: DriverPayRatesViewProps) {
  const [activeTab, setActiveTab] = useState<
    "groups" | "profiles" | "accessorials" | "calculator"
  >("groups")
  // const [laneMatrixToolbar, setLaneMatrixToolbar] = useState<LaneMatrixToolbarActions | null>(null)
  //
  // const onLaneMatrixActionsReady = useCallback((actions: LaneMatrixToolbarActions | null) => {
  //   setLaneMatrixToolbar(actions)
  // }, [])

  const tabs = [
    { id: "groups" as const, label: "Driver Groups" },
    { id: "profiles" as const, label: "Rate Profiles" },
    // { id: "lane-matrix" as const, label: "Lane Rate Matrix" },
    { id: "accessorials" as const, label: "Accessorials" },
    { id: "calculator" as const, label: "Pay Calculator" },
  ]

  return (
    <div className="flex flex-col">
      {/* Sub-tabs */}
      <div className="border-b border-white/5 px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-[#E8700A] text-white"
                    : "border-transparent text-gray-400 hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* {activeTab === "lane-matrix" && laneMatrixToolbar ? (
            <div className="flex items-center pb-1">
              <LaneRateActions {...laneMatrixToolbar} />
            </div>
          ) : null} */}
        </div>
      </div>

      {/* Content */}
      {activeTab === "groups" && <DriverGroupsTab drivers={drivers} />}
      {activeTab === "profiles" && <RateProfilesView />}
      {/* {activeTab === "lane-matrix" && (
        <LaneRateMatrixView onActionsReady={onLaneMatrixActionsReady} />
      )} */}
      {activeTab === "accessorials" && <AccessorialCatalogView />}
      {activeTab === "calculator" && <PayCalculatorView />}
    </div>
  )
}
