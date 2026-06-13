"use client"

import { useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { downloadCSV } from "@/lib/reports/csvExport"

interface CustomerAgingData {
  customerId: string
  name: string
  current: number
  aging31to60: number
  aging61to90: number
  aging91to120: number
  aging120plus: number
  total: number
}

interface ARAgingReportViewProps {
  agingData: CustomerAgingData[]
  totals: {
    totalAR: number
    totalCurrent: number
    totalAging31to60: number
    totalAging61to90: number
    totalAging91to120: number
    totalAging120plus: number
  }
}

export function ARAgingReportView({
  agingData,
  totals,
}: ARAgingReportViewProps) {
  const chartData = useMemo(() => {
    return agingData.slice(0, 20).map(customer => ({
      name: customer.name,
      current: customer.current,
      aging31to60: customer.aging31to60,
      aging61to90: customer.aging61to90,
      aging91to120: customer.aging91to120,
      aging120plus: customer.aging120plus,
    }))
  }, [agingData])

  const handleExport = () => {
    const headers = ["Customer", "Current", "31-60 Days", "61-90 Days", "91-120 Days", "120+ Days", "Total A/R"]
    const rows = agingData.map(customer => [
      customer.name,
      customer.current.toString(),
      customer.aging31to60.toString(),
      customer.aging61to90.toString(),
      customer.aging91to120.toString(),
      customer.aging120plus.toString(),
      customer.total.toString(),
    ])
    downloadCSV(headers, rows, "ar-aging-report.csv")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">A/R Aging Summary</h1>
          <p className="text-gray-400 mt-1">
            Accounts Receivable aging analysis by customer
          </p>
        </div>
        <ReportExportButton onClick={handleExport} label="Export CSV" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total A/R
          </p>
          <p className="text-xl font-bold text-white mt-1">
            ${totals.totalAR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5 border-green-500/30">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Current
          </p>
          <p className="text-xl font-bold text-green-500 mt-1">
            ${totals.totalCurrent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5 border-yellow-500/30">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            31-60 Days
          </p>
          <p className="text-xl font-bold text-yellow-500 mt-1">
            ${totals.totalAging31to60.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5 border-orange-500/30">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            61-90 Days
          </p>
          <p className="text-xl font-bold text-orange-500 mt-1">
            ${totals.totalAging61to90.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5 border-red-500/30">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            91-120 Days
          </p>
          <p className="text-xl font-bold text-red-500 mt-1">
            ${totals.totalAging91to120.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5 border-red-700/30">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            120+ Days
          </p>
          <p className="text-xl font-bold text-red-700 mt-1">
            ${totals.totalAging120plus.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">A/R Aging by Customer</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              stroke="#6B7280"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis stroke="#6B7280" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e2330",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value) => `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Legend />
            <Bar dataKey="current" stackId="a" fill="#10B981" />
            <Bar dataKey="aging31to60" stackId="a" fill="#FBBF24" />
            <Bar dataKey="aging61to90" stackId="a" fill="#FB923C" />
            <Bar dataKey="aging91to120" stackId="a" fill="#EF4444" />
            <Bar dataKey="aging120plus" stackId="a" fill="#991B1B" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-white/10 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Current
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  31-60 Days
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  61-90 Days
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  91-120 Days
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  120+ Days
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {agingData.map((customer) => (
                <tr key={customer.customerId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-300">{customer.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${customer.current.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${customer.aging31to60.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${customer.aging61to90.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${customer.aging91to120.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${customer.aging120plus.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-white text-right">
                    ${customer.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
