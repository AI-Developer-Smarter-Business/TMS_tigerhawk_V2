/**
 * Reusable loading skeleton components for Next.js loading.tsx files.
 * Animated pulse placeholders matching the dark TMS theme.
 */

function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/5 ${className}`}
    />
  )
}

/** Skeleton for a row of stat cards (used on dashboard home) */
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-3"
        >
          <SkeletonBar className="h-3 w-20" />
          <SkeletonBar className="h-7 w-28" />
          <SkeletonBar className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

/** Skeleton for a data table (used in dispatcher, AR, AP sections) */
export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
      {/* Table header */}
      <div className="border-b border-white/5 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBar
            key={i}
            className="h-3 flex-1"
            // First column wider
          />
        ))}
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="border-b border-white/5 last:border-b-0 px-4 py-3.5 flex gap-4"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <SkeletonBar
              key={colIdx}
              className="h-3 flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Full page skeleton: header area + stat cards + table */
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page title area */}
      <div className="flex items-center justify-between">
        <SkeletonBar className="h-7 w-48" />
        <SkeletonBar className="h-9 w-32 rounded-lg" />
      </div>

      {/* Stat cards row */}
      <CardSkeleton count={4} />

      {/* Filter/search bar */}
      <div className="flex gap-3">
        <SkeletonBar className="h-9 w-64 rounded-lg" />
        <SkeletonBar className="h-9 w-32 rounded-lg" />
        <SkeletonBar className="h-9 w-32 rounded-lg" />
      </div>

      {/* Main data table */}
      <TableSkeleton rows={8} cols={6} />
    </div>
  )
}
