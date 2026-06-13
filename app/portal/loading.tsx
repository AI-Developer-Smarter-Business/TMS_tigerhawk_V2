import { TableSkeleton } from "@/components/ui/LoadingSkeleton"

export default function PortalLoading() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="h-7 w-36 rounded bg-white/5 animate-pulse" />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3"
          >
            <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
            <div className="h-7 w-16 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>

      <TableSkeleton rows={6} cols={4} />
    </div>
  )
}
