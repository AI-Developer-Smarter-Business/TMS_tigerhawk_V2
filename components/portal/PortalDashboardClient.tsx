// components/portal/PortalDashboardClient.tsx
"use client"

import Link from "next/link"
import { LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { PortalSummary, PortalLoad } from "@/types/portal"
import { formatDate } from "@/lib/utils"

type Props = {
  summary: PortalSummary
  recentActivity: PortalLoad[]
}

/* ── Shared style tokens (matches admin dashboard pattern) ── */
const S = {
  panel: "bg-[#141922] border border-[#1e2530] rounded-xl",
  panelHeader:
    "px-4 py-3 border-b border-[#1e2530] flex items-center justify-between bg-[#0B1120] rounded-t-xl",
  th: "px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]",
  td: "px-4 py-3 text-[11px] text-gray-300 whitespace-nowrap border-b border-[#1e2530]/60",
  row: "hover:bg-white/[0.02] transition-colors",
}

const summaryCards = [
  {
    key: "activeLoads" as const,
    label: "Active Loads",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    key: "inTransit" as const,
    label: "In Transit",
    color: "text-[#FF8C21]",
    bg: "bg-[#E8700A]/10",
    border: "border-[#E8700A]/20",
  },
  {
    key: "deliveredLast30" as const,
    label: "Delivered (30 days)",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  {
    key: "pending" as const,
    label: "Pending",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
]

export function PortalDashboardClient({ summary, recentActivity }: Props) {
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

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Overview of your shipments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.key}
            className={`${card.bg} border ${card.border} rounded-xl p-5`}
          >
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
              {card.label}
            </p>
            <p className={`text-3xl font-bold mt-2 ${card.color}`}>
              {summary[card.key]}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/portal/loads"
          className="px-4 py-2 bg-[#E8700A] hover:bg-[#FF8C21] text-white text-sm font-medium rounded-lg shadow-lg shadow-[#E8700A]/20 transition-colors text-center"
        >
          View Active Loads
        </Link>
        <Link
          href="/portal/documents"
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium rounded-lg border border-white/10 transition-colors text-center"
        >
          Browse Documents
        </Link>
      </div>

      {/* Recent Activity */}
      <div className={`${S.panel} overflow-hidden`}>
        <div className={S.panelHeader}>
          <h2 className="font-semibold text-white text-sm">Recent Activity</h2>
          <Link
            href="/portal/loads"
            className="text-xs text-[#E8700A] hover:text-[#FF8C21] transition-colors"
          >
            View all →
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No loads found. Your shipments will appear here once they are
            created.
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="divide-y divide-[#1e2530]/60 sm:hidden">
              {recentActivity.map((load) => {
                const statusColor = getStatusColor(load.status)
                return (
                  <Link
                    key={load.id}
                    href={`/portal/loads/${load.id}`}
                    className="block px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[#FF8C21]">
                        {load.reference_number}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text}`}
                      >
                        {load.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      {load.containers?.container_number && (
                        <span>{load.containers.container_number}</span>
                      )}
                      {load.load_type && <span>{load.load_type}</span>}
                    </div>
                    {load.delivery_location && (
                      <p className="text-[11px] text-gray-500 mt-1 truncate">
                        → {load.delivery_location}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1">
                      Updated {load.updated_at ? formatDate(load.updated_at) : "—"}
                    </p>
                  </Link>
                )
              })}
            </div>

            {/* Desktop table layout */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={S.th}>Load #</th>
                    <th className={S.th}>Status</th>
                    <th className={S.th}>Container #</th>
                    <th className={S.th}>Type</th>
                    <th className={S.th}>Delivery</th>
                    <th className={S.th}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((load) => {
                    const statusColor = getStatusColor(load.status)
                    return (
                      <tr key={load.id} className={S.row}>
                        <td className={S.td}>
                          <Link
                            href={`/portal/loads/${load.id}`}
                            className="text-[#FF8C21] hover:text-[#E8700A] font-medium"
                          >
                            {load.reference_number}
                          </Link>
                        </td>
                        <td className={S.td}>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.bg} ${statusColor.text}`}
                          >
                            {load.status}
                          </span>
                        </td>
                        <td className={S.td}>
                          {load.containers?.container_number || "—"}
                        </td>
                        <td className={`${S.td} text-gray-400`}>
                          {load.load_type || "—"}
                        </td>
                        <td
                          className={`${S.td} text-gray-400 truncate max-w-[200px]`}
                        >
                          {load.delivery_location || "—"}
                        </td>
                        <td className={`${S.td} text-gray-500`}>
                          {load.updated_at ? formatDate(load.updated_at) : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
