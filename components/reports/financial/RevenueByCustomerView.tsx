"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { ReportExportButton } from "@/components/reports/ReportExportButton"
import { downloadCSV } from "@/lib/reports/csvExport"

interface RevenueData {
  customerId: string
  name: string
  totalRevenue: number
  loadCount: number
  avgRevenue: number
}

interface RevenueByCustomerViewProps {
  startDate: string
  endDate: string
  revenueData: RevenueData[]
}

export function RevenueByCustomerView({
  startDate,
  endDate,
  revenueData,
}: RevenueByCustomerViewProps) {
  const router = useRouter()

  const handleDateRangeChange = (start: string, end: string) => {
    const newParams = new URLSearchParams()
    newParams.set("startDate", start)
    newParams.set("endDate", end)
    router.push(`?${newParams.toString()}`)
  }

  // Top 15 customers for chart
  const chartData = useMemo(() => {
    return revenueData.slice(0, 15).map(customer => ({
      name: customer.name,
      revenue: customer.totalRevenue,
      customerId: customer.customerId,
    }))
  }, [revenueData])

  // Summary stats
  const totalRevenue = useMemo(
    () => revenueData.reduce((sum, c) => sum + c.totalRevenue, 0),
    [revenueData]
  )

  const totalLoads = useMemo(
    () => revenueData.reduce((sum, c) => sum + c.loadCount, 0),
    [revenueData]
  )

  const avgRevenuePerLoad = totalLoads > 0 ? totalRevenue / totalLoads : 0

  const handleExport = () => {
    const headers = ["Customer", "Load Count", "Total Revenue", "Avg Revenue/Load"]
    const rows: string[][] = revenueData.map(customer => [
      customer.name,
      customer.loadCount.toString(),
      customer.totalRevenue.toString(),
      customer.avgRevenue.toFixed(2),
    ])
    downloadCSV(headers, rows, `revenue-by-customer-${startDate}-to-${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Revenue by Customer</h1>
          <p className="text-gray-400 mt-1">
            {startDate} to {endDate}
          </p>
        </div>
        <ReportExportButton onClick={handleExport} label="Export CSV" />
      </div>

      {/* Date Range Selector */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
        <DateRangeSelector
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateRangeChange}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Revenue
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Total Loads
          </p>
          <p className="text-2xl font-bold text-white mt-1">{totalLoads}</p>
        </div>
        <div className="bg-[#111827] border border-white/10 rounded-lg p-5">
          <p className="text-xs uppercase text-gray-500 font-medium tracking-wider">
            Avg Revenue/Load
          </p>
          <p className="text-2xl font-bold text-white mt-1">
            ${avgRevenuePerLoad.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Top 15 Customers by Revenue</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis type="number" stroke="#6B7280" tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#6B7280"
              tick={{ fill: "#9CA3AF", fontSize: 12 }}
              width={195}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e2330",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value) => `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <Bar dataKey="revenue" fill="#E8700A" radius={[0, 8, 8, 0]} />
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
                  Customer Name
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Load Count
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase">
                  Avg Revenue/Load
                </th>
              </tr>
            </thead>
            <tbody>
              {revenueData.map((customer) => (
                <tr key={customer.customerId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-300">{customer.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">{customer.loadCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${customer.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 text-right">
                    ${customer.avgRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
