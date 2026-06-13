"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { LoadWithRelations, LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { ChevronLeft, ChevronRight, Calendar, Search } from "lucide-react"

type DriverWithCurrentLoad = {
  id: string
  name: string
  phone: string | null
  status: string
  loads: LoadWithRelations[]
}

type Props = {
  drivers: DriverWithCurrentLoad[]
  todaysLoads: LoadWithRelations[]
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getColorForInitials(name: string): string {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-rose-500",
  ]
  const hashCode = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hashCode % colors.length]
}

export function DriverItineraryView({ drivers, todaysLoads }: Props) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(
    drivers.length > 0 ? drivers[0].id : null
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  })

  // Get driver's loads from server data (using todaysLoads)
  const selectedDriver = drivers.find((d) => d.id === selectedDriverId)

  const driverLoadEvents = useMemo(() => {
    if (!selectedDriver) return []

    return selectedDriver.loads
      .filter((load) => {
        const loadDate = load.scheduled_pickup
          ? new Date(load.scheduled_pickup).toISOString().split("T")[0]
          : null
        return loadDate && loadDate >= dateRange.from && loadDate <= dateRange.to
      })
      .flatMap((load) => {
        const events: Array<{
          load: LoadWithRelations
          event_type: "Hook Container" | "Pick Up Container" | "Deliver Container" | "Drop Container" | "Return Container"
          status: string
          order: number
        }> = []

        // Pickup event
        if (load.pickup_location) {
          events.push({
            load,
            event_type: "Pick Up Container",
            status: load.status,
            order: 1,
          })
        }

        // Delivery event
        if (load.delivery_location) {
          events.push({
            load,
            event_type: "Deliver Container",
            status: load.status,
            order: 2,
          })
        }

        // Return/Drop event
        if (load.return_location || load.delivery_location) {
          const eventType = load.is_street_turn ? "Drop Container" : "Return Container"
          events.push({
            load,
            event_type: eventType,
            status: load.status,
            order: 3,
          })
        }

        return events
      })
  }, [selectedDriver, dateRange])

  // Filter drivers by search
  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const searchLower = searchQuery.toLowerCase()
      return (
        driver.name.toLowerCase().includes(searchLower) ||
        (driver.phone && driver.phone.includes(searchQuery))
      )
    })
  }, [drivers, searchQuery])

  // Get the current date for display
  const today = new Date()
  const currentDateStr = today.toISOString().split("T")[0]

  const handlePrevDay = () => {
    const prev = new Date(dateRange.from)
    prev.setDate(prev.getDate() - 1)
    const prevStr = prev.toISOString().split("T")[0]
    setDateRange({ from: prevStr, to: prevStr })
  }

  const handleNextDay = () => {
    const next = new Date(dateRange.from)
    next.setDate(next.getDate() + 1)
    const nextStr = next.toISOString().split("T")[0]
    setDateRange({ from: nextStr, to: nextStr })
  }

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case "Hook Container":
        return "🪝"
      case "Pick Up Container":
        return "📦"
      case "Deliver Container":
        return "🚚"
      case "Drop Container":
        return "📍"
      case "Return Container":
        return "↩️"
      default:
        return "📄"
    }
  }

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case "Hook Container":
        return "bg-slate-500/10 text-slate-400"
      case "Pick Up Container":
        return "bg-emerald-500/10 text-emerald-400"
      case "Deliver Container":
        return "bg-blue-500/10 text-blue-400"
      case "Drop Container":
        return "bg-gray-500/10 text-gray-400"
      case "Return Container":
        return "bg-purple-500/10 text-purple-400"
      default:
        return "bg-gray-500/10 text-gray-400"
    }
  }

  return (
    <div className="flex h-full bg-[#0B1120] text-white">
      {/* Left Panel - Drivers List */}
      <div className="w-[350px] border-r border-white/5 bg-[#111827] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/5 space-y-4">
          {/* Date Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Date Range
            </label>
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
              <button
                onClick={handlePrevDay}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm flex-1 text-center">
                {new Date(dateRange.from).toLocaleDateString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "2-digit",
                })}
              </span>
              <button
                onClick={handleNextDay}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button className="p-1 hover:bg-white/10 rounded transition-colors" title="Open calendar">
                <Calendar className="w-4 h-4" /><span className="text-red-500 text-xs" title="Feature not yet implemented">*</span>
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search drivers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#E8700A] focus:bg-white/10 transition-colors"
            />
          </div>
        </div>

        {/* Drivers List */}
        <div className="flex-1 overflow-y-auto">
          {filteredDrivers.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No drivers found
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredDrivers.map((driver) => {
                const isSelected = driver.id === selectedDriverId
                const activeLoads = driver.loads.filter((load) => {
                  const loadDate = load.scheduled_pickup
                    ? new Date(load.scheduled_pickup).toISOString().split("T")[0]
                    : null
                  return loadDate === dateRange.from
                })

                return (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={`p-3 cursor-pointer transition-colors border-l-2 ${
                      isSelected
                        ? "bg-white/5 border-l-[#E8700A]"
                        : "bg-transparent border-l-transparent hover:bg-white/2.5"
                    }`}
                  >
                    {/* Driver Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${getColorForInitials(driver.name)}`}
                      >
                        {getInitials(driver.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-white truncate">
                          {driver.name}
                        </p>
                        {driver.phone && (
                          <p className="text-xs text-gray-500">{driver.phone}</p>
                        )}
                      </div>
                    </div>

                    {/* Loads */}
                    <div className="space-y-2 pl-11">
                      {activeLoads.length === 0 ? (
                        <p className="text-xs italic text-gray-500">
                          No assigned loads
                        </p>
                      ) : (
                        <>
                          {activeLoads.slice(0, 1).map((load) => (
                            <div
                              key={load.id}
                              className="text-xs space-y-1"
                            >
                              <p className="text-gray-400">
                                {load.pickup_location || "TBD"}
                              </p>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                    LOAD_STATUS_COLORS[load.status]?.text ||
                                    "text-gray-400"
                                  }`}
                                >
                                  {load.status === "Completed"
                                    ? "✓"
                                    : load.status}
                                </span>
                                <Link
                                  href={`/dashboard/dispatcher/${load.id}`}
                                  className="text-blue-400 hover:text-blue-300 font-medium"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {load.reference_number}
                                </Link>
                              </div>
                            </div>
                          ))}
                          {activeLoads.length > 1 && (
                            <button className="text-xs text-[#E8700A] hover:text-[#FF8C21] font-medium">
                              +{activeLoads.length - 1} More Load{activeLoads.length - 1 > 1 ? "s" : ""}<span className="text-red-500 ml-0.5 text-xs" title="Feature not yet implemented">*</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Events Table */}
      <div className="flex-1 flex flex-col bg-[#0B1120]">
        {/* Table Header */}
        <div className="border-b border-white/5 bg-[#111827] sticky top-0 z-10">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Load #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Container #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Chassis #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Load Assigned Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Address
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto">
          {driverLoadEvents.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {selectedDriver
                ? "No loads assigned to this driver for the selected date"
                : "Select a driver to view their loads"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody className="divide-y divide-white/5">
                  {driverLoadEvents.map((event, idx) => {
                    const statusColor = LOAD_STATUS_COLORS[event.load.status]
                    const createdDate = event.load.created_at
                      ? new Date(event.load.created_at).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "2-digit" }
                        )
                      : "—"

                    return (
                      <tr
                        key={`${event.load.id}-${idx}`}
                        className="hover:bg-white/2.5 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm">
                          <Link
                            href={`/dashboard/dispatcher/${event.load.id}`}
                            className="text-blue-400 hover:text-blue-300 font-medium"
                          >
                            {event.load.reference_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {event.load.containers?.container_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {event.load.chassis_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {getEventTypeIcon(event.event_type)}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getEventTypeColor(event.event_type)}`}>
                              {event.event_type}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {event.load.status === "Completed" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                              </svg>
                              Finished
                            </span>
                          ) : (
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
                            >
                              {event.load.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {createdDate}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {event.load.customers?.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {event.event_type === "Pick Up Container"
                            ? event.load.pickup_location
                            : event.event_type === "Deliver Container"
                              ? event.load.delivery_location
                              : event.load.return_location || event.load.delivery_location}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
