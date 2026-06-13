"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { LoadWithRelations, LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { LoadDetailPanel } from "./LoadDetailPanel"
import {
  Search,
  Link as LinkIcon,
  X,
  AlertTriangle,
  MapPin,
  Filter,
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { PhTerminalFilterOption } from "@/lib/terminals/phTerminalFilters"
import { loadMatchesPhTerminalFilter } from "@/lib/terminals/phTerminalFilters"

type LinkedPair = {
  import: LoadWithRelations
  export: LoadWithRelations
}

type Props = {
  phTerminalFilterOptions: PhTerminalFilterOption[]
  streetTurnsData: {
    imports: LoadWithRelations[]
    exports: LoadWithRelations[]
    linkedPairs: LinkedPair[]
    summary: {
      totalImports: number
      totalExports: number
      linkedCount: number
    }
  }
}

type ActiveTab = "available" | "linked"

// Get effective container size — check load field first, then containers join
function getContainerSize(load: LoadWithRelations): string {
  return load.container_size || load.containers?.size || ""
}

// Get effective shipping line — check load ssl first, then containers join
function getShippingLine(load: LoadWithRelations): string {
  return load.ssl || load.containers?.shipping_line || ""
}

// Format container size with feet mark
function formatSize(size: string): string {
  if (!size) return "—"
  return `${size}'`
}

// Build summary cards: group by SSL × container size showing import/export counts
type SSLSizeSummary = {
  ssl: string
  size: string
  importCount: number
  exportCount: number
}

function buildSSLSizeSummary(imports: LoadWithRelations[], exports: LoadWithRelations[]): SSLSizeSummary[] {
  const map = new Map<string, SSLSizeSummary>()

  const getKey = (ssl: string, size: string) => `${ssl}|||${size}`

  imports.forEach((load) => {
    const ssl = getShippingLine(load).toUpperCase()
    const size = getContainerSize(load)
    if (!ssl) return
    const key = getKey(ssl, size)
    const existing = map.get(key)
    if (existing) {
      existing.importCount++
    } else {
      map.set(key, { ssl, size, importCount: 1, exportCount: 0 })
    }
  })

  exports.forEach((load) => {
    const ssl = getShippingLine(load).toUpperCase()
    const size = getContainerSize(load)
    if (!ssl) return
    const key = getKey(ssl, size)
    const existing = map.get(key)
    if (existing) {
      existing.exportCount++
    } else {
      map.set(key, { ssl, size, importCount: 0, exportCount: 1 })
    }
  })

  // Sort by SSL name, then by size
  return Array.from(map.values()).sort((a, b) => {
    const sslCmp = a.ssl.localeCompare(b.ssl)
    if (sslCmp !== 0) return sslCmp
    return a.size.localeCompare(b.size)
  })
}

export function StreetTurnsView({ streetTurnsData, phTerminalFilterOptions }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ActiveTab>("available")
  const [selectedImport, setSelectedImport] = useState<LoadWithRelations | null>(null)
  const [selectedExport, setSelectedExport] = useState<LoadWithRelations | null>(null)
  const [detailLoad, setDetailLoad] = useState<LoadWithRelations | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [importSearch, setImportSearch] = useState("")
  const [exportSearch, setExportSearch] = useState("")
  const [linkedSearch, setLinkedSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState<string>("All")

  const barVisible = !!selectedImport || !!selectedExport
  const bothSelected = !!selectedImport && !!selectedExport

  const allLoads = useMemo(
    () => [
      ...streetTurnsData.imports,
      ...streetTurnsData.exports,
      ...streetTurnsData.linkedPairs.flatMap((p) => [p.import, p.export]),
    ],
    [streetTurnsData]
  )

  // SSL × Size summary cards
  const sslSizeSummary = useMemo(
    () => buildSSLSizeSummary(streetTurnsData.imports, streetTurnsData.exports),
    [streetTurnsData.imports, streetTurnsData.exports]
  )

  // Filter imports
  const filteredImports = useMemo(() => {
    return streetTurnsData.imports.filter((load) => {
      if (!loadMatchesPhTerminalFilter(load, locationFilter)) return false
      if (!importSearch) return true
      const searchLower = importSearch.toLowerCase()
      return (
        load.reference_number?.toLowerCase().includes(searchLower) ||
        load.containers?.container_number?.toLowerCase().includes(searchLower) ||
        load.delivery_location?.toLowerCase().includes(searchLower) ||
        load.ssl?.toLowerCase().includes(searchLower)
      )
    })
  }, [streetTurnsData.imports, importSearch, locationFilter])

  // Filter exports
  const filteredExports = useMemo(() => {
    return streetTurnsData.exports.filter((load) => {
      if (!loadMatchesPhTerminalFilter(load, locationFilter)) return false
      if (!exportSearch) return true
      const searchLower = exportSearch.toLowerCase()
      return (
        load.reference_number?.toLowerCase().includes(searchLower) ||
        load.containers?.container_number?.toLowerCase().includes(searchLower) ||
        load.pickup_location?.toLowerCase().includes(searchLower) ||
        load.ssl?.toLowerCase().includes(searchLower)
      )
    })
  }, [streetTurnsData.exports, exportSearch, locationFilter])

  // Filter linked pairs
  const filteredLinkedPairs = useMemo(() => {
    if (!linkedSearch) return streetTurnsData.linkedPairs
    const searchLower = linkedSearch.toLowerCase()
    return streetTurnsData.linkedPairs.filter((pair) => {
      return (
        pair.import.reference_number?.toLowerCase().includes(searchLower) ||
        pair.export.reference_number?.toLowerCase().includes(searchLower) ||
        pair.import.containers?.container_number?.toLowerCase().includes(searchLower) ||
        pair.export.containers?.container_number?.toLowerCase().includes(searchLower) ||
        getShippingLine(pair.import).toLowerCase().includes(searchLower) ||
        getShippingLine(pair.export).toLowerCase().includes(searchLower)
      )
    })
  }, [streetTurnsData.linkedPairs, linkedSearch])

  const getStatusColor = (status: string) => {
    const colors = LOAD_STATUS_COLORS[status as keyof typeof LOAD_STATUS_COLORS]
    return colors || { bg: "bg-gray-500/10", text: "text-gray-400", border: "border-gray-500/20" }
  }

  const isLFDOverdue = (lfdDate: string | null) => {
    if (!lfdDate) return false
    return new Date(lfdDate) < new Date()
  }

  const handleDismiss = () => {
    setSelectedImport(null)
    setSelectedExport(null)
    setLinkError(null)
  }

  const handleLinkStreetTurn = useCallback(async () => {
    if (!selectedImport || !selectedExport) return
    setLinkLoading(true)
    setLinkError(null)
    try {
      const res = await fetch("/api/dispatcher/street-turns/link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importLoadId: selectedImport.id,
          exportLoadId: selectedExport.id,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setLinkError(json.error || `Link failed (${res.status})`)
        return
      }
      setSelectedImport(null)
      setSelectedExport(null)
      router.refresh()
    } catch {
      setLinkError("Network error while linking")
    } finally {
      setLinkLoading(false)
    }
  }, [selectedImport, selectedExport, router])

  return (
    <div className="space-y-6">
      {/* ── Tabs: Available / Linked ── */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("available")}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            activeTab === "available"
              ? "bg-white text-[#0B1120] border-white"
              : "bg-transparent text-gray-400 border-white/10 hover:text-gray-300 hover:border-white/20"
          }`}
        >
          Available
        </button>
        <button
          onClick={() => setActiveTab("linked")}
          className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
            activeTab === "linked"
              ? "bg-white text-[#0B1120] border-white"
              : "bg-transparent text-gray-400 border-white/10 hover:text-gray-300 hover:border-white/20"
          }`}
        >
          Linked
        </button>
      </div>

      {/* ══════════════ AVAILABLE TAB ══════════════ */}
      {activeTab === "available" && (
        <>
          {/* ── Link Card (inline at the top, always visible when a load is selected) ── */}
          {barVisible && (
            <div className="bg-[#111827] border border-[#E8700A]/30 rounded-xl shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-[#E8700A]" />
                  <span className="text-sm font-semibold text-white">Link Street Turn</span>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Import slot */}
                <div className="flex-1 min-w-0">
                  {selectedImport ? (
                    <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium flex-shrink-0">
                        IMPORT
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {selectedImport.reference_number}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {selectedImport.containers?.container_number || "No container"} · {getShippingLine(selectedImport) || "No SSL"} · {formatSize(getContainerSize(selectedImport))}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedImport(null)}
                        className="p-0.5 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 border border-dashed border-white/10 rounded-lg text-center">
                      <p className="text-xs text-gray-500">Select an import</p>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0 text-gray-500 text-lg">&rarr;</div>

                {/* Export slot */}
                <div className="flex-1 min-w-0">
                  {selectedExport ? (
                    <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded font-medium flex-shrink-0">
                        EXPORT
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {selectedExport.reference_number}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {selectedExport.containers?.container_number || "No container"} · {getShippingLine(selectedExport) || "No SSL"} · {formatSize(getContainerSize(selectedExport))}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedExport(null)}
                        className="p-0.5 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 border border-dashed border-white/10 rounded-lg text-center">
                      <p className="text-xs text-gray-500">Select an export</p>
                    </div>
                  )}
                </div>

                {/* Link button */}
                <button
                  type="button"
                  onClick={handleLinkStreetTurn}
                  disabled={!bothSelected || linkLoading}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    bothSelected && !linkLoading
                      ? "bg-[#E8700A] hover:bg-[#FF8C21] text-white cursor-pointer"
                      : "bg-white/5 text-gray-500 cursor-not-allowed border border-white/5"
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  {linkLoading ? "Linking…" : "Link"}
                </button>
              </div>

              {linkError && (
                <div className="px-4 pb-2.5 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400/90">{linkError}</p>
                </div>
              )}

              <div className="px-4 pb-2.5 flex items-center gap-1.5">
                <p className="text-[10px] text-gray-500">
                  Pairs must be one Import and one Export with the same SSL and container size (server validates).
                </p>
              </div>
            </div>
          )}

          {/* ── SSL × Size Summary Cards ── */}
          {sslSizeSummary.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {sslSizeSummary.map((item) => (
                <div
                  key={`${item.ssl}-${item.size}`}
                  className="flex-shrink-0 bg-[#111827] border border-white/5 rounded-lg p-4 min-w-[200px]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-white">{item.ssl}</span>
                    <span className="text-xs text-gray-400">{formatSize(item.size)}</span>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-[#0B1120] rounded-md px-3 py-2 border border-white/5">
                      <div className="text-[10px] text-gray-500 mb-0.5">Import</div>
                      <div className="text-lg font-bold text-white">{item.importCount}</div>
                    </div>
                    <div className="flex-1 bg-[#0B1120] rounded-md px-3 py-2 border border-white/5">
                      <div className="text-[10px] text-gray-500 mb-0.5">Export</div>
                      <div className="text-lg font-bold text-white">{item.exportCount}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!barVisible && (
            <div className="flex items-start gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-lg">
              <p className="text-xs text-gray-400">
                Select an import and an export, then use <span className="text-gray-300 font-medium">Link</span> to
                set <span className="font-mono text-gray-500">street_turn_match_id</span> on both loads.
              </p>
            </div>
          )}

          {/* Location Filter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <MapPin className="w-4 h-4" />
              <span>Terminal:</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setLocationFilter("All")}
                title="All terminals"
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  locationFilter === "All"
                    ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                    : "bg-[#111827] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                }`}
              >
                All
              </button>
              {phTerminalFilterOptions.map((o) => (
                <button
                  type="button"
                  key={o.code}
                  title={o.label}
                  onClick={() => setLocationFilter(o.code)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    locationFilter === o.code
                      ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                      : "bg-[#111827] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                  }`}
                >
                  {o.pillLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Split Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Imports Section */}
            <div className="bg-[#111827] border border-white/5 rounded-lg overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-white">Imports</h3>
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                  {filteredImports.length}
                </span>
              </div>

              <div className="px-4 py-3 border-b border-white/5">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search imports..."
                      value={importSearch}
                      onChange={(e) => setImportSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#0B1120] border border-white/5 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#0B1120] border-b border-white/5">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Load #</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Container #</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">SSL</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Size</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Location</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">LFD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImports.map((load, idx) => {
                      const isSelected = selectedImport?.id === load.id
                      const lfdOverdue = isLFDOverdue(load.containers?.last_free_day || null)
                      const importStatusColor = getStatusColor(load.status)
                      return (
                        <tr
                          key={load.id}
                          onClick={() => setSelectedImport(load)}
                          className={`border-b border-white/5 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blue-500/20 border-l-2 border-l-blue-400 ring-1 ring-inset ring-blue-500/40"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDetailLoad(load)
                              }}
                              className="text-[#FF8C21] hover:text-[#E8700A] font-medium"
                            >
                              {load.reference_number}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${importStatusColor.bg} ${importStatusColor.text}`}>
                              {load.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{load.containers?.container_number || "—"}</td>
                          <td className="px-4 py-3 text-gray-400">{getShippingLine(load) || "—"}</td>
                          <td className="px-4 py-3 text-gray-400">{formatSize(getContainerSize(load))}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{load.delivery_location || "—"}</td>
                          <td className={`px-4 py-3 text-xs font-medium ${lfdOverdue ? "text-[#E8700A]" : "text-gray-400"}`}>
                            {load.containers?.last_free_day ? formatDate(load.containers.last_free_day) : "—"}
                          </td>
                        </tr>
                      )
                    })}
                    {filteredImports.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No imports found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exports Section */}
            <div className="bg-[#111827] border border-white/5 rounded-lg overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-white">Exports</h3>
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                  {filteredExports.length}
                </span>
              </div>

              <div className="px-4 py-3 border-b border-white/5">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="Search exports..."
                      value={exportSearch}
                      onChange={(e) => setExportSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#0B1120] border border-white/5 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#0B1120] border-b border-white/5">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Load #</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Container #</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">SSL</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Size</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-400">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExports.map((load, idx) => {
                      const statusColor = getStatusColor(load.status)
                      const isSelected = selectedExport?.id === load.id
                      return (
                        <tr
                          key={load.id}
                          onClick={() => setSelectedExport(load)}
                          className={`border-b border-white/5 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-green-500/20 border-l-2 border-l-green-400 ring-1 ring-inset ring-green-500/40"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDetailLoad(load)
                              }}
                              className="text-[#FF8C21] hover:text-[#E8700A] font-medium"
                            >
                              {load.reference_number}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                              {load.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{load.containers?.container_number || "—"}</td>
                          <td className="px-4 py-3 text-gray-400">{getShippingLine(load) || "—"}</td>
                          <td className="px-4 py-3 text-gray-400">{formatSize(getContainerSize(load))}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{load.pickup_location || "—"}</td>
                        </tr>
                      )
                    })}
                    {filteredExports.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No exports found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ LINKED TAB ══════════════ */}
      {activeTab === "linked" && (
        <>
          {/* Search */}
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search..."
                value={linkedSearch}
                onChange={(e) => setLinkedSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0B1120] border border-white/5 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
              />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-400">Filter</span>
            </div>
          </div>

          {/* Linked table */}
          <div className="bg-[#111827] border border-white/5 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0B1120] border-b border-white/5">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Load #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Load Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Warning</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Driver</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Event 1</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Container #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Reference #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Load Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Next Address</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Size</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Pick Up Apt From</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">LFD/ERD</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">ETA</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Delivery Apt From</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Cut Off</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Per Diem Free Day</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Shipment #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">Customer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400">SSL</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinkedPairs.length === 0 && (
                  <tr>
                    <td colSpan={20} className="px-4 py-8 text-center text-gray-500">No Result Found</td>
                  </tr>
                )}
                {filteredLinkedPairs.map((pair) => {
                  // Render two rows per pair — import then export
                  const loads = [pair.import, pair.export]
                  return loads.map((load) => {
                    const statusColor = getStatusColor(load.status)
                    const lfd = load.containers?.last_free_day || null
                    const lfdOverdue = isLFDOverdue(lfd)
                    return (
                      <tr
                        key={load.id}
                        onClick={() => setDetailLoad(load)}
                        className="border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetailLoad(load)
                            }}
                            className="text-[#FF8C21] hover:text-[#E8700A] font-medium"
                          >
                            {load.reference_number || "—"}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusColor.bg} ${statusColor.text}`}>
                            {load.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400">—</td>
                        <td className="px-4 py-2.5 text-gray-300">{load.drivers?.name || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{load.pickup_location || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300">{load.containers?.container_number || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300">{load.reference_number || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300">{load.load_type || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs truncate max-w-[120px]">{load.delivery_location || load.pickup_location || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300">{formatSize(getContainerSize(load))}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{load.pickup_apt_from ? formatDate(load.pickup_apt_from) : "—"}</td>
                        <td className={`px-4 py-2.5 text-xs font-medium ${lfdOverdue ? "text-orange-400 bg-orange-500/10" : "text-gray-400"}`}>
                          {lfd ? formatDate(lfd) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{load.vessel_eta ? formatDate(load.vessel_eta) : "—"}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{load.delivery_apt_from ? formatDate(load.delivery_apt_from) : "—"}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{load.outgate_date ? formatDate(load.outgate_date) : "—"}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{load.per_diem_free_day ? formatDate(load.per_diem_free_day) : "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300">{load.containers?.type || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300">{load.shipment_number || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300">{load.customers?.name || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-300">{getShippingLine(load) || "—"}</td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Load Detail Panel */}
      {detailLoad && (
        <LoadDetailPanel
          load={detailLoad}
          loads={allLoads}
          onClose={() => setDetailLoad(null)}
          onUpdate={(updated) => setDetailLoad(updated)}
          onNavigate={(load) => setDetailLoad(load)}
        />
      )}
    </div>
  )
}
