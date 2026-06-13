"use client"

import { useState, useEffect } from "react"
import { LoadWithRelations } from "@/types/dispatcher"

type RoutingTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

type RoutingEvent = {
  id: string
  type: "pickup" | "delivery" | "return"
  label: string
  location: string | null
  aptFrom: string | null
  aptTo: string | null
  status: string
}

export function RoutingTab({ load, onUpdate }: RoutingTabProps) {
  const [events, setEvents] = useState<RoutingEvent[]>([])

  useEffect(() => {
    setEvents([
      {
        id: "1",
        type: "pickup",
        label: "Pick Up Container",
        location: load.pickup_location,
        aptFrom: load.pickup_apt_from,
        aptTo: load.pickup_apt_to,
        status: "pending",
      },
      {
        id: "2",
        type: "delivery",
        label: "Deliver Container",
        location: load.delivery_location,
        aptFrom: load.delivery_apt_from,
        aptTo: load.delivery_apt_to,
        status: "pending",
      },
      {
        id: "3",
        type: "return",
        label: "Drop/Return Container",
        location: load.return_location,
        aptFrom: load.return_apt_from,
        aptTo: load.return_apt_to,
        status: "pending",
      },
    ])
  }, [load])

  const handleEventChange = (id: string, field: string, value: any) => {
    setEvents((prev) => {
      const updated = prev.map((event) =>
        event.id === id
          ? { ...event, [field]: value }
          : event
      )

      // Use the updated event (not stale state) to build load updates
      const event = updated.find((e) => e.id === id)
      if (event) {
        const updates: Record<string, unknown> = {}
        if (event.type === "pickup") {
          updates[field === "location" ? "pickup_location" : field === "aptFrom" ? "pickup_apt_from" : "pickup_apt_to"] = value
        } else if (event.type === "delivery") {
          updates[field === "location" ? "delivery_location" : field === "aptFrom" ? "delivery_apt_from" : "delivery_apt_to"] = value
        } else if (event.type === "return") {
          updates[field === "location" ? "return_location" : field === "aptFrom" ? "return_apt_from" : "return_apt_to"] = value
        }
        // Only send status field for non-status changes (status is local to this view)
        if (field !== "status") {
          onUpdate(updates)
        }
      }

      return updated
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      case "in-progress":
        return "bg-[#E8700A]/10 text-[#FF8C21] border-[#E8700A]/20"
      case "pending":
        return "bg-gray-500/10 text-gray-400 border-gray-500/20"
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20"
    }
  }

  return (
    <div className="space-y-6">
      {/* Event flow visualization */}
      <div className="relative">
        {events.map((event, idx) => (
          <div key={event.id}>
            {/* Event card */}
            <div className="bg-[#1F2937] rounded-lg p-4 mb-6 border border-white/10">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    event.type === "pickup"
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                      : event.type === "delivery"
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  }`}>
                    {event.type === "pickup" && <span>🔓</span>}
                    {event.type === "delivery" && <span>📦</span>}
                    {event.type === "return" && <span>🔄</span>}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-4">{event.label}</h4>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Location */}
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">Location</label>
                      <input
                        type="text"
                        value={event.location || ""}
                        onChange={(e) => handleEventChange(event.id, "location", e.target.value)}
                        placeholder="Enter location"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">Status</label>
                      <select
                        value={event.status}
                        onChange={(e) => handleEventChange(event.id, "status", e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    {/* Appointment From */}
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">Appointment From</label>
                      <input
                        type="datetime-local"
                        value={event.aptFrom || ""}
                        onChange={(e) => handleEventChange(event.id, "aptFrom", e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      />
                    </div>

                    {/* Appointment To */}
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">Appointment To</label>
                      <input
                        type="datetime-local"
                        value={event.aptTo || ""}
                        onChange={(e) => handleEventChange(event.id, "aptTo", e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
                      />
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="mt-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.status)}`}>
                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow connector (not shown after last event) */}
            {idx < events.length - 1 && (
              <div className="flex justify-center mb-6">
                <svg className="w-6 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary info */}
      <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
        <div className="bg-[#1F2937] rounded-lg p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Total Distance</div>
          <div className="text-2xl font-bold text-[#FF8C21]">{load.distance || "—"} mi</div>
        </div>
        <div className="bg-[#1F2937] rounded-lg p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Last Tracked</div>
          <div className="text-sm text-gray-300">{load.last_tracked ? new Date(load.last_tracked).toLocaleDateString() : "—"}</div>
        </div>
        <div className="bg-[#1F2937] rounded-lg p-4">
          <div className="text-xs text-gray-500 font-medium mb-1">Route Template</div>
          <div className="text-sm text-gray-300">{load.route_template || "—"}</div>
        </div>
      </div>
    </div>
  )
}
