'use client'

import React, { useState, useRef, useEffect } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight, Search, Check, X } from 'lucide-react'
import { LoadWithRelations } from '@/types/dispatcher'

// ─── Types ───────────────────────────────────────────────────────────

type DriverInfo = {
  id: string
  name: string
  phone: string | null
  status: string
  truck_number: string | null
}

type Props = {
  loads: LoadWithRelations[]
  drivers: DriverInfo[]
}

type DriverWithMoves = DriverInfo & {
  assignedLoads: LoadWithRelations[]
  location?: string
  lastActive?: string
  eta?: string
  size?: string
}

// ─── Helper Functions ────────────────────────────────────────────────

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const getContainerSize = (load: LoadWithRelations): string => {
  return load.container_size || load.containers?.size || '20'
}

const getContainerNumber = (load: LoadWithRelations): string => {
  return load.containers?.container_number || 'N/A'
}

// ─── Top Bar Component ──────────────────────────────────────────────

const TopBar: React.FC<{
  viewMode: 'driver' | 'truck'
  onViewModeChange: (mode: 'driver' | 'truck') => void
  selectedDate: Date
  onDateChange: (date: Date) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  assignedCount: number
  unassignedCount: number
}> = ({
  viewMode,
  onViewModeChange,
  selectedDate,
  onDateChange,
  searchQuery,
  onSearchChange,
  assignedCount,
  unassignedCount,
}) => {
  return (
    <div className="border-b border-white/5 bg-[#0B1120] px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-[#111827] rounded-lg p-1 border border-white/5">
          <button
            onClick={() => onViewModeChange('driver')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewMode === 'driver'
                ? 'bg-[#E8700A] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Driver
          </button>
          <button
            onClick={() => onViewModeChange('truck')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewMode === 'truck'
                ? 'bg-[#E8700A] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Truck
          </button>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 bg-[#111827] rounded-lg border border-white/5 px-3 py-2">
          <button
            onClick={() => onDateChange(subDays(selectedDate, 1))}
            className="p-1 hover:bg-white/5 rounded transition-colors"
          >
            <ChevronLeft size={16} className="text-gray-400" />
          </button>
          <span className="text-sm font-medium text-white min-w-[140px] text-center">
            As Of {format(selectedDate, 'MMM d, yyyy')}
          </span>
          <button
            onClick={() => onDateChange(addDays(selectedDate, 1))}
            className="p-1 hover:bg-white/5 rounded transition-colors"
          >
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex-1 flex items-center gap-2 bg-[#111827] rounded-lg border border-white/5 px-3 py-2">
          <Search size={16} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search drivers or loads..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
          />
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 px-3 py-2">
            <span className="text-sm text-emerald-400 font-medium">{assignedCount}</span>
            <span className="text-xs text-emerald-300">Assigned</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-500/10 rounded-lg border border-amber-500/20 px-3 py-2">
            <span className="text-sm text-amber-400 font-medium">{unassignedCount}</span>
            <span className="text-xs text-amber-300">Not Assigned</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Driver Card Component ──────────────────────────────────────────

const DriverCard: React.FC<{
  driver: DriverWithMoves
}> = ({ driver }) => {
  const assignedCount = driver.assignedLoads.length

  return (
    <div className="bg-[#111827] border border-white/5 rounded-lg p-3 space-y-3 min-w-[200px] flex-shrink-0">
      {/* Avatar & Basic Info */}
      <div className="flex items-start gap-2">
        <div className="w-10 h-10 rounded-full bg-[#E8700A]/20 border border-[#E8700A] flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#FF8C21]">{getInitials(driver.name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{driver.name}</h3>
          <p className="text-xs text-gray-400 truncate">
            {driver.location || 'Location TBD'}
          </p>
          <p className="text-xs text-gray-500">
            Last active: {driver.lastActive || '—'}
          </p>
        </div>
        {assignedCount > 0 && (
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#E8700A] flex items-center justify-center">
            <span className="text-xs font-bold text-white">{assignedCount}</span>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">ETA</span>
          <p className="text-gray-300 font-medium">{driver.eta || '—'}</p>
        </div>
        <div>
          <span className="text-gray-500">Truck #</span>
          <p className="text-gray-300 font-medium">{driver.truck_number || '—'}</p>
        </div>
        <div>
          <span className="text-gray-500">Chassis #</span>
          <p className="text-gray-300 font-medium">{'—'}</p>
        </div>
        <div>
          <span className="text-gray-500">Size</span>
          <p className="text-gray-300 font-medium">{driver.size || '—'}</p>
        </div>
      </div>

      {/* HOS Info */}
      <div className="border-t border-white/5 pt-2">
        <div className="grid grid-cols-4 gap-1 text-xs">
          <div>
            <span className="text-gray-500 block">Cycle</span>
            <p className="text-gray-300 font-medium">—</p>
          </div>
          <div>
            <span className="text-gray-500 block">Shift</span>
            <p className="text-gray-300 font-medium">—</p>
          </div>
          <div>
            <span className="text-gray-500 block">Drive</span>
            <p className="text-gray-300 font-medium">—</p>
          </div>
          <div>
            <span className="text-gray-500 block">Break</span>
            <p className="text-gray-300 font-medium">—</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="border-t border-white/5 pt-2">
        <span className="text-xs text-gray-500">Status</span>
        <p className="text-xs text-emerald-400 font-medium capitalize">
          {driver.status || 'Active'}
        </p>
      </div>
    </div>
  )
}

// ─── Load Card Component ────────────────────────────────────────────

const LoadCard: React.FC<{
  load: LoadWithRelations
  onAccept?: () => void
  onRemove?: () => void
  isAssigning?: boolean
}> = ({ load, onAccept, onRemove, isAssigning }) => {
  const containerSize = getContainerSize(load)
  const containerNumber = getContainerNumber(load)

  return (
    <div className="bg-[#0B1120] border border-white/10 rounded-lg p-3 space-y-2 min-w-[200px] flex-shrink-0">
      {/* Header with Reference */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-white truncate">
            Load #{load.reference_number}
          </h4>
          <p className="text-xs text-gray-400 truncate">{containerNumber}</p>
        </div>
        {onRemove && !onAccept && (
          <button
            onClick={onRemove}
            disabled={isAssigning}
            className="flex-shrink-0 p-1 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
            title="Remove from driver"
          >
            <X size={14} className="text-red-400" />
          </button>
        )}
      </div>

      {/* Container Info */}
      <div className="flex items-center justify-between text-xs bg-white/5 rounded px-2 py-1.5">
        <span className="text-gray-300">{containerSize}&apos; {load.container_type || 'ST'}</span>
        <span className="text-emerald-400 font-medium">Available</span>
      </div>

      {/* Steps */}
      <div className="space-y-1.5 text-xs">
        {/* Pick Up */}
        <div className="flex gap-1">
          <span className="text-gray-500 min-w-fit">Pick Up:</span>
          <span className="text-gray-300">
            {load.pickup_location || 'TBD'}
            {load.pickup_apt_from && (
              <span className="text-gray-500 ml-1">
                {format(new Date(load.pickup_apt_from), 'h:mm a')}
              </span>
            )}
          </span>
        </div>

        {/* Deliver */}
        <div className="flex gap-1">
          <span className="text-gray-500 min-w-fit">Deliver:</span>
          <span className="text-gray-300">
            {load.delivery_location || 'TBD'}
            {load.delivery_apt_from && (
              <span className="text-gray-500 ml-1">
                {format(new Date(load.delivery_apt_from), 'h:mm a')}
              </span>
            )}
          </span>
        </div>

        {/* Drop */}
        {load.return_location && (
          <div className="flex gap-1">
            <span className="text-gray-500 min-w-fit">Drop:</span>
            <span className="text-gray-300">
              {load.return_location}
              {load.return_apt_from && (
                <span className="text-gray-500 ml-1">
                  {format(new Date(load.return_apt_from), 'h:mm a')}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {onAccept && (
        <button
          onClick={onAccept}
          disabled={isAssigning}
          className="w-full mt-2 flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded py-2 text-xs font-medium text-emerald-400 transition-colors disabled:opacity-50"
        >
          <Check size={14} />
          Assign
        </button>
      )}
    </div>
  )
}

// ─── Available Loads Sidebar ────────────────────────────────────────

const AvailableLoadsSidebar: React.FC<{
  loads: LoadWithRelations[]
  onAssignLoad: (loadId: string, driverId: string) => Promise<void>
  selectedDriverId?: string
  searchQuery: string
}> = ({ loads, onAssignLoad, selectedDriverId, searchQuery }) => {
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState('all')
  const [sidebarSearch, setSidebarSearch] = useState('')

  const filteredLoads = loads.filter((load) => {
    const matchesSearch =
      load.reference_number
        .toLowerCase()
        .includes(sidebarSearch.toLowerCase()) ||
      load.pickup_location
        ?.toLowerCase()
        .includes(sidebarSearch.toLowerCase()) ||
      load.delivery_location?.toLowerCase().includes(sidebarSearch.toLowerCase())

    return matchesSearch
  })

  const stats = {
    containersAtPort: loads.filter(
      (l) => ['Available', 'Pending'].includes(l.status)
    ).length,
    deliveriesScheduled: loads.filter(
      (l) => l.delivery_apt_from
    ).length,
    containersToReturn: loads.filter(
      (l) => l.return_location
    ).length,
  }

  const handleAssign = async (loadId: string) => {
    if (!selectedDriverId) {
      alert('Please select a driver first')
      return
    }

    setAssigningId(loadId)
    try {
      await onAssignLoad(loadId, selectedDriverId)
    } catch (error) {
      console.error('Failed to assign load:', error)
      alert('Failed to assign load')
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <div className="w-80 bg-[#111827] border-l border-white/5 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-white/5 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Available Loads</h2>

        {/* Date Filter */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-full bg-[#0B1120] border border-white/5 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E8700A]/50"
        >
          <option value="all">All Days</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="week">This Week</option>
        </select>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-[#0B1120] rounded p-2 border border-white/5">
            <div className="text-gray-500">Containers</div>
            <div className="text-sm font-bold text-[#FF8C21]">
              {stats.containersAtPort}
            </div>
          </div>
          <div className="bg-[#0B1120] rounded p-2 border border-white/5">
            <div className="text-gray-500">Deliveries</div>
            <div className="text-sm font-bold text-[#FF8C21]">
              {stats.deliveriesScheduled}
            </div>
          </div>
          <div className="bg-[#0B1120] rounded p-2 border border-white/5">
            <div className="text-gray-500">Returns</div>
            <div className="text-sm font-bold text-[#FF8C21]">
              {stats.containersToReturn}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-[#0B1120] rounded border border-white/5 px-2 py-1.5">
          <Search size={14} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search loads..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none"
          />
        </div>
      </div>

      {/* Load List */}
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {filteredLoads.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <p className="text-sm">No loads available</p>
          </div>
        ) : (
          filteredLoads.map((load) => (
            <LoadCard
              key={load.id}
              load={load}
              onAccept={() => handleAssign(load.id)}
              isAssigning={assigningId === load.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Planner Component ─────────────────────────────────────────

export const PlannerTab: React.FC<Props> = ({ loads, drivers }) => {
  const [viewMode, setViewMode] = useState<'driver' | 'truck'>('driver')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Separate assigned and unassigned loads
  const assignedLoads = loads.filter((load) => load.driver_id)
  const unassignedLoads = loads.filter(
    (load) =>
      !load.driver_id &&
      ['Available', 'Pending', 'Freight Released'].includes(load.status)
  )

  // Group assigned loads by driver
  const driversWithMoves: DriverWithMoves[] = drivers.map((driver) => ({
    ...driver,
    assignedLoads: assignedLoads.filter((load) => load.driver_id === driver.id),
  }))

  // Filter by search query
  const filteredDrivers = driversWithMoves.filter(
    (driver) =>
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.truck_number?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAssignLoad = async (loadId: string, driverId: string) => {
    try {
      const response = await fetch(`/api/dispatcher/loads/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          status: 'Assigned',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to assign load')
      }

      // Trigger a refetch or state update here
      // For now, just show success
      console.log('Load assigned successfully')
    } catch (error) {
      console.error('Error assigning load:', error)
      throw error
    }
  }

  const handleRemoveLoad = async (loadId: string) => {
    try {
      const response = await fetch(`/api/dispatcher/loads/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: null,
          status: 'Available',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to remove load')
      }

      console.log('Load removed successfully')
    } catch (error) {
      console.error('Error removing load:', error)
    }
  }

  return (
    <div className="flex h-full bg-[#0B1120] overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          assignedCount={assignedLoads.length}
          unassignedCount={unassignedLoads.length}
        />

        {/* Planning Grid Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Drivers */}
          <div className="w-56 bg-[#0B1120] border-r border-white/5 overflow-y-auto">
            <div className="space-y-3 p-4">
              {filteredDrivers.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-500">
                  <p className="text-sm">No drivers found</p>
                </div>
              ) : (
                filteredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    onClick={() => setSelectedDriverId(driver.id)}
                    className={`cursor-pointer transition-all ${
                      selectedDriverId === driver.id
                        ? 'ring-2 ring-[#E8700A]'
                        : ''
                    }`}
                  >
                    <DriverCard driver={driver} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Move Columns Container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto overflow-y-hidden"
          >
            <div className="flex gap-4 p-4 min-w-fit">
              {[1, 2, 3, 4, 5].map((moveNum) => (
                <div
                  key={`move-${moveNum}`}
                  className="flex flex-col gap-2"
                >
                  {/* Move Header */}
                  <div className="h-14 flex items-center px-4 bg-[#111827] border border-white/5 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400">
                      Move {moveNum}
                    </h3>
                  </div>

                  {/* Move Column Content */}
                  <div className="space-y-3 min-w-[220px]">
                    {filteredDrivers.map((driver) => {
                      const loadForMove = driver.assignedLoads[moveNum - 1]

                      return (
                        <div
                          key={`${driver.id}-move-${moveNum}`}
                          className="h-80 bg-[#111827] border border-white/5 rounded-lg p-2 flex items-start justify-start"
                        >
                          {loadForMove ? (
                            <div
                              onClick={() => setSelectedDriverId(driver.id)}
                              className={`w-full cursor-pointer transition-all ${
                                selectedDriverId === driver.id
                                  ? 'ring-2 ring-[#E8700A]'
                                  : ''
                              }`}
                            >
                              <LoadCard
                                load={loadForMove}
                                onRemove={() =>
                                  handleRemoveLoad(loadForMove.id)
                                }
                              />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <p className="text-xs">No load assigned</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Available Loads */}
      <AvailableLoadsSidebar
        loads={unassignedLoads}
        onAssignLoad={handleAssignLoad}
        selectedDriverId={selectedDriverId ?? undefined}
        searchQuery={searchQuery}
      />
    </div>
  )
}

export default PlannerTab
