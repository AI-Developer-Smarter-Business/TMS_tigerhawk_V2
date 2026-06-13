"use client"

import { useEffect, useState } from "react"

/**
 * Returns null during SSR and the first client render so time-relative markup
 * matches the server HTML (avoids React hydration mismatches).
 */
export function useClientNow(): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
  }, [])

  return now
}
