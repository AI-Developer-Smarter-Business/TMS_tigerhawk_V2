"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { LoadWithRelations, LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { LoadDetailPanel } from "./LoadDetailPanel"
import { rowToDualPairSlice } from "@/lib/dual-transaction-load-adapter"
import {
  DUAL_EMPTY_SAVED_COST_PER_MILE_USD,
  dualPairCompatible,
  pairEmptyMilesSaved,
  potentialSavingsUsdGreedy,
  sumPairSavingsUsd,
  type LocationCoordMap,
} from "@/lib/dual-transaction-savings"
import {
  Search,
  Filter,
  Link as LinkIcon,
  X,
  MapPin,
  Box,
  Anchor,
  Sparkles,
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
  dualTransactionsData: {
    importReturns: LoadWithRelations[]
    exportPickups: LoadWithRelations[]
    potentialMatches: Array<{
      import: LoadWithRelations
      export: LoadWithRelations
      estimatedSavings: number
      estimatedSavedMiles: number
    }>
    linkedPairs: LinkedPair[]
    summary: {
      importReturnsCount: number
      exportPickupsCount: number
      potentialMatchesCount: number
      linkedCount: number
    }
  }
}

type ActiveTab = "available" | "linked"

type RecommendedDualPair = { returnId: string; pickupId: string }

// Get effective container size — check load field first, then containers join
function getContainerSize(load: LoadWithRelations): string {
  return load.container_size || load.containers?.size || ""
}

// Get effective shipping line — check load ssl first, then containers join
function getShippingLine(load: LoadWithRelations): string {
  return load.ssl || load.containers?.shipping_line || ""
}

// Check if a load matches a container size filter
function matchesSize(load: LoadWithRelations, filter: string): boolean {
  if (filter === "All") return true
  const size = getContainerSize(load)
  return size === filter
}

// Format container size with feet mark
function formatSize(size: string): string {
  if (!size) return "—"
  return `${size}'`
}

// Check if a load matches a shipping line filter
function matchesSSL(load: LoadWithRelations, filter: string): boolean {
  if (filter === "All") return true
  const ssl = getShippingLine(load)
  return ssl.toUpperCase() === filter.toUpperCase()
}

export function DualTransactionsView({ dualTransactionsData, phTerminalFilterOptions }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ActiveTab>("available")
  const [selectedReturn, setSelectedReturn] = useState<LoadWithRelations | null>(null)
  const [selectedPickup, setSelectedPickup] = useState<LoadWithRelations | null>(null)
  const [detailLoad, setDetailLoad] = useState<LoadWithRelations | null>(null)
  const [returnSearch, setReturnSearch] = useState("")
  const [pickupSearch, setPickupSearch] = useState("")
  const [linkedSearch, setLinkedSearch] = useState("")
  const [locationCoordMap, setLocationCoordMap] = useState<LocationCoordMap>({})
  const [recommendedPairs, setRecommendedPairs] = useState<RecommendedDualPair[]>([])
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  // Returns filters
  const [returnSSL, setReturnSSL] = useState("All")
  const [returnSize, setReturnSize] = useState("All")

  // Pickups filters
  /** "All" or vessel / PH terminal code (e.g. BCT, BAY) */
  const [pickupTerminal, setPickupTerminal] = useState<string>("All")
  const [pickupSize, setPickupSize] = useState("All")

  const barVisible = !!selectedReturn || !!selectedPickup
  const bothSelected = !!selectedReturn && !!selectedPickup

  const allLoads = useMemo(
    () => [
      ...dualTransactionsData.importReturns,
      ...dualTransactionsData.exportPickups,
    ],
    [dualTransactionsData]
  )

  // Extract unique SSLs from returns for the filter buttons
  const returnSSLOptions = useMemo(() => {
    const sslSet = new Set<string>()
    dualTransactionsData.importReturns.forEach((load) => {
      const ssl = getShippingLine(load)
      if (ssl) sslSet.add(ssl.toUpperCase())
    })
    return Array.from(sslSet).sort()
  }, [dualTransactionsData.importReturns])

  // Extract unique sizes from returns for the filter buttons
  const returnSizeOptions = useMemo(() => {
    const sizeSet = new Set<string>()
    dualTransactionsData.importReturns.forEach((load) => {
      const size = getContainerSize(load)
      if (size) sizeSet.add(size)
    })
    return Array.from(sizeSet).sort()
  }, [dualTransactionsData.importReturns])

  // Extract unique sizes from pickups for the filter buttons
  const pickupSizeOptions = useMemo(() => {
    const sizeSet = new Set<string>()
    dualTransactionsData.exportPickups.forEach((load) => {
      const size = getContainerSize(load)
      if (size) sizeSet.add(size)
    })
    return Array.from(sizeSet).sort()
  }, [dualTransactionsData.exportPickups])

  // Filter returns — text search + SSL + size
  const filteredReturns = useMemo(() => {
    return dualTransactionsData.importReturns.filter((load) => {
      if (!matchesSSL(load, returnSSL)) return false
      if (!matchesSize(load, returnSize)) return false

      if (!returnSearch) return true
      const searchLower = returnSearch.toLowerCase()
      return (
        load.reference_number?.toLowerCase().includes(searchLower) ||
        load.containers?.container_number?.toLowerCase().includes(searchLower) ||
        load.delivery_location?.toLowerCase().includes(searchLower) ||
        getShippingLine(load).toLowerCase().includes(searchLower)
      )
    })
  }, [
    dualTransactionsData.importReturns,
    returnSearch,
    returnSSL,
    returnSize,
  ])

  // Filter pickups — text search + terminal + container size
  const filteredPickups = useMemo(() => {
    return dualTransactionsData.exportPickups.filter((load) => {
      if (!loadMatchesPhTerminalFilter(load, pickupTerminal)) return false
      if (!matchesSize(load, pickupSize)) return false

      if (!pickupSearch) return true
      const searchLower = pickupSearch.toLowerCase()
      return (
        load.reference_number?.toLowerCase().includes(searchLower) ||
        load.containers?.container_number?.toLowerCase().includes(searchLower) ||
        load.pickup_location?.toLowerCase().includes(searchLower) ||
        getShippingLine(load).toLowerCase().includes(searchLower)
      )
    })
  }, [
    dualTransactionsData.exportPickups,
    pickupSearch,
    pickupTerminal,
    pickupSize,
  ])

  useEffect(() => {
    const unique = new Set<string>()
    for (const l of filteredReturns) {
      if (l.delivery_location?.trim()) unique.add(l.delivery_location.trim())
      if (l.return_location?.trim()) unique.add(l.return_location.trim())
    }
    for (const l of filteredPickups) {
      if (l.pickup_location?.trim()) unique.add(l.pickup_location.trim())
      if (l.delivery_location?.trim()) unique.add(l.delivery_location.trim())
      if (l.return_location?.trim()) unique.add(l.return_location.trim())
    }
    const addresses = [...unique]
    if (addresses.length === 0) {
      setLocationCoordMap({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/dispatcher/dual-transactions/resolve-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ addresses }),
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { coords?: LocationCoordMap }
        if (!cancelled && data.coords) setLocationCoordMap(data.coords)
      } catch {
        if (!cancelled) setLocationCoordMap({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filteredReturns, filteredPickups])

  useEffect(() => {
    setRecommendedPairs([])
  }, [returnSearch, pickupSearch, returnSSL, returnSize, pickupTerminal, pickupSize])

  const handleRecommendDuals = useCallback(() => {
    const scored: { returnId: string; pickupId: string; usd: number }[] = []
    for (const returnLoad of filteredReturns) {
      for (const pickupLoad of filteredPickups) {
        const r = rowToDualPairSlice(returnLoad)
        const p = rowToDualPairSlice(pickupLoad)
        if (!dualPairCompatible(r, p)) continue
        const { savingsUsd } = pairEmptyMilesSaved(r, p, locationCoordMap)
        scored.push({ returnId: returnLoad.id, pickupId: pickupLoad.id, usd: savingsUsd })
      }
    }
    scored.sort((a, b) => b.usd - a.usd)
    setRecommendedPairs(scored.map(({ returnId, pickupId }) => ({ returnId, pickupId })))
  }, [filteredReturns, filteredPickups, locationCoordMap])

  const recommendedSavingsUsd = useMemo(() => {
    const pairs = recommendedPairs
      .map(({ returnId, pickupId }) => {
        const returnLoad = filteredReturns.find((l) => l.id === returnId)
        const pickupLoad = filteredPickups.find((l) => l.id === pickupId)
        if (!returnLoad || !pickupLoad) return null
        return {
          returnLoad: rowToDualPairSlice(returnLoad),
          pickupLoad: rowToDualPairSlice(pickupLoad),
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
    return sumPairSavingsUsd(pairs, locationCoordMap).totalUsd
  }, [recommendedPairs, filteredReturns, filteredPickups, locationCoordMap])

  const potentialSavingsUsd = useMemo(() => {
    return potentialSavingsUsdGreedy(
      filteredReturns.map(rowToDualPairSlice),
      filteredPickups.map(rowToDualPairSlice),
      locationCoordMap
    ).totalUsd
  }, [filteredReturns, filteredPickups, locationCoordMap])

  const recommendedPickupForReturn = useCallback(
    (returnId: string) => recommendedPairs.find((p) => p.returnId === returnId)?.pickupId,
    [recommendedPairs]
  )

  const recommendedReturnForPickup = useCallback(
    (pickupId: string) => recommendedPairs.find((p) => p.pickupId === pickupId)?.returnId,
    [recommendedPairs]
  )

  const handleLinkDual = useCallback(async () => {
    if (!selectedReturn || !selectedPickup) return
    setLinkLoading(true)
    setLinkError(null)
    try {
      const res = await fetch("/api/dispatcher/dual-transactions/match", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importLoadId: selectedReturn.id,
          exportLoadId: selectedPickup.id,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setLinkError(json.error || `Link failed (${res.status})`)
        return
      }
      setSelectedReturn(null)
      setSelectedPickup(null)
      setRecommendedPairs([])
      router.refresh()
    } catch {
      setLinkError("Network error while linking")
    } finally {
      setLinkLoading(false)
    }
  }, [selectedReturn, selectedPickup, router])

  // Filter linked pairs by search
  const filteredLinkedPairs = useMemo(() => {
    if (!linkedSearch) return dualTransactionsData.linkedPairs
    const searchLower = linkedSearch.toLowerCase()
    return dualTransactionsData.linkedPairs.filter((pair) => {
      const loads = [pair.import, pair.export]
      return loads.some((load) =>
        load.reference_number?.toLowerCase().includes(searchLower) ||
        load.containers?.container_number?.toLowerCase().includes(searchLower) ||
        load.customers?.name?.toLowerCase().includes(searchLower) ||
        load.drivers?.name?.toLowerCase().includes(searchLower) ||
        getShippingLine(load).toLowerCase().includes(searchLower)
      )
    })
  }, [dualTransactionsData.linkedPairs, linkedSearch])

  const getStatusColor = (status: string) => {
    const colors =
      LOAD_STATUS_COLORS[status as keyof typeof LOAD_STATUS_COLORS]
    return (
      colors || {
        bg: "bg-gray-500/10",
        text: "text-gray-400",
        border: "border-gray-500/20",
      }
    )
  }

  const isLFDOverdue = (lfdDate: string | null) => {
    if (!lfdDate) return false
    return new Date(lfdDate) < new Date()
  }

  const handleDismiss = () => {
    setSelectedReturn(null)
    setSelectedPickup(null)
    setLinkError(null)
  }

  return (
    <div className="space-y-6">
      {/* Savings + Recommend (T23); resolve-locations runs when filtered lists change */}
      <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#111827] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase text-gray-500">Est. Savings</p>
            <p className="text-sm font-bold text-emerald-400">
              $
              {recommendedSavingsUsd.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="max-w-[220px] text-[9px] leading-tight text-gray-600">
              Haversine distance; ${DUAL_EMPTY_SAVED_COST_PER_MILE_USD.toFixed(2)}/mi empty (after{" "}
              <span className="text-gray-500">Recommend Duals</span>)
            </p>
          </div>
          <div className="hidden h-8 w-px bg-white/10 sm:block" />
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase text-gray-500">Potential</p>
            <p className="text-sm font-bold text-gray-300">
              $
              {potentialSavingsUsd.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </p>
            <p className="max-w-[180px] text-[9px] text-gray-600">Upper bound (best pickup per return)</p>
          </div>
          {recommendedPairs.length > 0 && (
            <>
              <div className="hidden h-8 w-px bg-white/10 sm:block" />
              <div className="text-right">
                <p className="text-[10px] font-medium uppercase text-gray-500">Ranked pairs</p>
                <p className="text-sm font-bold text-white">{recommendedPairs.length}</p>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleRecommendDuals}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8700A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#D95F00]"
        >
          <Sparkles className="h-4 w-4" />
          Recommend Duals
        </button>
      </div>

      {/* ── Tab Switcher ── */}
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
      {/* ── Link Card ── */}
      {barVisible && (
        <div className="bg-[#111827] border border-[#E8700A]/30 rounded-xl shadow-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-[#E8700A]" />
              <span className="text-sm font-semibold text-white">Link Dual Transaction</span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            {/* Return slot */}
            <div className="flex-1 min-w-0">
              {selectedReturn ? (
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-medium flex-shrink-0">
                    RETURN
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {selectedReturn.reference_number}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {selectedReturn.containers?.container_number || "No container"} · {getShippingLine(selectedReturn) || "No SSL"} · {getContainerSize(selectedReturn) ? `${getContainerSize(selectedReturn)}'` : "No size"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReturn(null)}
                    className="p-0.5 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-2 border border-dashed border-white/10 rounded-lg text-center">
                  <p className="text-xs text-gray-500">Select a return</p>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 text-gray-500 text-lg">&rarr;</div>

            {/* Pickup slot */}
            <div className="flex-1 min-w-0">
              {selectedPickup ? (
                <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded font-medium flex-shrink-0">
                    PICK UP
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {selectedPickup.reference_number}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {selectedPickup.containers?.container_number || "No container"} · {getShippingLine(selectedPickup) || "No SSL"} · {getContainerSize(selectedPickup) ? `${getContainerSize(selectedPickup)}'` : "No size"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPickup(null)}
                    className="p-0.5 hover:bg-white/10 rounded transition-colors text-gray-400 hover:text-white flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="p-2 border border-dashed border-white/10 rounded-lg text-center">
                  <p className="text-xs text-gray-500">Select a pick up</p>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!bothSelected || linkLoading}
              onClick={() => void handleLinkDual()}
              className={`flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                bothSelected && !linkLoading
                  ? "cursor-pointer bg-[#E8700A] text-white hover:bg-[#FF8C21]"
                  : "cursor-not-allowed border border-white/5 bg-white/5 text-gray-500"
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {linkLoading ? "Linking…" : "Link"}
            </button>
          </div>

          {linkError ? (
            <div className="px-4 pb-2.5 text-xs text-red-400">{linkError}</div>
          ) : (
            <div className="px-4 pb-2.5 text-[10px] text-gray-500">
              Pairs must share SSL and container size category; import{" "}
              <span className="text-gray-400">return location</span> must match export{" "}
              <span className="text-gray-400">pickup location</span>. API updates{" "}
              <span className="font-mono text-gray-400">street_turn_match_id</span> on both loads.
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111827] border border-white/5 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Returns</div>
          <div className="text-2xl font-bold text-white mt-1">
            {dualTransactionsData.summary.importReturnsCount}
          </div>
        </div>
        <div className="bg-[#111827] border border-white/5 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Pick Ups</div>
          <div className="text-2xl font-bold text-white mt-1">
            {dualTransactionsData.summary.exportPickupsCount}
          </div>
        </div>
        <div className="bg-[#111827] border border-white/5 rounded-lg p-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide">Potential Matches</div>
          <div className="text-2xl font-bold text-white mt-1">
            {dualTransactionsData.summary.potentialMatchesCount}
          </div>
        </div>
      </div>

      {!barVisible && (
        <p className="text-xs text-gray-500">
          Select a return and a pick up, or use <span className="text-gray-400">Recommend Duals</span> and
          follow the highlighted rows.
        </p>
      )}

      {/* Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Returns Section ── */}
        <div className="bg-[#111827] border border-white/5 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-semibold text-white">Returns</h3>
            <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
              {filteredReturns.length}
            </span>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search returns..."
                value={returnSearch}
                onChange={(e) => setReturnSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0B1120] border border-white/5 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
              />
            </div>
          </div>

          {/* Shipping Line Filter */}
          {returnSSLOptions.length > 0 && (
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
              <Anchor className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setReturnSSL("All")}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    returnSSL === "All"
                      ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                      : "bg-[#0B1120] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                  }`}
                >
                  All
                </button>
                {returnSSLOptions.map((ssl) => (
                  <button
                    key={ssl}
                    onClick={() => setReturnSSL(ssl)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      returnSSL === ssl
                        ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                        : "bg-[#0B1120] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                    }`}
                  >
                    {ssl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Container Size Filter */}
          {returnSizeOptions.length > 0 && (
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <div className="flex gap-1.5">
                <button
                  onClick={() => setReturnSize("All")}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    returnSize === "All"
                      ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                      : "bg-[#0B1120] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                  }`}
                >
                  All Sizes
                </button>
                {returnSizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => setReturnSize(size )}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      returnSize === size
                        ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                        : "bg-[#0B1120] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                    }`}
                  >
                    {size}&apos;
                  </button>
                ))}
              </div>
            </div>
          )}

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
                {filteredReturns.map((load, idx) => {
                  const isSelected = selectedReturn?.id === load.id
                  const recPickup = recommendedPickupForReturn(load.id)
                  const isRecommended = !!recPickup
                  const lfdOverdue = isLFDOverdue(load.containers?.last_free_day || null)
                  const returnStatusColor = getStatusColor(load.status)
                  return (
                    <tr
                      key={load.id}
                      onClick={() => setSelectedReturn(load)}
                      className={`cursor-pointer border-b border-white/5 transition-colors ${
                        isSelected
                          ? "border-l-2 border-l-blue-400 bg-blue-500/20 ring-1 ring-inset ring-blue-500/40"
                          : isRecommended
                            ? "border-l-2 border-l-[#E8700A]/80 bg-[#E8700A]/5 hover:bg-[#E8700A]/10"
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
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${returnStatusColor.bg} ${returnStatusColor.text}`}>
                          {load.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{load.containers?.container_number || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{getShippingLine(load) || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{getContainerSize(load) ? `${getContainerSize(load)}'` : "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{load.delivery_location || "—"}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${lfdOverdue ? "text-[#E8700A]" : "text-gray-400"}`}>
                        {load.containers?.last_free_day ? formatDate(load.containers.last_free_day) : "—"}
                      </td>
                    </tr>
                  )
                })}
                {filteredReturns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No returns found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pick Ups Section ── */}
        <div className="bg-[#111827] border border-white/5 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-semibold text-white">Pick Ups</h3>
            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
              {filteredPickups.length}
            </span>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search pick ups..."
                value={pickupSearch}
                onChange={(e) => setPickupSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#0B1120] border border-white/5 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
              />
            </div>
          </div>

          {/* Terminal Filter */}
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPickupTerminal("All")}
                title="All terminals"
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  pickupTerminal === "All"
                    ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                    : "bg-[#0B1120] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                }`}
              >
                All
              </button>
              {phTerminalFilterOptions.map((o) => (
                <button
                  type="button"
                  key={o.code}
                  title={o.label}
                  onClick={() => setPickupTerminal(o.code)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    pickupTerminal === o.code
                      ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                      : "bg-[#0B1120] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                  }`}
                >
                  {o.pillLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Container Size Filter */}
          {pickupSizeOptions.length > 0 && (
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPickupSize("All")}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                    pickupSize === "All"
                      ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                      : "bg-[#0B1120] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                  }`}
                >
                  All Sizes
                </button>
                {pickupSizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => setPickupSize(size )}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      pickupSize === size
                        ? "bg-[#E8700A]/10 border-[#E8700A]/50 text-white"
                        : "bg-[#0B1120] border-white/5 text-gray-400 hover:border-white/10 hover:text-gray-300"
                    }`}
                  >
                    {size}&apos;
                  </button>
                ))}
              </div>
            </div>
          )}

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
                {filteredPickups.map((load, idx) => {
                  const statusColor = getStatusColor(load.status)
                  const isSelected = selectedPickup?.id === load.id
                  const recRet = recommendedReturnForPickup(load.id)
                  const isRecommended = !!recRet
                  return (
                    <tr
                      key={load.id}
                      onClick={() => setSelectedPickup(load)}
                      className={`cursor-pointer border-b border-white/5 transition-colors ${
                        isSelected
                          ? "border-l-2 border-l-green-400 bg-green-500/20 ring-1 ring-inset ring-green-500/40"
                          : isRecommended
                            ? "border-l-2 border-l-[#E8700A]/80 bg-[#E8700A]/5 hover:bg-[#E8700A]/10"
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
                      <td className="px-4 py-3 text-gray-400">{getContainerSize(load) ? `${getContainerSize(load)}'` : "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{load.pickup_location || "—"}</td>
                    </tr>
                  )
                })}
                {filteredPickups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No pick ups found</td>
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
            <div className="overflow-x-auto">
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
