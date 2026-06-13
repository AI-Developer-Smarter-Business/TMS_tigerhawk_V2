// hooks/useTableSort.ts
"use client"

import { useState, useMemo, useCallback } from "react"

export type SortDirection = "asc" | "desc"

export type SortConfig<T> = {
  key: keyof T | string
  direction: SortDirection
} | null

/**
 * Generic hook for sortable tables.
 *
 * Usage:
 *   const { sortedData, sortConfig, requestSort } = useTableSort(filtered, null)
 *
 * Pass a `getValue` map to handle derived/nested values:
 *   useTableSort(filtered, null, {
 *     customerName: (row) => row.customers?.name ?? "",
 *   })
 */
export function useTableSort<T extends Record<string, unknown>>(
  data: T[],
  defaultSort: SortConfig<T> = null,
  getValue?: Record<string, (row: T) => unknown>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(defaultSort)

  const requestSort = useCallback(
    (key: keyof T | string) => {
      setSortConfig((prev) => {
        if (prev && prev.key === key) {
          // Toggle direction, then reset on third click
          if (prev.direction === "asc") return { key, direction: "desc" }
          return null // Reset — back to default order
        }
        return { key, direction: "asc" }
      })
    },
    []
  )

  const sortedData = useMemo(() => {
    if (!sortConfig) return data

    const { key, direction } = sortConfig

    return [...data].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown

      // Use custom getter if provided
      if (getValue && key in getValue) {
        aVal = getValue[key as string](a)
        bVal = getValue[key as string](b)
      } else {
        aVal = a[key as keyof T]
        bVal = b[key as keyof T]
      }

      // Nulls / undefined / empty strings always go last regardless of direction
      const aEmpty = aVal === null || aVal === undefined || aVal === ""
      const bEmpty = bVal === null || bVal === undefined || bVal === ""
      if (aEmpty && bEmpty) return 0
      if (aEmpty) return 1
      if (bEmpty) return -1

      let comparison = 0

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        // true before false in ascending
        comparison = aVal === bVal ? 0 : aVal ? -1 : 1
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal
      } else {
        // String comparison — handles dates (ISO strings sort lexicographically)
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        comparison = aStr.localeCompare(bStr, undefined, { numeric: true })
      }

      return direction === "asc" ? comparison : -comparison
    })
  }, [data, sortConfig, getValue])

  return { sortedData, sortConfig, requestSort }
}
