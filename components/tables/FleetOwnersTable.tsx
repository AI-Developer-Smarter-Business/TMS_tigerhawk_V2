"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Search, Plus, X, Loader2, Pencil, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { exportToCSV, type ExportColumn } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

// ─── Database Type ──────────────────────────────────────────────
type FleetOwner = {
  id: string
  company_name: string
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  zip_code: string | null
  main_contact_name: string | null
  secondary_contact_name: string | null
  mobile: string | null
  email: string | null
  tax_id: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

// ─── Add / Edit Fleet Owner Modal ──────────────────────────────
function FleetOwnerModal({
  open,
  onClose,
  onSuccess,
  existing,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  existing: FleetOwner | null
}) {
  const [form, setForm] = useState({
    company_name: "",
    address: "",
    city: "",
    state: "TX",
    country: "US",
    zip_code: "",
    main_contact_name: "",
    secondary_contact_name: "",
    mobile: "",
    email: "",
    tax_id: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setForm({
        company_name: existing.company_name || "",
        address: existing.address || "",
        city: existing.city || "",
        state: existing.state || "TX",
        country: existing.country || "US",
        zip_code: existing.zip_code || "",
        main_contact_name: existing.main_contact_name || "",
        secondary_contact_name: existing.secondary_contact_name || "",
        mobile: existing.mobile || "",
        email: existing.email || "",
        tax_id: existing.tax_id || "",
      })
    } else {
      setForm({
        company_name: "",
        address: "",
        city: "",
        state: "TX",
        country: "US",
        zip_code: "",
        main_contact_name: "",
        secondary_contact_name: "",
        mobile: "",
        email: "",
        tax_id: "",
      })
    }
  }, [existing, open])

  if (!open) return null

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.company_name) {
      setError("Company name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      if (existing) {
        const { error: updateError } = await supabase
          .from("fleet_owners")
          .update({
            company_name: form.company_name,
            address: form.address || null,
            city: form.city || null,
            state: form.state || null,
            country: form.country || null,
            zip_code: form.zip_code || null,
            main_contact_name: form.main_contact_name || null,
            secondary_contact_name: form.secondary_contact_name || null,
            mobile: form.mobile || null,
            email: form.email || null,
            tax_id: form.tax_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from("fleet_owners").insert([
          {
            company_name: form.company_name,
            address: form.address || null,
            city: form.city || null,
            state: form.state || null,
            country: form.country || null,
            zip_code: form.zip_code || null,
            main_contact_name: form.main_contact_name || null,
            secondary_contact_name: form.secondary_contact_name || null,
            mobile: form.mobile || null,
            email: form.email || null,
            tax_id: form.tax_id || null,
            enabled: true,
          },
        ])

        if (insertError) throw insertError
      }

      onClose()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save fleet owner")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0f1729] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[calc(100vh-128px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111827]">
          <h2 className="text-lg font-bold text-white">
            {existing ? "Edit" : "Add New"} Fleet Owner
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-4">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => handleChange("company_name", e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              placeholder="e.g. Tigerhawk Co."
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              placeholder="Street address"
            />
          </div>

          {/* City / State / Zip / Country */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => handleChange("state", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                placeholder="TX"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Zip</label>
              <input
                type="text"
                value={form.zip_code}
                onChange={(e) => handleChange("zip_code", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => handleChange("country", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              />
            </div>
          </div>

          {/* Main Contact / Secondary Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Main Contact Name</label>
              <input
                type="text"
                value={form.main_contact_name}
                onChange={(e) => handleChange("main_contact_name", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Secondary Contact</label>
              <input
                type="text"
                value={form.secondary_contact_name}
                onChange={(e) => handleChange("secondary_contact_name", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              />
            </div>
          </div>

          {/* Mobile / Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Mobile</label>
              <input
                type="text"
                value={form.mobile}
                onChange={(e) => handleChange("mobile", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              />
            </div>
          </div>

          {/* Tax ID */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Tax ID</label>
            <input
              type="text"
              value={form.tax_id}
              onChange={(e) => handleChange("tax_id", e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
              placeholder="e.g. 33-1234567"
            />
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</div>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-[#111827]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-[#E8700A] hover:bg-[#FF8C21] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : existing ? <Pencil size={16} /> : <Plus size={16} />}
            {existing ? "Update" : "Create"} Fleet Owner
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────
export function FleetOwnersTable() {
  const [fleetOwners, setFleetOwners] = useState<FleetOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showEnabled, setShowEnabled] = useState(true)
  const [showDisabled, setShowDisabled] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingOwner, setEditingOwner] = useState<FleetOwner | null>(null)

  const supabase = createClient()

  const fetchFleetOwners = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("fleet_owners")
        .select("*")
        .order("company_name", { ascending: true })

      if (error) throw error
      setFleetOwners(data || [])
    } catch (err) {
      console.error("Failed to fetch fleet owners:", err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchFleetOwners()
  }, [fetchFleetOwners])

  // Counts
  const enabledCount = fleetOwners.filter((o) => o.enabled).length
  const disabledCount = fleetOwners.filter((o) => !o.enabled).length

  // Filter
  const filtered = useMemo(() => {
    return fleetOwners.filter((owner) => {
      const matchesSearch =
        !searchQuery ||
        owner.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (owner.main_contact_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (owner.email || "").toLowerCase().includes(searchQuery.toLowerCase())

      if (showEnabled && showDisabled) return matchesSearch
      if (showEnabled) return matchesSearch && owner.enabled
      if (showDisabled) return matchesSearch && !owner.enabled
      return matchesSearch
    })
  }, [fleetOwners, searchQuery, showEnabled, showDisabled])

  const fleetOwnerExportColumns: ExportColumn<FleetOwner>[] = [
    { header: "Company Name", accessor: (o) => o.company_name },
    { header: "Address", accessor: (o) => o.address },
    { header: "City", accessor: (o) => o.city },
    { header: "State", accessor: (o) => o.state },
    { header: "Country", accessor: (o) => o.country },
    { header: "Zip Code", accessor: (o) => o.zip_code },
    { header: "Main Contact", accessor: (o) => o.main_contact_name },
    { header: "Secondary Contact", accessor: (o) => o.secondary_contact_name },
    { header: "Mobile", accessor: (o) => o.mobile },
    { header: "Email", accessor: (o) => o.email },
    { header: "Tax ID", accessor: (o) => o.tax_id },
    { header: "Enabled", accessor: (o) => o.enabled ? "Yes" : "No" },
  ]

  const handleExportFleetOwners = () => {
    exportToCSV("fleet-owners", fleetOwnerExportColumns, filtered)
  }

  const handleEdit = (owner: FleetOwner) => {
    setEditingOwner(owner)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingOwner(null)
    setModalOpen(true)
  }

  const handleDelete = async (owner: FleetOwner) => {
    if (!confirm(`Delete "${owner.company_name}"? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from("fleet_owners").delete().eq("id", owner.id)
      if (error) throw error
      fetchFleetOwners()
    } catch (err) {
      console.error("Failed to delete fleet owner:", err)
    }
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
      {/* Title Row */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {fleetOwners.length} Fleet Owner{fleetOwners.length !== 1 ? "s" : ""}
        </h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-[#E8700A] hover:bg-[#FF8C21] text-white px-4 py-2 transition-colors font-medium text-sm"
        >
          <Plus size={16} />
          Add New Fleet Owner
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showEnabled}
            onChange={(e) => setShowEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#E8700A]"
          />
          <span className="text-sm text-gray-300">
            Enabled <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-xs text-gray-400">{enabledCount}</span>
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDisabled}
            onChange={(e) => setShowDisabled(e.target.checked)}
            className="w-4 h-4 accent-[#E8700A]"
          />
          <span className="text-sm text-gray-300">
            Disabled <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-xs text-gray-400">{disabledCount}</span>
          </span>
        </label>
        <ExportButton onClick={handleExportFleetOwners} count={filtered.length} />
      </div>

      {/* Table — matches PortPro columns */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Address</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">City</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">State</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Zip Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Main Contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Mobile</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tax ID</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                  No fleet owners found
                </td>
              </tr>
            ) : (
              filtered.map((owner) => (
                <tr
                  key={owner.id}
                  className="hover:bg-white/[0.03] transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                    {owner.company_name}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {owner.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {owner.city || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {owner.state || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {owner.zip_code || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                    {owner.main_contact_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {owner.mobile || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap truncate max-w-[200px]">
                    {owner.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {owner.tax_id || "—"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(owner)}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-[#E8700A]"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(owner)}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors text-gray-500 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <FleetOwnerModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingOwner(null)
        }}
        onSuccess={fetchFleetOwners}
        existing={editingOwner}
      />
    </div>
  )
}
