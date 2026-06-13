// components/ui/SortableHeader.tsx
"use client"

import type { SortDirection } from "@/hooks/useTableSort"

type SortableHeaderProps = {
  label: string
  sortKey: string
  currentSortKey: string | null
  currentDirection: SortDirection | null
  onSort: (key: string) => void
  className?: string
}

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  className = "",
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey

  return (
    <th
      className={`px-2 py-2 cursor-pointer select-none group/sort hover:text-gray-200 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase">{label}</span>
        <span className={`inline-flex flex-col -space-y-[3px] ${isActive ? "opacity-100" : "opacity-0 group-hover/sort:opacity-40"} transition-opacity`}>
          <svg
            className={`w-2.5 h-2.5 ${isActive && currentDirection === "asc" ? "text-[#FF8C21]" : "text-gray-600"}`}
            viewBox="0 0 10 6"
            fill="currentColor"
          >
            <path d="M5 0L10 6H0L5 0Z" />
          </svg>
          <svg
            className={`w-2.5 h-2.5 ${isActive && currentDirection === "desc" ? "text-[#FF8C21]" : "text-gray-600"}`}
            viewBox="0 0 10 6"
            fill="currentColor"
          >
            <path d="M5 6L0 0H10L5 6Z" />
          </svg>
        </span>
      </div>
    </th>
  )
}
