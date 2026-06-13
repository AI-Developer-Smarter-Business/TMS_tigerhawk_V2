"use client"

import { useState, useEffect } from "react"
import { LoadWithRelations, LoadAuditEntry } from "@/types/dispatcher"

type AuditTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

export function AuditTab({ load, onUpdate }: AuditTabProps) {
  const [auditEntries, setAuditEntries] = useState<LoadAuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterField, setFilterField] = useState("")

  useEffect(() => {
    fetchAudit()
  }, [load.id])

  const fetchAudit = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/audit`)
      if (response.ok) {
        const data = await response.json()
        const entries = Array.isArray(data) ? data : (data.data || data.entries || [])
        // Sort by most recent first
        setAuditEntries(
          entries.sort(
            (a: LoadAuditEntry, b: LoadAuditEntry) =>
              new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
          )
        )
      }
    } catch (error) {
      console.error("Failed to fetch audit:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-gray-400">Loading audit log...</div>
  }

  const filteredEntries = filterField
    ? auditEntries.filter((e) => e.field_changed.toLowerCase().includes(filterField.toLowerCase()))
    : auditEntries

  const uniqueFields = Array.from(new Set(auditEntries.map((e) => e.field_changed))).sort()

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0 self-center">
          Filter by Field:
        </label>
        <select
          value={filterField}
          onChange={(e) => setFilterField(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
        >
          <option value="">All Fields</option>
          {uniqueFields.map((field) => (
            <option key={field} value={field}>
              {field}
            </option>
          ))}
        </select>
      </div>

      {/* Audit Table */}
      <div className="overflow-x-auto bg-[#1F2937] rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-[#111827]">
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Field Changed</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Old Value</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">New Value</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Changed By</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date/Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-gray-500">
                  {auditEntries.length === 0 ? "No audit entries recorded yet." : "No matching audit entries found."}
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-gray-300">
                      {entry.field_changed}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-400 font-mono max-w-xs truncate" title={entry.old_value || ""}>
                      {entry.old_value ? (
                        <>
                          {entry.old_value.length > 50 ? (
                            <>
                              <span>{entry.old_value.substring(0, 50)}</span>
                              <span className="text-gray-600">...</span>
                            </>
                          ) : (
                            entry.old_value
                          )}
                        </>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-300 font-mono max-w-xs truncate" title={entry.new_value || ""}>
                      {entry.new_value ? (
                        <>
                          {entry.new_value.length > 50 ? (
                            <>
                              <span>{entry.new_value.substring(0, 50)}</span>
                              <span className="text-gray-600">...</span>
                            </>
                          ) : (
                            entry.new_value
                          )}
                        </>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {entry.user_name || "System"}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(entry.changed_at).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="bg-[#1F2937] rounded-lg p-4 border border-white/10">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500 font-medium">Total Changes</div>
            <div className="text-2xl font-bold text-[#FF8C21]">{auditEntries.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Fields Modified</div>
            <div className="text-2xl font-bold text-emerald-400">{uniqueFields.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Last Modified</div>
            <div className="text-sm text-gray-300">
              {auditEntries.length > 0 ? new Date(auditEntries[0].changed_at).toLocaleString() : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
