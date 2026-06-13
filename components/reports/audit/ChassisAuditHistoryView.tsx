"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { KPICard } from "@/components/reports/KPICard"
import { downloadCSV } from "@/lib/reports/csvExport"
import { useRouter } from "next/navigation"
import { Box, CheckCircle, Clock } from "lucide-react"

interface AuditUpload {
  id: string
  fileName: string
  recordsCount: number
  uploadDate: string
  status: string
  processedCount: number
}

interface ChassisAuditHistoryViewProps {
  startDate: string
  endDate: string
  totalUploads: number
  totalRecords: number
  processedCount: number
  pendingCount: number
  tableData: AuditUpload[]
}

export function ChassisAuditHistoryView({
  startDate: initialStartDate,
  endDate: initialEndDate,
  totalUploads,
  totalRecords,
  processedCount,
  pendingCount,
  tableData,
}: ChassisAuditHistoryViewProps) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    router.push(
      `/dashboard/reports/audit/chassis?startDate=${newStart}&endDate=${newEnd}`
    )
  }

  const handleExport = () => {
    const headers = ["File Name", "Records Count", "Upload Date", "Status", "Processed", "Pending"]
    const rows = tableData.map((row) => [
      row.fileName,
      row.recordsCount.toString(),
      format(parseISO(row.uploadDate), "MMM dd, yyyy HH:mm"),
      row.status,
      row.processedCount.toString(),
      (row.recordsCount - row.processedCount).toString(),
    ])
    downloadCSV(headers, rows, "chassis-audit-history.csv")
  }

  const getStatusColor = (status: string) => {
    if (status === "Processed") {
      return "bg-green-500/20 text-green-400"
    }
    if (status === "In Progress") {
      return "bg-blue-500/20 text-blue-400"
    }
    return "bg-yellow-500/20 text-yellow-400"
  }

  const getStatusIcon = (status: string) => {
    if (status === "Processed") {
      return <CheckCircle className="w-4 h-4" />
    }
    if (status === "In Progress") {
      return <Clock className="w-4 h-4" />
    }
    return <Clock className="w-4 h-4" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Chassis Audit History</h1>
        <p className="text-gray-400 text-sm">
          Review chassis audit uploads and processing status
        </p>
      </div>

      <DateRangeSelector
        startDate={startDate}
        endDate={endDate}
        onDateChange={handleDateRangeChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Uploads"
          value={totalUploads.toString()}
          icon={<Box className="w-6 h-6 text-blue-500" />}
        />
        <KPICard title="Total Records" value={totalRecords.toString()} subtitle="records" />
        <KPICard
          title="Processed"
          value={processedCount.toString()}
          subtitle={`${totalRecords > 0 ? Math.round((processedCount / totalRecords) * 100) : 0}%`}
        />
        <KPICard
          title="Pending Review"
          value={pendingCount.toString()}
          subtitle="records"
        />
      </div>

      <div className="bg-[#111827] border border-white/10 rounded-lg p-6 overflow-x-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Audit Uploads</h2>
          <ReportExportButton onClick={handleExport} />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                File Name
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Records
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Upload Date
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Processed
              </th>
              <th className="text-right px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Pending
              </th>
              <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-300">{row.fileName}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{row.recordsCount}</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {format(parseISO(row.uploadDate), "MMM dd, yyyy HH:mm")}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">{row.processedCount}</td>
                <td className="px-4 py-3 text-sm text-gray-300 text-right">
                  {row.recordsCount - row.processedCount}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(row.status)}`}
                  >
                    {getStatusIcon(row.status)}
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
