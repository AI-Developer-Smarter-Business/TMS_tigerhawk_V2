import { TableSkeleton } from "@/components/ui/LoadingSkeleton"

export default function DispatcherLoading() {
  return (
    <div className="space-y-6">
      {/* Tab bar placeholder */}
      <div className="flex gap-1 border-b border-white/5 pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded bg-white/5 animate-pulse" />
        ))}
      </div>
      <TableSkeleton rows={10} cols={7} />
    </div>
  )
}
