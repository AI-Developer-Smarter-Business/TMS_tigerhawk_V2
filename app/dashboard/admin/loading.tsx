import { TableSkeleton } from "@/components/ui/LoadingSkeleton"

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="h-7 w-44 rounded bg-white/5 animate-pulse" />
      <TableSkeleton rows={8} cols={5} />
    </div>
  )
}
