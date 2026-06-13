'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronDown,
  Search,
  Filter,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { LoadWithRelations, LOAD_STATUS_COLORS, LoadStatus } from '@/types/dispatcher';
import { rowToDualPairSlice } from '@/lib/dual-transaction-load-adapter';
import {
  DUAL_EMPTY_SAVED_COST_PER_MILE_USD,
  dualPairCompatible,
  pairEmptyMilesSaved,
  potentialSavingsUsdGreedy,
  sumPairSavingsUsd,
  type LocationCoordMap,
} from '@/lib/dual-transaction-savings';
import type { PhTerminalFilterOption } from '@/lib/terminals/phTerminalFilters';
import {
  buildPhTerminalFilterOptions,
  loadMatchesPhTerminalFilter,
  mergePhFilterOptionsWithVesselTerminals,
} from '@/lib/terminals/phTerminalFilters';

type Props = {
  loads: LoadWithRelations[];
};

type Tab = 'available' | 'linked';
type FilterType = 'all' | '20' | '40st' | '40hc' | '45' | 'special';

interface FilterState {
  search: string;
  typeSize: FilterType;
  ssl?: string;
  /** Terminal filter code (e.g. BCT) from `terminals` + vessel data — not raw pickup_location only */
  terminal?: string;
}

interface MatchedPair {
  returnLoadId: string;
  pickupLoadId: string;
}

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '20', label: "20'" },
  { value: '40st', label: "40' ST" },
  { value: '40hc', label: "40' HC" },
  { value: '45', label: "45'" },
  { value: 'special', label: 'Special' },
];

const getContainerSize = (load: LoadWithRelations): string => {
  const size = load.container_size || '';
  const type = load.container_type || '';

  if (size.includes('20')) return '20';
  if (size.includes('40')) {
    if (type.includes('HC') || type.includes('High')) return '40hc';
    return '40st';
  }
  if (size.includes('45')) return '45';
  return 'special';
};

const matchesFilterType = (load: LoadWithRelations, filter: FilterType): boolean => {
  if (filter === 'all') return true;
  return getContainerSize(load) === filter;
};

const matchesSearch = (load: LoadWithRelations, search: string): boolean => {
  if (!search) return true;
  const query = search.toLowerCase();
  return !!(
    load.reference_number?.toLowerCase().includes(query) ||
    load.containers?.container_number?.toLowerCase().includes(query) ||
    load.customers?.name?.toLowerCase().includes(query) ||
    load.drivers?.name?.toLowerCase().includes(query)
  );
};

export function DualTransactionsTab({ loads }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('available');
  const [returnFilters, setReturnFilters] = useState<FilterState>({
    search: '',
    typeSize: 'all',
  });
  const [pickupFilters, setPickupFilters] = useState<FilterState>({
    search: '',
    typeSize: 'all',
  });
  const [linkedPairs, setLinkedPairs] = useState<MatchedPair[]>([]);
  const [recommendedPairs, setRecommendedPairs] = useState<MatchedPair[]>([]);
  const [returnShowFilters, setReturnShowFilters] = useState(false);
  const [pickupShowFilters, setPickupShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [locationCoordMap, setLocationCoordMap] = useState<LocationCoordMap>({});
  const [terminalNameRows, setTerminalNameRows] = useState<{ name: string }[] | null>(null);
  const [terminalsFetchError, setTerminalsFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/terminals', { credentials: 'include' });
        if (!res.ok) {
          throw new Error(res.status === 401 ? 'Sign in required' : 'Failed to load terminals');
        }
        const data = (await res.json()) as { terminals?: { name: string }[] };
        if (!cancelled) {
          setTerminalNameRows(data.terminals ?? []);
          setTerminalsFetchError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setTerminalNameRows([]);
          setTerminalsFetchError(e instanceof Error ? e.message : 'Failed to load terminals');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Get containers to return (Delivered/Completed with return_location set)
  const containerReturns = useMemo(() => {
    return loads.filter((load) => {
      const status = load.status?.toLowerCase() || '';
      const hasReturnLocation = !!load.return_location;
      const notCompletedReturn =
        !load.completed_date || load.completed_date.length === 0;

      return (
        (status === 'delivered' || status === 'completed') &&
        hasReturnLocation &&
        notCompletedReturn
      );
    });
  }, [loads]);

  // Get containers to pickup (Available/Freight Released/Pending)
  const containerPickups = useMemo(() => {
    return loads.filter((load) => {
      const status = load.status?.toLowerCase() || '';
      const hasPickupLocation = !!load.pickup_location;

      return (
        (status === 'available' ||
          status === 'freight released' ||
          status === 'pending') &&
        hasPickupLocation
      );
    });
  }, [loads]);

  // Get unique SSLs from returns
  const uniqueSSLs = useMemo(() => {
    const sslSet = new Set(
      containerReturns
        .map((load) => load.containers?.shipping_line || load.ssl || '')
        .filter(Boolean)
    );
    return Array.from(sslSet).sort();
  }, [containerReturns]);

  const pickupTerminalFilterOptions: PhTerminalFilterOption[] | null = useMemo(() => {
    if (terminalNameRows === null) return null;
    const base = buildPhTerminalFilterOptions(terminalNameRows);
    const vesselCodes = containerPickups.map((l) => l.containers?.vessels?.terminal);
    return mergePhFilterOptionsWithVesselTerminals(base, vesselCodes);
  }, [terminalNameRows, containerPickups]);

  // Filter containers to return
  const filteredReturns = useMemo(() => {
    return containerReturns.filter((load) => {
      if (!matchesFilterType(load, returnFilters.typeSize)) return false;
      if (!matchesSearch(load, returnFilters.search)) return false;
      if (returnFilters.ssl && (load.containers?.shipping_line || load.ssl) !== returnFilters.ssl)
        return false;
      return true;
    });
  }, [containerReturns, returnFilters]);

  // Filter containers to pickup
  const filteredPickups = useMemo(() => {
    return containerPickups.filter((load) => {
      if (!matchesFilterType(load, pickupFilters.typeSize)) return false;
      if (!matchesSearch(load, pickupFilters.search)) return false;
      if (
        pickupFilters.terminal &&
        !loadMatchesPhTerminalFilter(load, pickupFilters.terminal)
      )
        return false;
      return true;
    });
  }, [containerPickups, pickupFilters]);

  useEffect(() => {
    const unique = new Set<string>();
    for (const l of filteredReturns) {
      if (l.delivery_location?.trim()) unique.add(l.delivery_location.trim());
      if (l.return_location?.trim()) unique.add(l.return_location.trim());
    }
    for (const l of filteredPickups) {
      if (l.pickup_location?.trim()) unique.add(l.pickup_location.trim());
      if (l.delivery_location?.trim()) unique.add(l.delivery_location.trim());
      if (l.return_location?.trim()) unique.add(l.return_location.trim());
    }
    const addresses = [...unique];
    if (addresses.length === 0) {
      setLocationCoordMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dispatcher/dual-transactions/resolve-locations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ addresses }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { coords?: LocationCoordMap };
        if (!cancelled && data.coords) setLocationCoordMap(data.coords);
      } catch {
        if (!cancelled) setLocationCoordMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredReturns, filteredPickups]);

  // Recommend dual matches (ranked by estimated empty-mile savings, highest first)
  const handleRecommendDuals = useCallback(() => {
    const scored: { returnLoadId: string; pickupLoadId: string; usd: number }[] = [];

    for (const returnLoad of filteredReturns) {
      for (const pickupLoad of filteredPickups) {
        const r = rowToDualPairSlice(returnLoad);
        const p = rowToDualPairSlice(pickupLoad);
        if (!dualPairCompatible(r, p)) continue;
        const { savingsUsd } = pairEmptyMilesSaved(r, p, locationCoordMap);
        scored.push({
          returnLoadId: returnLoad.id,
          pickupLoadId: pickupLoad.id,
          usd: savingsUsd,
        });
      }
    }

    scored.sort((a, b) => b.usd - a.usd);
    setRecommendedPairs(
      scored.map(({ returnLoadId, pickupLoadId }) => ({ returnLoadId, pickupLoadId }))
    );
  }, [filteredReturns, filteredPickups, locationCoordMap]);

  const isReturnLinked = (returnId: string): string | undefined => {
    return (
      recommendedPairs.find((p) => p.returnLoadId === returnId)?.pickupLoadId ||
      linkedPairs.find((p) => p.returnLoadId === returnId)?.pickupLoadId
    );
  };

  const isPickupLinked = (pickupId: string): string | undefined => {
    return (
      recommendedPairs.find((p) => p.pickupLoadId === pickupId)?.returnLoadId ||
      linkedPairs.find((p) => p.pickupLoadId === pickupId)?.returnLoadId
    );
  };

  const handleToggleLink = (returnId: string, pickupId: string) => {
    setLinkedPairs((prev) => {
      const existing = prev.find(
        (p) => p.returnLoadId === returnId && p.pickupLoadId === pickupId
      );
      if (existing) {
        return prev.filter(
          (p) => !(p.returnLoadId === returnId && p.pickupLoadId === pickupId)
        );
      }
      return [...prev, { returnLoadId: returnId, pickupLoadId: pickupId }];
    });
  };

  const linkedSavingsUsd = useMemo(() => {
    const pairs = linkedPairs
      .map(({ returnLoadId, pickupLoadId }) => {
        const returnLoad = loads.find((l) => l.id === returnLoadId);
        const pickupLoad = loads.find((l) => l.id === pickupLoadId);
        if (!returnLoad || !pickupLoad) return null;
        return {
          returnLoad: rowToDualPairSlice(returnLoad),
          pickupLoad: rowToDualPairSlice(pickupLoad),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    return sumPairSavingsUsd(pairs, locationCoordMap).totalUsd;
  }, [linkedPairs, loads, locationCoordMap]);

  const recommendedSavingsUsd = useMemo(() => {
    const pairs = recommendedPairs
      .map(({ returnLoadId, pickupLoadId }) => {
        const returnLoad = loads.find((l) => l.id === returnLoadId);
        const pickupLoad = loads.find((l) => l.id === pickupLoadId);
        if (!returnLoad || !pickupLoad) return null;
        return {
          returnLoad: rowToDualPairSlice(returnLoad),
          pickupLoad: rowToDualPairSlice(pickupLoad),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    return sumPairSavingsUsd(pairs, locationCoordMap).totalUsd;
  }, [recommendedPairs, loads, locationCoordMap]);

  const totalLinkedCount = linkedPairs.length + recommendedPairs.length;

  const potentialSavingsUsd = useMemo(() => {
    return potentialSavingsUsdGreedy(
      filteredReturns.map(rowToDualPairSlice),
      filteredPickups.map(rowToDualPairSlice),
      locationCoordMap
    ).totalUsd;
  }, [filteredReturns, filteredPickups, locationCoordMap]);

  const getSSLCount = (ssl: string): number => {
    return filteredReturns.filter((load) => (load.containers?.shipping_line || load.ssl) === ssl).length;
  };

  const getTerminalFilterCount = (code: string): number =>
    containerPickups.filter((load) => loadMatchesPhTerminalFilter(load, code)).length;

  const getStatusColor = (status?: string): string => {
    if (!status) return 'bg-gray-600';
    const colorObj = LOAD_STATUS_COLORS[status as LoadStatus];
    return colorObj?.bg || 'bg-gray-600';
  };

  return (
    <div className="h-full flex flex-col bg-[#0B1120]">
      {/* Top Bar */}
      <div className="bg-[#111827] border-b border-white/5 px-6 py-4 space-y-4">
        {/* Tabs and Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-[#0B1120] p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                activeTab === 'available'
                  ? 'bg-[#E8700A] text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setActiveTab('linked')}
              className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                activeTab === 'linked'
                  ? 'bg-[#E8700A] text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Linked
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Savings Summary */}
            <div className="flex items-center gap-4 mr-2">
              <div className="text-right">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Linked</p>
                <p className="text-sm font-bold text-white">{totalLinkedCount}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-right">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Est. Savings</p>
                <p className="text-sm font-bold text-emerald-400">
                  ${(linkedSavingsUsd + recommendedSavingsUsd).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-[9px] text-gray-600 max-w-[140px] leading-tight">
                  Distance estimate (Haversine); ${DUAL_EMPTY_SAVED_COST_PER_MILE_USD.toFixed(2)}/mi saved empty
                </p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-right">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Potential</p>
                <p className="text-sm font-bold text-gray-400">
                  ${potentialSavingsUsd.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-[#0B1120] border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-[#E8700A]"
            />
            <button
              onClick={handleRecommendDuals}
              className="flex items-center gap-2 px-4 py-2 bg-[#E8700A] text-white rounded font-medium text-sm hover:bg-[#D95F00] transition-colors"
            >
              <Sparkles size={16} />
              Recommend Duals
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4">
        {/* Left Panel - Containers To Return */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#111827] rounded-lg border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 space-y-3">
            <h2 className="text-base font-semibold text-gray-100">
              Containers To Return
            </h2>

            {/* SSL Filter Chips */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">SSL</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() =>
                    setReturnFilters((prev) => ({ ...prev, ssl: undefined }))
                  }
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${
                    !returnFilters.ssl
                      ? 'bg-[#E8700A] text-white'
                      : 'bg-[#0B1120] text-gray-400 border border-white/10 hover:border-white/20'
                  }`}
                >
                  All
                </button>
                {uniqueSSLs.map((ssl) => (
                  <button
                    key={ssl}
                    onClick={() =>
                      setReturnFilters((prev) => ({
                        ...prev,
                        ssl: prev.ssl === ssl ? undefined : ssl,
                      }))
                    }
                    className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${
                      returnFilters.ssl === ssl
                        ? 'bg-[#E8700A] text-white'
                        : 'bg-[#0B1120] text-gray-400 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {ssl}{' '}
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-xs">
                      {getSSLCount(ssl)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Type & Size Filter */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Type & Size
              </p>
              <div className="flex gap-2 flex-wrap">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setReturnFilters((prev) => ({
                        ...prev,
                        typeSize: option.value,
                      }))
                    }
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      returnFilters.typeSize === option.value
                        ? 'bg-[#E8700A] text-white'
                        : 'bg-[#0B1120] text-gray-400 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  placeholder="Search loads..."
                  value={returnFilters.search}
                  onChange={(e) =>
                    setReturnFilters((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 pl-9 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
                />
              </div>
              <button
                onClick={() => setReturnShowFilters(!returnShowFilters)}
                className="relative px-3 py-2 bg-[#0B1120] border border-white/10 rounded hover:border-white/20 transition-colors"
              >
                <Filter size={16} className="text-gray-400" />
                {Object.values(returnFilters).some((v) => v && v !== 'all') && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#E8700A] text-white text-xs rounded-full flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Returns Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0B1120] border-b border-white/5">
                <tr className="text-gray-500 text-xs uppercase font-medium">
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">Load #</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-left">Container #</th>
                  <th className="px-4 py-3 text-left">Current Location</th>
                  <th className="px-4 py-3 text-left">Return Location</th>
                  <th className="px-4 py-3 text-left">Return Apt From</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">SSL</th>
                  <th className="px-4 py-3 text-left">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredReturns.map((load, idx) => {
                  const linkedPickupId = isReturnLinked(load.id);
                  const isLinked = !!linkedPickupId;

                  return (
                    <tr
                      key={load.id}
                      className={`transition-colors ${
                        isLinked
                          ? 'bg-[#1a2332] hover:bg-[#1f2937]'
                          : 'bg-[#111827] hover:bg-[#1a2332]'
                      } border-l-2 ${
                        isLinked ? 'border-l-[#E8700A]' : 'border-l-transparent'
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-gray-300 font-medium">
                        {load.reference_number}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium text-white ${getStatusColor(
                            load.status
                          )}`}
                        >
                          {load.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.drivers?.name}
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-mono">
                        {load.containers?.container_number}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.delivery_location}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.return_location}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.return_apt_from}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {load.customers?.name}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.containers?.shipping_line || load.ssl}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.container_size} {load.container_type}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredReturns.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-500">
                No containers to return
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Containers To Pick Up */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#111827] rounded-lg border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5 space-y-3">
            <h2 className="text-base font-semibold text-gray-100">
              Containers To Pick Up
            </h2>

            {/* Terminal Filter Chips — catalog from `/api/terminals` + vessel codes */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Terminal
              </p>
              {terminalsFetchError && (
                <p className="text-xs text-amber-400/90" role="status">
                  {terminalsFetchError} — filters use vessel codes only until reload.
                </p>
              )}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() =>
                    setPickupFilters((prev) => ({ ...prev, terminal: undefined }))
                  }
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${
                    !pickupFilters.terminal
                      ? 'bg-[#E8700A] text-white'
                      : 'bg-[#0B1120] text-gray-400 border border-white/10 hover:border-white/20'
                  }`}
                >
                  All
                </button>
                {pickupTerminalFilterOptions === null && (
                  <span className="text-xs text-gray-500 py-1">Loading terminals…</span>
                )}
                {pickupTerminalFilterOptions?.map((o) => (
                  <button
                    key={o.code}
                    onClick={() =>
                      setPickupFilters((prev) => ({
                        ...prev,
                        terminal: prev.terminal === o.code ? undefined : o.code,
                      }))
                    }
                    className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors ${
                      pickupFilters.terminal === o.code
                        ? 'bg-[#E8700A] text-white'
                        : 'bg-[#0B1120] text-gray-400 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {o.pillLabel}{' '}
                    <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-white/10 text-xs">
                      {getTerminalFilterCount(o.code)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Type & Size Filter */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Type & Size
              </p>
              <div className="flex gap-2 flex-wrap">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() =>
                      setPickupFilters((prev) => ({
                        ...prev,
                        typeSize: option.value,
                      }))
                    }
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      pickupFilters.typeSize === option.value
                        ? 'bg-[#E8700A] text-white'
                        : 'bg-[#0B1120] text-gray-400 border border-white/10 hover:border-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  placeholder="Search loads..."
                  value={pickupFilters.search}
                  onChange={(e) =>
                    setPickupFilters((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  className="w-full bg-[#0B1120] border border-white/10 rounded px-3 py-2 pl-9 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#E8700A]"
                />
              </div>
              <button
                onClick={() => setPickupShowFilters(!pickupShowFilters)}
                className="relative px-3 py-2 bg-[#0B1120] border border-white/10 rounded hover:border-white/20 transition-colors"
              >
                <Filter size={16} className="text-gray-400" />
                {Object.values(pickupFilters).some((v) => v && v !== 'all') && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#E8700A] text-white text-xs rounded-full flex items-center justify-center">
                    1
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Pickups Table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0B1120] border-b border-white/5">
                <tr className="text-gray-500 text-xs uppercase font-medium">
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">Load #</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-left">Container #</th>
                  <th className="px-4 py-3 text-left">Pick Up Location</th>
                  <th className="px-4 py-3 text-left">Pick Up Apt From</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">SSL</th>
                  <th className="px-4 py-3 text-left">Size</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Next Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPickups.map((load, idx) => {
                  const linkedReturnId = isPickupLinked(load.id);
                  const isLinked = !!linkedReturnId;

                  return (
                    <tr
                      key={load.id}
                      className={`transition-colors ${
                        isLinked
                          ? 'bg-[#1a2332] hover:bg-[#1f2937]'
                          : 'bg-[#111827] hover:bg-[#1a2332]'
                      } border-l-2 ${
                        isLinked ? 'border-l-[#E8700A]' : 'border-l-transparent'
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-gray-300 font-medium">
                        {load.reference_number}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium text-white ${getStatusColor(
                            load.status
                          )}`}
                        >
                          {load.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.drivers?.name}
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-mono">
                        {load.containers?.container_number}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.pickup_location}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.pickup_apt_from}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {load.customers?.name}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.containers?.shipping_line || load.ssl}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.container_size}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.container_type}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {load.delivery_location}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPickups.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-500">
                No containers to pick up
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
