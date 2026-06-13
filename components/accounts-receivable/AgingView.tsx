"use client"

import { useState, useMemo } from "react"
import { SearchableSelect } from "@/components/ui/SearchableSelect"

interface Invoice {
  id: string
  customer_id: string
  amount: number
  amount_paid: number
  created_at: string
  customers?: { id: string; name: string }
}

interface Customer {
  id: string
  name: string
}

interface AgingViewProps {
  initialInvoices: Invoice[]
  initialCustomers: Customer[]
  error: string | null
}

export function AgingView({
  initialInvoices,
  initialCustomers,
  error,
}: AgingViewProps) {
  const [invoices] = useState(initialInvoices)
  const [customers] = useState(initialCustomers)
  const [selectedCustomerId, setSelectedCustomerId] = useState("")

  // Calculate aging buckets
  const agingData = useMemo(() => {
    const now = new Date()
    const customerMap: Record<
      string,
      {
        name: string
        "0-30": number
        "31-60": number
        "61-90": number
        "91-120": number
        "120+": number
      }
    > = {}

    // Initialize all customers
    customers.forEach((c) => {
      customerMap[c.id] = {
        name: c.name,
        "0-30": 0,
        "31-60": 0,
        "61-90": 0,
        "91-120": 0,
        "120+": 0,
      }
    })

    // Categorize invoices by age
    invoices.forEach((invoice) => {
      const customerId = invoice.customer_id || "unknown"
      if (!customerMap[customerId]) {
        customerMap[customerId] = {
          name: invoice.customers?.name || "Unknown",
          "0-30": 0,
          "31-60": 0,
          "61-90": 0,
          "91-120": 0,
          "120+": 0,
        }
      }

      if (!invoice.created_at) return

      const invoiceDate = new Date(invoice.created_at)
      if (isNaN(invoiceDate.getTime())) return

      const daysOld = Math.floor(
        (now.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      const outstanding = ((invoice.amount || 0) - (invoice.amount_paid || 0)) || 0
      const bucket = customerMap[customerId]

      if (daysOld <= 30) {
        bucket["0-30"] += outstanding
      } else if (daysOld <= 60) {
        bucket["31-60"] += outstanding
      } else if (daysOld <= 90) {
        bucket["61-90"] += outstanding
      } else if (daysOld <= 120) {
        bucket["91-120"] += outstanding
      } else {
        bucket["120+"] += outstanding
      }
    })

    // Calculate summary buckets
    const summary = {
      "0-30": 0,
      "31-60": 0,
      "61-90": 0,
      "91-120": 0,
      "120+": 0,
    }

    Object.values(customerMap).forEach((customer) => {
      summary["0-30"] += customer["0-30"]
      summary["31-60"] += customer["31-60"]
      summary["61-90"] += customer["61-90"]
      summary["91-120"] += customer["91-120"]
      summary["120+"] += customer["120+"]
    })

    return { customerMap, summary }
  }, [invoices, customers])

  const filteredCustomers = useMemo(() => {
    const customers = Object.values(agingData.customerMap)
    if (!selectedCustomerId) return customers

    return customers.filter((c) => c.name === agingData.customerMap[selectedCustomerId]?.name)
  }, [agingData, selectedCustomerId])

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg">
        Error loading aging data: {error}
      </div>
    )
  }

  const summaryTotal =
    agingData.summary["0-30"] +
    agingData.summary["31-60"] +
    agingData.summary["61-90"] +
    agingData.summary["91-120"] +
    agingData.summary["120+"]

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard
          title="0-30 Days"
          amount={agingData.summary["0-30"]}
          bg="bg-green-900/20"
        />
        <SummaryCard
          title="31-60 Days"
          amount={agingData.summary["31-60"]}
          bg="bg-yellow-900/20"
        />
        <SummaryCard
          title="61-90 Days"
          amount={agingData.summary["61-90"]}
          bg="bg-orange-900/20"
        />
        <SummaryCard
          title="91-120 Days"
          amount={agingData.summary["91-120"]}
          bg="bg-red-900/20"
        />
        <SummaryCard
          title="120+ Days"
          amount={agingData.summary["120+"]}
          bg="bg-red-900/30"
        />
      </div>

      {/* Customer Filter */}
      <div className="bg-[#111827] border border-white/10 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Filter by Customer
        </label>
        <div className="w-full md:w-64">
          <SearchableSelect
            options={customers.map((c) => ({ id: c.id, name: c.name }))}
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
            placeholder="Select a customer..."
          />
        </div>
      </div>

      {/* Aging Table */}
      <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Customer Name
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                0-30 Days
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                31-60 Days
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                61-90 Days
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                91-120 Days
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                120+ Days
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No customers found
                </td>
              </tr>
            ) : (
              <>
                {filteredCustomers.map((customer) => {
                  const total =
                    customer["0-30"] +
                    customer["31-60"] +
                    customer["61-90"] +
                    customer["91-120"] +
                    customer["120+"]

                  return (
                    <tr
                      key={customer.name}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        {customer.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        ${(customer["0-30"] || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        ${(customer["31-60"] || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        ${(customer["61-90"] || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-300">
                        ${(customer["91-120"] || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-300">
                        ${(customer["120+"] || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-white font-medium">
                        ${(total || 0).toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
                {selectedCustomerId === "" && (
                  <tr className="border-t-2 border-white/10 bg-white/5 font-semibold">
                    <td className="px-4 py-3 text-sm text-white">Total</td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      ${(agingData.summary["0-30"] || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      ${(agingData.summary["31-60"] || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      ${(agingData.summary["61-90"] || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      ${(agingData.summary["91-120"] || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      ${(agingData.summary["120+"] || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white">
                      ${(summaryTotal || 0).toFixed(2)}
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({
  title,
  amount,
  bg,
}: {
  title: string
  amount: number
  bg: string
}) {
  return (
    <div className={`${bg} border border-white/10 rounded-lg p-4`}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">
        ${(amount || 0).toFixed(2)}
      </p>
    </div>
  )
}
