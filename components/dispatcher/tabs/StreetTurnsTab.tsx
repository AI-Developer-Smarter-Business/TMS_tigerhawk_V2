'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  Search,
  Filter,
  Grid3x3,
  List,
  ArrowLeftRight,
  Edit2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { LoadWithRelations, LOAD_STATUS_COLORS } from '@/types/dispatcher';

type Props = {
  loads: LoadWithRelations[];
};

interface SSLGroup {
  ssl: string;
  containerSize: string;
  importCount: number;
  exportCount: number;
}

interface EventStop {
  label: string;
  color: string;
  location: string;
}

export const StreetTurnsTab: React.FC<Props> = ({ loads }) => {
  const [activeTab, setActiveTab] = useState<'available' | 'linked'>('available');
  const [selectedSSL, setSelectedSSL] = useState<string | null>(null);
  const [importsViewMode, setImportsViewMode] = useState<'table' | 'grid'>('table');
  const [exportsViewMode, setExportsViewMode] = useState<'table' | 'grid'>('table');
  const [importsSearch, setImportsSearch] = useState('');
  const [exportsSearch, setExportsSearch] = useState('');
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());
  const [selectedExports, setSelectedExports] = useState<Set<string>>(new Set());
  const [linkedPairs, setLinkedPairs] = useState<Array<{ importId: string; exportId: string }>>([]);

  // Separate imports and exports
  const importLoads = useMemo(
    () => loads.filter((load) => load.load_type === 'Import'),
    [loads]
  );

  const exportLoads = useMemo(
    () => loads.filter((load) => load.load_type === 'Export'),
    [loads]
  );

  // Group by SSL + container size
  const sslGroups = useMemo(() => {
    const groups = new Map<string, SSLGroup>();

    importLoads.forEach((load) => {
      const ssl = load.ssl || load.containers?.shipping_line || "Unknown";
      const containerSize = load.container_size || load.containers?.size || "";
      const key = `${ssl}|${containerSize}`;
      if (!groups.has(key)) {
        groups.set(key, {
          ssl,
          containerSize,
          importCount: 0,
          exportCount: 0,
        });
      }
      groups.get(key)!.importCount++;
    });

    exportLoads.forEach((load) => {
      const ssl = load.ssl || load.containers?.shipping_line || "Unknown";
      const containerSize = load.container_size || load.containers?.size || "";
      const key = `${ssl}|${containerSize}`;
      if (!groups.has(key)) {
        groups.set(key, {
          ssl,
          containerSize,
          importCount: 0,
          exportCount: 0,
        });
      }
      groups.get(key)!.exportCount++;
    });

    return Array.from(groups.values());
  }, [importLoads, exportLoads]);

  // Filter loads based on selected SSL and search
  const filteredImports = useMemo(() => {
    return importLoads.filter((load) => {
      const ssl = load.ssl || load.containers?.shipping_line || "Unknown";
      const containerSize = load.container_size || load.containers?.size || "";
      const matchesSSL = !selectedSSL || `${ssl}|${containerSize}` === selectedSSL;
      const matchesSearch =
        load.reference_number?.toLowerCase().includes(importsSearch.toLowerCase()) ||
        load.drivers?.name?.toLowerCase().includes(importsSearch.toLowerCase()) ||
        load.containers?.container_number?.toLowerCase().includes(importsSearch.toLowerCase());

      if (activeTab === 'linked') {
        const isLinked = linkedPairs.some((pair) => pair.importId === load.id);
        return matchesSSL && matchesSearch && isLinked;
      }

      return matchesSSL && matchesSearch;
    });
  }, [importLoads, selectedSSL, importsSearch, activeTab, linkedPairs]);

  const filteredExports = useMemo(() => {
    return exportLoads.filter((load) => {
      const ssl = load.ssl || load.containers?.shipping_line || "Unknown";
      const containerSize = load.container_size || load.containers?.size || "";
      const matchesSSL = !selectedSSL || `${ssl}|${containerSize}` === selectedSSL;
      const matchesSearch =
        load.reference_number?.toLowerCase().includes(exportsSearch.toLowerCase()) ||
        load.drivers?.name?.toLowerCase().includes(exportsSearch.toLowerCase()) ||
        load.containers?.container_number?.toLowerCase().includes(exportsSearch.toLowerCase());

      if (activeTab === 'linked') {
        const isLinked = linkedPairs.some((pair) => pair.exportId === load.id);
        return matchesSSL && matchesSearch && isLinked;
      }

      return matchesSSL && matchesSearch;
    });
  }, [exportLoads, selectedSSL, exportsSearch, activeTab, linkedPairs]);

  // Get load status badge text and color
  const getLoadStatus = (load: LoadWithRelations) => {
    if (load.customs_hold === 'released' && load.freight_hold === 'released') {
      return {
        text: 'Customs Released / Freight Released',
        color: 'bg-green-900 text-green-100',
      };
    }
    if (load.customs_hold === 'hold') {
      return {
        text: 'Customs Hold',
        color: 'bg-red-900 text-red-100',
      };
    }
    if (load.status === 'Completed' || load.actual_delivery) {
      return {
        text: 'Dropped - Loaded',
        color: 'bg-blue-900 text-blue-100',
      };
    }
    return {
      text: 'Pending',
      color: 'bg-yellow-900 text-yellow-100',
    };
  };

  // Extract events from load stops
  const getLoadEvents = (
    load: LoadWithRelations
  ): { event1: EventStop | null; event2: EventStop | null; event3: EventStop | null } => {
    return {
      event1: load.pickup_location
        ? {
            label: 'Pick Up Container',
            color: 'bg-green-900 text-green-100',
            location: load.pickup_location,
          }
        : null,
      event2: load.delivery_location
        ? {
            label: 'Deliver Container',
            color: 'bg-blue-900 text-blue-100',
            location: load.delivery_location,
          }
        : null,
      event3: load.return_location
        ? {
            label: load.load_type === 'Import' ? 'Return Container' : 'Drop Container',
            color: 'bg-orange-900 text-orange-100',
            location: load.return_location,
          }
        : null,
    };
  };

  // Estimated savings: each street turn eliminates one empty return + one empty pickup trip
  // Average cost per empty move (fuel, driver time, chassis usage)
  const ESTIMATED_COST_PER_EMPTY_MOVE = 150
  const estimatedSavings = useMemo(() => {
    // Each linked pair saves 2 empty moves (return + pickup)
    return linkedPairs.length * ESTIMATED_COST_PER_EMPTY_MOVE * 2
  }, [linkedPairs])

  // Potential savings if all possible matches were linked
  const potentialSavings = useMemo(() => {
    const possibleMatches = Math.min(filteredImports.length, filteredExports.length)
    return possibleMatches * ESTIMATED_COST_PER_EMPTY_MOVE * 2
  }, [filteredImports.length, filteredExports.length])

  // Link imports and exports as street turn
  const handleLinkStreetTurn = () => {
    if (selectedImports.size > 0 && selectedExports.size > 0) {
      selectedImports.forEach((importId) => {
        selectedExports.forEach((exportId) => {
          if (!linkedPairs.some((p) => p.importId === importId && p.exportId === exportId)) {
            setLinkedPairs((prev) => [...prev, { importId, exportId }]);
          }
        });
      });
      setSelectedImports(new Set());
      setSelectedExports(new Set());
    }
  };

  // Toggle import selection
  const toggleImportSelection = (loadId: string) => {
    setSelectedImports((prev) => {
      const next = new Set(prev);
      if (next.has(loadId)) {
        next.delete(loadId);
      } else {
        next.add(loadId);
      }
      return next;
    });
  };

  // Toggle export selection
  const toggleExportSelection = (loadId: string) => {
    setSelectedExports((prev) => {
      const next = new Set(prev);
      if (next.has(loadId)) {
        next.delete(loadId);
      } else {
        next.add(loadId);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#0B1120]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#111827]">
        {/* Tab Toggle */}
        <div className="flex items-center gap-2 bg-[#0B1120] rounded-lg p-1">
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 rounded font-medium transition-all ${
              activeTab === 'available'
                ? 'bg-[#E8700A] text-white'
                : 'text-gray-300 hover:text-gray-100'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => setActiveTab('linked')}
            className={`px-4 py-2 rounded font-medium transition-all ${
              activeTab === 'linked'
                ? 'bg-[#E8700A] text-white'
                : 'text-gray-300 hover:text-gray-100'
            }`}
          >
            Linked
          </button>
        </div>

        {/* Savings Summary */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase text-gray-500 font-medium">Linked Pairs</p>
              <p className="text-sm font-bold text-white">{linkedPairs.length}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <p className="text-[10px] uppercase text-gray-500 font-medium">Est. Savings</p>
              <p className="text-sm font-bold text-emerald-400">
                ${estimatedSavings.toLocaleString()}
              </p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <p className="text-[10px] uppercase text-gray-500 font-medium">Potential Savings</p>
              <p className="text-sm font-bold text-gray-400">
                ${potentialSavings.toLocaleString()}
              </p>
            </div>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white">
            <Edit2 size={18} />
          </button>
        </div>
      </div>

      {/* SSL Filter Bar */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 overflow-x-auto scrollbar-hide">
        {sslGroups.map((group) => {
          const key = `${group.ssl}|${group.containerSize}`;
          const isSelected = selectedSSL === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedSSL(isSelected ? null : key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-[#E8700A] text-white'
                  : 'bg-[#111827] text-gray-300 hover:text-white border border-white/10'
              }`}
            >
              <span className="font-semibold">{group.ssl}</span>
              <span className="text-xs opacity-75">{group.containerSize}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs bg-blue-900 text-blue-100 px-2 py-0.5 rounded">
                  {group.importCount}
                </span>
                <span className="text-xs bg-blue-900 text-blue-100 px-2 py-0.5 rounded">
                  {group.exportCount}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-6 px-6 py-6 overflow-hidden">
        {/* Left Panel - Imports */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#111827] rounded-lg border border-white/5">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-white/5">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                placeholder="Search imports..."
                value={importsSearch}
                onChange={(e) => setImportsSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A]"
              />
            </div>

            {/* Filter Button */}
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white">
              <Filter size={18} />
            </button>

            {/* View Toggle */}
            <button
              onClick={() => setImportsViewMode(importsViewMode === 'table' ? 'grid' : 'table')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            >
              {importsViewMode === 'table' ? <Grid3x3 size={18} /> : <List size={18} />}
            </button>

            {/* Link Icon */}
            <button
              onClick={handleLinkStreetTurn}
              disabled={selectedImports.size === 0 || selectedExports.size === 0}
              className={`p-2 rounded-lg transition-colors ${
                selectedImports.size > 0 && selectedExports.size > 0
                  ? 'text-[#E8700A] hover:bg-white/10'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              <ArrowLeftRight size={18} />
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 sticky top-0 bg-[#0B1120]">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium w-12">#</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedImports(new Set(filteredImports.map((l) => l.id)));
                        } else {
                          setSelectedImports(new Set());
                        }
                      }}
                      className="rounded border-gray-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Load #</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium w-12"></th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Load Status</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Driver</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Event 1</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Event 2</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Event 3</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Container #</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Reference #</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Load Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredImports.map((load, index) => {
                  const status = getLoadStatus(load);
                  const events = getLoadEvents(load);

                  return (
                    <tr
                      key={load.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedImports.has(load.id)}
                          onChange={() => toggleImportSelection(load.id)}
                          className="rounded border-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{load.reference_number}</td>
                      <td className="px-4 py-3">
                        <AlertCircle size={16} className="text-yellow-500" />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{load.drivers?.name || "Unknown"}</td>
                      <td className="px-4 py-3">
                        {events.event1 && (
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-1 rounded w-fit ${events.event1.color}`}>
                              {events.event1.label}
                            </span>
                            <span className="text-xs text-gray-400">{events.event1.location}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {events.event2 && (
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-1 rounded w-fit ${events.event2.color}`}>
                              {events.event2.label}
                            </span>
                            <span className="text-xs text-gray-400">{events.event2.location}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {events.event3 && (
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-1 rounded w-fit ${events.event3.color}`}>
                              {events.event3.label}
                            </span>
                            <span className="text-xs text-gray-400">{events.event3.location}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{load.containers?.container_number || ""}</td>
                      <td className="px-4 py-3 text-gray-300">{load.reference_number}</td>
                      <td className="px-4 py-3 text-gray-300">{load.load_type}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredImports.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-500">
                No imports found
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Exports */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#111827] rounded-lg border border-white/5">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-white/5">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input
                type="text"
                placeholder="Search exports..."
                value={exportsSearch}
                onChange={(e) => setExportsSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#0B1120] border border-white/10 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A] focus:ring-1 focus:ring-[#E8700A]"
              />
            </div>

            {/* Filter Button */}
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white">
              <Filter size={18} />
            </button>

            {/* View Toggle */}
            <button
              onClick={() => setExportsViewMode(exportsViewMode === 'table' ? 'grid' : 'table')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
            >
              {exportsViewMode === 'table' ? <Grid3x3 size={18} /> : <List size={18} />}
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 sticky top-0 bg-[#0B1120]">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium w-12">#</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium w-12">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExports(new Set(filteredExports.map((l) => l.id)));
                        } else {
                          setSelectedExports(new Set());
                        }
                      }}
                      className="rounded border-gray-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Load #</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium w-12"></th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Load Status</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Driver</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Event 1</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Event 2</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Event 3</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Container #</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Reference #</th>
                </tr>
              </thead>
              <tbody>
                {filteredExports.map((load, index) => {
                  const status = getLoadStatus(load);
                  const events = getLoadEvents(load);

                  return (
                    <tr
                      key={load.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedExports.has(load.id)}
                          onChange={() => toggleExportSelection(load.id)}
                          className="rounded border-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{load.reference_number}</td>
                      <td className="px-4 py-3">
                        <AlertCircle size={16} className="text-yellow-500" />
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${status.color}`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{load.drivers?.name || "Unknown"}</td>
                      <td className="px-4 py-3">
                        {events.event1 && (
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-1 rounded w-fit ${events.event1.color}`}>
                              {events.event1.label}
                            </span>
                            <span className="text-xs text-gray-400">{events.event1.location}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {events.event2 && (
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-1 rounded w-fit ${events.event2.color}`}>
                              {events.event2.label}
                            </span>
                            <span className="text-xs text-gray-400">{events.event2.location}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {events.event3 && (
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs px-2 py-1 rounded w-fit ${events.event3.color}`}>
                              {events.event3.label}
                            </span>
                            <span className="text-xs text-gray-400">{events.event3.location}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{load.containers?.container_number || ""}</td>
                      <td className="px-4 py-3 text-gray-300">{load.reference_number}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredExports.length === 0 && (
              <div className="flex items-center justify-center h-32 text-gray-500">
                No exports found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreetTurnsTab;
