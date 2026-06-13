"use client"

import { ErrorState } from "@/components/ui/ErrorState"

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      error={error}
      reset={reset}
      title="Something went wrong"
      homeHref="/portal"
      homeLinkText="Go to Portal Home"
    />
  )
}
