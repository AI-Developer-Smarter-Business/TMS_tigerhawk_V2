import { CardSkeleton } from "@/components/ui/LoadingSkeleton"

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="h-7 w-40 rounded bg-white/5 animate-pulse" />

      {/* Report filter bar */}
      <div className="flex gap-3">
        <div className="h-9 w-40 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-9 w-40 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-9 w-32 rounded-lg bg-white/5 animate-pulse" />
      </div>

      {/* Report cards */}
      <CardSkeleton count={6} />

      {/* Chart area placeholder */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
        <div className="h-64 rounded bg-white/5 animate-pulse" />
      </div>
    </div>
  )
}
