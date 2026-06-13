"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"

const STATUS_COLORS: Record<string, string> = {
  Completed: "#10B981",
  Pending: "#F59E0B",
  Processing: "#3B82F6",
  Failed: "#EF4444",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e2330] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm text-white">{entry.name}: {entry.value}</p>
      ))}
    </div>
  )
}

interface Upload {
  id: string
  file_name: string
  file_size: number | null
  row_count: number | null
  upload_date: string | null
  status: string
  processed_at: string | null
  error_message: string | null
  created_at: string
}

export function ChassisAuditReport({ uploads }: { uploads: Upload[] }) {
  const totalUploads = uploads.length
  const completed = uploads.filter(u => u.status === "Completed").length
  const failed = uploads.filter(u => u.status === "Failed").length
  const totalRows = uploads.reduce((s, u) => s + (u.row_count || 0), 0)
  const successRate = totalUploads > 0 ? Math.round((completed / totalUploads) * 100) : 0

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {}
    uploads.forEach(u => {
      map[u.status] = (map[u.status] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [uploads])

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const map: Record<string, { month: string; uploads: number; rows: number }> = {}
    uploads.forEach(u => {
      const d = new Date(u.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleDateString("en-US", { year: "numeric", month: "short" })
      if (!map[key]) map[key] = { month: label, uploads: 0, rows: 0 }
      map[key].uploads += 1
      map[key].rows += u.row_count || 0
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [uploads])

  const handleExport = () => {
    const headers = ["File Name", "Upload Date", "Status", "Rows", "File Size", "Processed At", "Error"]
    const rows = uploads.map(u => [
      u.file_name, u.upload_date || u.created_at?.split("T")[0] || "", u.status,
      (u.row_count || 0).toString(), u.file_size ? `${(u.file_size / 1024).toFixed(1)} KB` : "",
      u.processed_at ? new Date(u.processed_at).toLocaleString() : "", u.error_message || ""
    ])
    downloadCSV(headers, rows, `chassis-audit-history.csv`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Chassis Audit History</h1>
          <p className="text-sm text-gray-400 mt-1">Upload history, processing status, and error tracking</p>
        </div>
        <ReportExportButton onClick={handleExport} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <KPICard title="Total Uploads" value={totalUploads.toString()} />
        <KPICard title="Success Rate" value={`${successRate}%`} bg={successRate >= 90 ? "bg-green-900/20" : successRate >= 70 ? "bg-yellow-900/20" : "bg-red-900/20"} />
        <KPICard title="Failed Uploads" value={failed.toString()} bg={failed > 0 ? "bg-red-900/20" : "bg-[#111827]"} />
        <KPICard title="Total Rows Processed" value={totalRows.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Uploads by Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Uploads" radius={[4, 4, 0, 0]}>
                {byStatus.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#E8700A"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend */}
        <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Monthly Upload Activity</h3>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="uploads" name="Uploads" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">No upload history</div>
          )}
        </div>
      </div>

      {/* Upload History Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">File Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Rows</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Size</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Error</th>
            </tr>
          </thead>
          <tbody>
            {uploads.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No chassis audit uploads</td></tr>
            ) : (
              uploads.map((u, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-sm text-white">{u.file_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{u.upload_date || u.created_at?.split("T")[0]}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      u.status === "Completed" ? "bg-green-900/30 text-green-400" :
                      u.status === "Failed" ? "bg-red-900/30 text-red-400" :
                      u.status === "Processing" ? "bg-blue-900/30 text-blue-400" :
                      "bg-yellow-900/30 text-yellow-400"
                    }`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 text-right">{u.row_count?.toLocaleString() || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 text-right">{u.file_size ? `${(u.file_size / 1024).toFixed(1)} KB` : "—"}</td>
                  <td className="px-4 py-3 text-sm text-red-400 max-w-[200px] truncate">{u.error_message || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
