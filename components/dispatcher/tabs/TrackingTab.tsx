"use client"

import { useState, useEffect } from "react"
import { LoadWithRelations, LoadAuditEntry } from "@/types/dispatcher"

type TrackingTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

type StatusEvent = {
  timestamp: string
  status: string
  changedBy: string | null
}

export function TrackingTab({ load, onUpdate }: TrackingTabProps) {
  const [auditEntries, setAuditEntries] = useState<LoadAuditEntry[]>([])
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAudit()
  }, [load.id])

  const fetchAudit = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/audit`)
      if (response.ok) {
        const data = await response.json()
        const entries = Array.isArray(data) ? data : data.entries || []
        setAuditEntries(entries)

        // Filter for status changes
        const statuses = entries
          .filter((e: LoadAuditEntry) => e.field_changed === "status")
          .map((e: LoadAuditEntry) => ({
            timestamp: e.changed_at,
            status: e.new_value || "",
            changedBy: e.user_name,
          }))
          .sort((a: StatusEvent, b: StatusEvent) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

        setStatusEvents(statuses)
      }
    } catch (error) {
      console.error("Failed to fetch audit:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-gray-400">Loading tracking data...</div>
  }

  return (
    <div className="space-y-6">
      {/* Last Tracked Info */}
      <div className="bg-[#1F2937] rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-semibold text-white mb-4">Last Tracked</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Date & Time</div>
            <div className="text-sm text-gray-300">
              {load.last_tracked ? new Date(load.last_tracked).toLocaleString() : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Status</div>
            <div className="text-sm text-gray-300">{load.status || "—"}</div>
          </div>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-[#1F2937] rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-semibold text-white mb-4">Status Timeline</h4>
        {statusEvents.length === 0 ? (
          <div className="text-sm text-gray-500 py-4">No status transitions recorded yet.</div>
        ) : (
          <div className="space-y-4">
            {statusEvents.map((event, idx) => (
              <div key={idx} className="flex gap-4">
                {/* Timeline marker */}
                <div className="relative flex flex-col items-center">
                  <div className="w-4 h-4 rounded-full bg-[#E8700A] border-2 border-[#0F1724]" />
                  {idx < statusEvents.length - 1 && (
                    <div className="w-0.5 h-12 bg-gradient-to-b from-[#E8700A] to-white/10 mt-2" />
                  )}
                </div>

                {/* Event content */}
                <div className="pb-4 pt-0.5">
                  <div className="text-sm font-medium text-white">{event.status}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(event.timestamp).toLocaleString()}
                  </div>
                  {event.changedBy && (
                    <div className="text-xs text-gray-600 mt-1">By: {event.changedBy}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Load Journey Summary */}
      <div className="bg-[#1F2937] rounded-lg p-4 border border-white/10">
        <h4 className="text-sm font-semibold text-white mb-4">Journey Summary</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Created</div>
            <div className="text-sm text-gray-300">
              {load.created_at ? new Date(load.created_at).toLocaleDateString() : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Actual Pickup</div>
            <div className="text-sm text-gray-300">
              {load.actual_pickup ? new Date(load.actual_pickup).toLocaleString() : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Actual Delivery</div>
            <div className="text-sm text-gray-300">
              {load.actual_delivery ? new Date(load.actual_delivery).toLocaleString() : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Completed</div>
            <div className="text-sm text-gray-300">
              {load.completed_date ? new Date(load.completed_date).toLocaleString() : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Total Distance</div>
            <div className="text-sm text-gray-300">{load.distance ? `${load.distance} mi` : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">Current Status</div>
            <div className="text-sm text-gray-300">{load.status}</div>
          </div>
        </div>
      </div>

      {/* All Events Table */}
      <div className="overflow-x-auto">
        <h4 className="text-sm font-semibold text-white mb-3">All Tracked Events</h4>
        <div className="bg-[#1F2937] rounded-lg overflow-hidden border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-[#111827]">
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Timestamp</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Event Type</th>
                <th className="text-left py-3 px-4 text-gray-400 font-semibold">Changed By</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 px-4 text-center text-gray-500">
                    No tracking events recorded yet.
                  </td>
                </tr>
              ) : (
                auditEntries
                  .sort((a: LoadAuditEntry, b: LoadAuditEntry) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                  .map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 px-4 text-gray-300 text-xs">
                        {new Date(entry.changed_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{entry.field_changed}</span>
                          {entry.old_value && entry.new_value && (
                            <span className="text-xs text-gray-600">
                              {entry.old_value} → {entry.new_value}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {entry.user_name || "System"}
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
