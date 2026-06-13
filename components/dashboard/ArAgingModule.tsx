// components/dashboard/ArAgingModule.tsx
// Shows outstanding invoices grouped by aging buckets
"use client"

import { ModuleCard } from "./ModuleCard"

interface ArInvoice {
  id: string
  invoice_number: string
  customer_name: string | null
  amount: number
  amount_paid: number
  due_date: string | null
  billing_status: string
}

interface ArAgingModuleProps {
  invoices: ArInvoice[]
}

type AgingBucket = "current" | "1_30" | "31_60" | "61_90" | "over_90"

const BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  over_90: "90+ days",
}

const BUCKET_COLORS: Record<AgingBucket, { bar: string; text: string }> = {
  current: { bar: "bg-emerald-500", text: "text-emerald-400" },
  "1_30": { bar: "bg-blue-500", text: "text-blue-400" },
  "31_60": { bar: "bg-amber-500", text: "text-amber-400" },
  "61_90": { bar: "bg-orange-500", text: "text-orange-400" },
  over_90: { bar: "bg-red-500", text: "text-red-400" },
}

function getBucket(dueDateStr: string | null): AgingBucket {
  if (!dueDateStr) return "current"
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const daysOverdue = Math.floor(
    (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysOverdue <= 0) return "current"
  if (daysOverdue <= 30) return "1_30"
  if (daysOverdue <= 60) return "31_60"
  if (daysOverdue <= 90) return "61_90"
  return "over_90"
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ArAgingModule({ invoices }: ArAgingModuleProps) {
  // Only outstanding invoices (not Paid, not Voided, not consolidated into batch)
  const outstanding = invoices.filter(
    (inv) =>
      inv.billing_status !== "Paid" &&
      inv.billing_status !== "Voided" &&
      inv.billing_status !== "Consolidated"
  )

  // Group by bucket
  const buckets: Record<AgingBucket, { count: number; amount: number }> = {
    current: { count: 0, amount: 0 },
    "1_30": { count: 0, amount: 0 },
    "31_60": { count: 0, amount: 0 },
    "61_90": { count: 0, amount: 0 },
    over_90: { count: 0, amount: 0 },
  }

  for (const inv of outstanding) {
    const bucket = getBucket(inv.due_date)
    buckets[bucket].count++
    buckets[bucket].amount += inv.amount - inv.amount_paid
  }

  const totalOutstanding = outstanding.reduce(
    (sum, inv) => sum + (inv.amount - inv.amount_paid),
    0
  )
  const maxBucketAmount = Math.max(
    ...Object.values(buckets).map((b) => b.amount),
    1
  )

  return (
    <ModuleCard
      title="AR Aging"
      linkHref="/dashboard/accounts-receivable"
      linkText="Details"
    >
      {/* Total */}
      <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-xs text-gray-500">Total Outstanding</span>
        <span className="text-lg font-bold text-white">
          {formatCurrency(totalOutstanding)}
        </span>
      </div>

      {/* Aging bars */}
      <div className="px-6 py-4 space-y-3">
        {(Object.entries(buckets) as [AgingBucket, { count: number; amount: number }][]).map(
          ([bucket, data]) => {
            const colors = BUCKET_COLORS[bucket]
            const pct =
              maxBucketAmount > 0
                ? Math.max((data.amount / maxBucketAmount) * 100, data.amount > 0 ? 4 : 0)
                : 0
            return (
              <div key={bucket}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">
                    {BUCKET_LABELS[bucket]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">
                      {data.count} inv
                    </span>
                    <span className={`text-xs font-medium ${colors.text}`}>
                      {formatCurrency(data.amount)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5">
                  <div
                    className={`${colors.bar} h-1.5 rounded-full transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          }
        )}
      </div>
    </ModuleCard>
  )
}
