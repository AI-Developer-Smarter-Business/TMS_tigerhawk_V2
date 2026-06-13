"use client"

import { useState, useMemo } from "react"
import { Filter, CheckCircle2 } from "lucide-react"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

interface WaitingTimeEvent {
  id: string
  event_name: string
  customer_id: string
  container_number?: string
  event_location?: string
  billing_charges_added?: boolean
  driver_pay_added?: boolean
  arrived_at: string
  departed_at?: string
  time_spent_minutes?: number
  report_attached?: boolean
  report_url?: string
  report_filename?: string
  loads?: { id: string; reference_number: string }
  customers?: { id: string; name: string }
  drivers?: { id: string; name: string }
}

interface Customer {
  id: string
  name: string
}

interface WaitingTimeAuditViewProps {
  initialEvents: WaitingTimeEvent[]
  initialCustomers: Customer[]
  error: string | null
}

const eventTypeColors: Record<string, { bg: string; text: string }> = {
  "Pick Up Container": { bg: "bg-blue-900/30", text: "text-blue-300" },
  "Deliver Container": { bg: "bg-green-900/30", text: "text-green-300" },
  "Return Container": { bg: "bg-orange-900/30", text: "text-orange-300" },
}

export function WaitingTimeAuditView({
  initialEvents,
  initialCustomers,
  error,
}: WaitingTimeAuditViewProps) {
  const [events, setEvents] = useState(initialEvents)
  const [customers] = useState(initialCustomers)
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [timeSpentFilter, setTimeSpentFilter] = useState("")
  const [reportFileInputs, setReportFileInputs] = useState<Record<string, string>>({})

  // Calculate event type counts
  const eventCounts = useMemo(() => {
    return {
      pickUp: events.filter((e) => e.event_name === "Pick Up Container").length,
      deliver: events.filter((e) => e.event_name === "Deliver Container").length,
      return: events.filter((e) => e.event_name === "Return Container").length,
    }
  }, [events])

  const calculateTimeSpent = (event: WaitingTimeEvent): number => {
    if (!event.arrived_at) return 0
    const arrived = new Date(event.arrived_at).getTime()
    const departed = event.departed_at
      ? new Date(event.departed_at).getTime()
      : Date.now()
    return Math.floor((departed - arrived) / (1000 * 60)) // minutes
  }

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Event type filter
      if (selectedEventTypes.length > 0 && !selectedEventTypes.includes(event.event_name)) {
        return false
      }

      // Customer filter
      if (selectedCustomerId && event.customer_id !== selectedCustomerId) {
        return false
      }

      // Time spent filter
      if (timeSpentFilter) {
        const timeSpent = calculateTimeSpent(event)
        if (timeSpentFilter === "0-2h" && timeSpent > 120) return false
        if (timeSpentFilter === "2-4h" && (timeSpent <= 120 || timeSpent > 240)) return false
        if (timeSpentFilter === "4-8h" && (timeSpent <= 240 || timeSpent > 480)) return false
        if (timeSpentFilter === "8h+" && timeSpent <= 480) return false
      }

      return true
    })
  }, [events, selectedEventTypes, selectedCustomerId, timeSpentFilter])

  const toggleEventType = (eventType: string) => {
    const newTypes = [...selectedEventTypes]
    const idx = newTypes.indexOf(eventType)
    if (idx >= 0) {
      newTypes.splice(idx, 1)
    } else {
      newTypes.push(eventType)
    }
    setSelectedEventTypes(newTypes)
  }

  const toggleBillingChargesAdded = (eventId: string) => {
    const updatedEvents = events.map((event) =>
      event.id === eventId
        ? { ...event, billing_charges_added: !event.billing_charges_added }
        : event
    )
    setEvents(updatedEvents)
  }

  const toggleDriverPayAdded = (eventId: string) => {
    const updatedEvents = events.map((event) =>
      event.id === eventId
        ? { ...event, driver_pay_added: !event.driver_pay_added }
        : event
    )
    setEvents(updatedEvents)
  }

  const handleAttachReport = (eventId: string) => {
    const fileInput = document.createElement("input")
    fileInput.type = "file"
    fileInput.accept = ".pdf,.doc,.docx,.txt,.jpg,.png"
    fileInput.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        setReportFileInputs((prev) => ({
          ...prev,
          [eventId]: file.name,
        }))
        const updatedEvents = events.map((event) =>
          event.id === eventId
            ? { ...event, report_attached: true, report_filename: file.name }
            : event
        )
        setEvents(updatedEvents)
      }
    }
    fileInput.click()
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg">
        Error loading waiting time audit data: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Audit</h1>

      {/* Filter Section */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-white">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Event Type Checkboxes */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Event Type
            </label>
            <div className="space-y-2">
              {[
                { name: "Pick Up Container", count: eventCounts.pickUp },
                { name: "Deliver Container", count: eventCounts.deliver },
                { name: "Return Container", count: eventCounts.return },
              ].map((type) => (
                <label key={type.name} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEventTypes.includes(type.name)}
                    onChange={() => toggleEventType(type.name)}
                    className="w-4 h-4 rounded bg-white/10 border border-white/20"
                  />
                  <span className="text-sm text-gray-300">
                    {type.name} ({type.count})
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Customer Filter - Not Functional Yet */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Customer
            </label>
            <SearchableSelect
              options={customers.map((c) => ({ id: c.id, name: c.name }))}
              value={selectedCustomerId}
              onChange={setSelectedCustomerId}
              placeholder="Select a customer..."
            />
          </div>

          {/* Time Spent Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">
              Time Spent
            </label>
            <select
              value={timeSpentFilter}
              onChange={(e) => setTimeSpentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] transition-colors"
            >
              <option value="">All Times</option>
              <option value="0-2h">0-2 Hours</option>
              <option value="2-4h">2-4 Hours</option>
              <option value="4-8h">4-8 Hours</option>
              <option value="8h+">8+ Hours</option>
            </select>
          </div>

          {/* Filter Button - Filters are reactive */}
          <div className="flex items-end">
            <button
              onClick={() => {
                // Filters are already applied through state changes
              }}
              className="w-full px-4 py-2 bg-[#E8700A] hover:bg-[#d45f08] text-white font-medium rounded-lg transition-colors"
            >
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Waiting Time Events Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Load #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Event Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Billing Charges
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Driver Pay
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Report
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Driver Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Container #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Event Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Arrived
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Time Spent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Departed
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                  No events found matching filters
                </td>
              </tr>
            ) : (
              filteredEvents.map((event) => {
                const timeSpent = calculateTimeSpent(event)
                const hours = Math.floor(timeSpent / 60)
                const minutes = timeSpent % 60

                return (
                  <tr
                    key={event.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium">
                      {event.loads?.reference_number || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          eventTypeColors[event.event_name]?.bg || "bg-gray-900/30"
                        } ${
                          eventTypeColors[event.event_name]?.text ||
                          "text-gray-300"
                        }`}
                      >
                        {event.event_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {event.customers?.name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {event.billing_charges_added ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-green-300 font-medium">Added</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleBillingChargesAdded(event.id)}
                          className="px-3 py-1 bg-[#E8700A] hover:bg-[#d4690a] text-white text-xs font-medium rounded transition-colors"
                        >
                          Add To Charge Set
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {event.driver_pay_added ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-green-300 font-medium">Added</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleDriverPayAdded(event.id)}
                          className="px-3 py-1 bg-[#E8700A] hover:bg-[#d4690a] text-white text-xs font-medium rounded transition-colors"
                        >
                          Add To Driver Pay
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {event.report_attached && event.report_filename ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-gray-300 truncate max-w-xs" title={event.report_filename}>
                            {event.report_filename}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAttachReport(event.id)}
                          className="px-3 py-1 bg-[#E8700A] hover:bg-[#d4690a] text-white text-xs font-medium rounded transition-colors"
                        >
                          Attach Report
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {event.drivers?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {event.container_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {event.event_location || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {event.arrived_at
                        ? new Date(event.arrived_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {hours}h {minutes}m
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {event.departed_at
                        ? new Date(event.departed_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
