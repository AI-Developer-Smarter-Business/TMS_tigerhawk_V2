"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Grid3x3,
  List,
  ChevronDown,
  Check,
  X,
  Clock,
  AlertCircle,
} from "lucide-react";
import { LoadWithRelations, LOAD_STATUS_COLORS } from "@/types/dispatcher";

type Props = {
  loads: LoadWithRelations[];
};

type SubTab = "problem" | "demurrage" | "missed_cutoff" | "empty_return";
type ViewMode = "grid" | "list";

interface ProblemLoad extends LoadWithRelations {
  problemType?: string;
  daysOverdue?: number;
}

export const ProblemContainersTab: React.FC<Props> = ({ loads }) => {
  const [activeTab, setActiveTab] = useState<SubTab>("problem");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCSR, setSelectedCSR] = useState<string>("");
  const [selectedError, setSelectedError] = useState<string>("");

  // Filter logic for each sub-tab
  const filterProblemContainers = (loads: LoadWithRelations[]): ProblemLoad[] => {
    return loads
      .filter((load) => {
        const hasHold =
          load.customs_hold === "hold" ||
          load.freight_hold === "hold" ||
          load.terminal_hold === "hold" ||
          load.carrier_hold === true;

        const missingData = !load.containers || !load.pickup_location;

        return hasHold || missingData;
      })
      .map((load) => ({
        ...load,
        problemType: determineProblemType(load),
      }));
  };

  const filterDemurrage = (loads: LoadWithRelations[]): ProblemLoad[] => {
    return loads
      .filter((load) => {
        if (!load.containers || !load.containers.last_free_day) return false;
        const lfd = new Date(load.containers.last_free_day);
        const now = new Date();
        return (
          lfd < now &&
          load.status &&
          !["Delivered", "Completed"].includes(load.status)
        );
      })
      .map((load) => {
        const lfd = new Date(load.containers?.last_free_day || "");
        const now = new Date();
        const daysOverdue = Math.floor(
          (now.getTime() - lfd.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          ...load,
          daysOverdue,
          problemType: "Demurrage",
        };
      });
  };

  const filterMissedCutoff = (loads: LoadWithRelations[]): ProblemLoad[] => {
    return loads
      .filter((load) => {
        if (load.load_type !== "Export") return false;
        if (!load.delivery_apt_from) return false;
        const deliveryApt = new Date(load.delivery_apt_from);
        const now = new Date();
        return (
          deliveryApt < now &&
          load.status &&
          !["Delivered", "Completed"].includes(load.status)
        );
      })
      .map((load) => ({
        ...load,
        problemType: "Missed Cut off",
      }));
  };

  const filterEmptyReturnClosed = (loads: LoadWithRelations[]): ProblemLoad[] => {
    return loads
      .filter((load) => {
        if (!load.return_apt_to) return false;
        if (!load.return_location) return false;
        const returnApt = new Date(load.return_apt_to);
        const now = new Date();
        return (
          returnApt < now &&
          load.status &&
          !["Completed"].includes(load.status)
        );
      })
      .map((load) => ({
        ...load,
        problemType: "Empty Return Closed",
      }));
  };

  // Determine problem type
  const determineProblemType = (load: LoadWithRelations): string => {
    if (
      load.customs_hold === "hold" ||
      load.freight_hold === "hold" ||
      load.terminal_hold === "hold" ||
      load.carrier_hold === true
    ) {
      if (load.customs_hold === "hold") return "Customs Hold";
      if (load.freight_hold === "hold") return "Freight Hold";
      if (load.terminal_hold === "hold") return "Terminal Hold";
      if (load.carrier_hold === true) return "Carrier Hold";
    }
    if (!load.containers) return "Missing Container";
    if (!load.pickup_location) return "Missing Pickup Location";
    return "Problem Container";
  };

  // Get filtered data based on active tab
  const getFilteredLoads = (): ProblemLoad[] => {
    let filtered: ProblemLoad[] = [];

    switch (activeTab) {
      case "problem":
        filtered = filterProblemContainers(loads);
        break;
      case "demurrage":
        filtered = filterDemurrage(loads);
        break;
      case "missed_cutoff":
        filtered = filterMissedCutoff(loads);
        break;
      case "empty_return":
        filtered = filterEmptyReturnClosed(loads);
        break;
    }

    return filtered;
  };

  const filteredLoadsByTab = getFilteredLoads();

  // Apply additional filters (search, CSR, error message)
  const finalFilteredLoads = useMemo(() => {
    let result = filteredLoadsByTab;

    // Filter by CSR
    if (selectedCSR) {
      result = result.filter((load) => load.csr === selectedCSR);
    }

    // Filter by error message/problem type
    if (selectedError) {
      result = result.filter((load) => load.problemType === selectedError);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((load) => {
        const reference = load.reference_number?.toLowerCase() || "";
        const containerNumber = load.containers?.container_number?.toLowerCase() || "";
        const customerName = load.customers?.name?.toLowerCase() || "";

        return (
          reference.includes(query) ||
          containerNumber.includes(query) ||
          customerName.includes(query)
        );
      });
    }

    return result;
  }, [filteredLoadsByTab, selectedCSR, selectedError, searchQuery]);

  // Get unique CSR values
  const csrOptions = useMemo(() => {
    const csrs = new Set<string>();
    loads.forEach((load) => {
      if (load.csr) csrs.add(load.csr);
    });
    return Array.from(csrs).sort();
  }, [loads]);

  // Get unique error messages for current tab
  const errorOptions = useMemo(() => {
    const errors = new Set<string>();
    filteredLoadsByTab.forEach((load) => {
      if (load.problemType) errors.add(load.problemType);
    });
    return Array.from(errors).sort();
  }, [filteredLoadsByTab]);

  // Count badges
  const problemCount = filterProblemContainers(loads).length;
  const demurrageCount = filterDemurrage(loads).length;
  const missedCutoffCount = filterMissedCutoff(loads).length;
  const emptyReturnCount = filterEmptyReturnClosed(loads).length;

  const tabs = [
    { id: "problem" as SubTab, label: "Problem Container", count: problemCount },
    { id: "demurrage" as SubTab, label: "Demurrage", count: demurrageCount },
    {
      id: "missed_cutoff" as SubTab,
      label: "Missed Cut off",
      count: missedCutoffCount,
    },
    {
      id: "empty_return" as SubTab,
      label: "Empty Return Closed",
      count: emptyReturnCount,
    },
  ];

  const columns = [
    "#",
    "Checkbox",
    "Load #",
    "Load Status",
    "Driver",
    "Container #",
    "Reference #",
    "Load Type",
    "Size",
    "Pick Up Apt From",
    "LFD/ERD",
    "ETA",
    "Delivery Apt From",
    "Per Diem Free Day",
    "Type (HC/ST)",
    "Shipment #",
    "Customer",
    "SSL",
    "MBOL/BKG",
    "Ref Container #",
    "Chassis #",
    "Total Weight",
    "Delivery Location",
    "Pick Up Location",
    "Return Location",
    "Vessel Name",
  ];

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  const formatTime = (date: string | Date | null | undefined): string => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="w-full bg-[#0B1120] min-h-screen">
      {/* Sub-tabs */}
      <div className="border-b border-white/5 px-6 py-4">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-2 px-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[#E8700A] text-white"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              <span className="text-sm">{tab.label}</span>
              <div
                className={`inline-flex items-center justify-center rounded-full min-w-6 h-6 text-xs font-semibold ${
                  tab.count > 0
                    ? "bg-[#E8700A] text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {tab.count}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="px-6 py-4 border-b border-white/5 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by Load #, Container #, Customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111827] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#E8700A]/50 transition-colors"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex gap-4 flex-wrap">
          {/* CSR Dropdown */}
          <div className="relative flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-400 mb-1 font-medium">
              Select CSR
            </label>
            <div className="relative">
              <select
                value={selectedCSR}
                onChange={(e) => setSelectedCSR(e.target.value)}
                className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm appearance-none focus:outline-none focus:border-[#E8700A]/50 transition-colors"
              >
                <option value="">All CSRs</option>
                {csrOptions.map((csr) => (
                  <option key={csr} value={csr}>
                    {csr}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Error Message Dropdown */}
          <div className="relative flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-400 mb-1 font-medium">
              Select Error Message
            </label>
            <div className="relative">
              <select
                value={selectedError}
                onChange={(e) => setSelectedError(e.target.value)}
                className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-white text-sm appearance-none focus:outline-none focus:border-[#E8700A]/50 transition-colors"
              >
                <option value="">All Issues</option>
                {errorOptions.map((error) => (
                  <option key={error} value={error}>
                    {error}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "grid"
                  ? "bg-[#E8700A] text-white"
                  : "bg-[#111827] text-gray-400 hover:text-gray-300 border border-white/10"
              }`}
              title="Grid view"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-[#E8700A] text-white"
                  : "bg-[#111827] text-gray-400 hover:text-gray-300 border border-white/10"
              }`}
              title="List view"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Table / Content */}
      <div className="p-6">
        {finalFilteredLoads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">
              No Result Found
            </h3>
            <p className="text-sm text-gray-500">
              No loads match your search criteria. Try adjusting your filters.
            </p>
          </div>
        ) : viewMode === "list" ? (
          // List/Table View
          <div className="overflow-x-auto border border-white/5 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#111827] border-b border-white/5">
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-300 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {finalFilteredLoads.map((load, rowIdx) => (
                  <tr
                    key={load.id}
                    className="hover:bg-[#111827]/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {rowIdx + 1}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-500 bg-[#111827] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                      {load.reference_number || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {load.status && (
                        <span
                          className="inline-block px-2 py-1 rounded text-xs font-semibold"
                          style={{
                            backgroundColor:
                              LOAD_STATUS_COLORS[load.status]?.bg || "#374151",
                            color:
                              LOAD_STATUS_COLORS[load.status]?.text || "#9CA3AF",
                          }}
                        >
                          {load.status}
                        </span>
                      )}
                      {!load.status && <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.drivers?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap font-mono">
                      {load.containers?.container_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.reference_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.load_type || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.containers?.size || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatDate(load.pickup_apt_from)}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.containers?.last_free_day
                        ? formatDate(load.containers!.last_free_day)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.vessel_eta ? (
                        <>
                          {formatDate(load.vessel_eta)}
                          {" "}
                          {formatTime(load.vessel_eta)}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatDate(load.delivery_apt_from)}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.per_diem_free_day
                        ? formatDate(load.per_diem_free_day)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.containers?.type || load.container_type || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap font-mono">
                      {load.shipment_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.customers?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.ssl || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap font-mono">
                      {load.mbol || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap font-mono">
                      {"-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap font-mono">
                      {load.chassis_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.total_weight
                        ? `${load.total_weight.toLocaleString()} lbs`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.delivery_location || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.pickup_location || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.return_location || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {load.vessel_eta ? new Date(load.vessel_eta).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {finalFilteredLoads.map((load) => (
              <div
                key={load.id}
                className="bg-[#111827] border border-white/5 rounded-lg p-4 hover:border-[#E8700A]/30 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">
                      Load #{load.reference_number}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {load.containers?.container_number || "No Container"}
                    </p>
                  </div>
                  {load.status && (
                    <span
                      className="inline-block px-2 py-1 rounded text-xs font-semibold"
                      style={{
                        backgroundColor:
                          LOAD_STATUS_COLORS[load.status]?.bg || "#374151",
                        color:
                          LOAD_STATUS_COLORS[load.status]?.text || "#9CA3AF",
                      }}
                    >
                      {load.status}
                    </span>
                  )}
                </div>

                {/* Problem Badge */}
                <div className="mb-3 p-2 bg-[#1F2937] rounded border border-[#E8700A]/20">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#E8700A]" />
                    <span className="text-xs font-medium text-[#E8700A]">
                      {load.problemType}
                    </span>
                    {load.daysOverdue && (
                      <span className="text-xs text-gray-400">
                        ({load.daysOverdue}d overdue)
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer:</span>
                    <span className="text-gray-300">{load.customers?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Driver:</span>
                    <span className="text-gray-300">{load.drivers?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type:</span>
                    <span className="text-gray-300">{load.load_type || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Size:</span>
                    <span className="text-gray-300">
                      {load.containers?.size || load.container_size || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pickup:</span>
                    <span className="text-gray-300 text-right text-xs">
                      {formatDate(load.pickup_apt_from)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivery:</span>
                    <span className="text-gray-300 text-right text-xs">
                      {formatDate(load.delivery_apt_from)}
                    </span>
                  </div>
                  {load.vessel_eta && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">ETA:</span>
                      <span className="text-gray-300 text-right text-xs">
                        {formatDate(load.vessel_eta)} {formatTime(load.vessel_eta)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <button className="w-full px-3 py-2 bg-[#E8700A]/10 hover:bg-[#E8700A]/20 text-[#E8700A] text-xs font-semibold rounded transition-colors">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="px-6 py-4 border-t border-white/5 bg-[#111827]/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Showing <span className="text-white font-semibold">{finalFilteredLoads.length}</span> of{" "}
            <span className="text-white font-semibold">{filteredLoadsByTab.length}</span> containers
          </span>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-[#E8700A]" />
              <span className="text-gray-400">
                {activeTab === "problem"
                  ? "Problem containers requiring attention"
                  : activeTab === "demurrage"
                  ? "Containers exceeding free days"
                  : activeTab === "missed_cutoff"
                  ? "Exports past delivery window"
                  : "Returns past return window"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProblemContainersTab;
