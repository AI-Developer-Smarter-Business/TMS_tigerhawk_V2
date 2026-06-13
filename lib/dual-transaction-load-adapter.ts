import type { DualPairLoadSlice } from "@/lib/dual-transaction-savings"
import type { LoadWithRelations } from "@/types/dispatcher"

/** Map a `loads` row (+ optional joins) to the slice used for dual savings. */
export function rowToDualPairSlice(row: LoadWithRelations): DualPairLoadSlice {
  return {
    id: row.id,
    ssl: row.ssl ?? null,
    container_size: row.container_size ?? null,
    container_type: row.container_type ?? null,
    containers: row.containers ?? null,
    delivery_location: row.delivery_location ?? null,
    return_location: row.return_location ?? null,
    pickup_location: row.pickup_location ?? null,
  }
}
