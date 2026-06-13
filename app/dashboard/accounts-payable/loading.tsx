import { TableSkeleton } from "@/components/ui/LoadingSkeleton"

export default function APLoading() {
  return (
    <div className="space-y-6">
      {/* Tab bar placeholder */}
      <div className="flex gap-1 border-b border-white/5 pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded bg-white/5 animate-pulse" />
        ))}
      </div>
      <TableSkeleton rows={10} cols={6} />
    </div>
  )
}
