"use client"

/**
 * Reusable error state component for Next.js error boundaries.
 * All error.tsx files must be client components — this provides
 * a shared, theme-consistent error display with retry + navigation.
 */
export function ErrorState({
  error,
  reset,
  title = "Something went wrong",
  showHomeLink = true,
  homeHref = "/dashboard",
  homeLinkText = "Go to Dashboard",
}: {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  showHomeLink?: boolean
  homeHref?: string
  homeLinkText?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Error icon */}
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>

      <p className="text-gray-400 max-w-md mb-1">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>

      {error.digest && (
        <p className="text-xs text-gray-600 mb-6 font-mono">
          Error ID: {error.digest}
        </p>
      )}

      {!error.digest && <div className="mb-6" />}

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-[#E8700A] text-white text-sm font-medium rounded-lg hover:bg-[#FF8C21] transition-colors"
        >
          Try Again
        </button>

        {showHomeLink && (
          <a
            href={homeHref}
            className="px-5 py-2.5 bg-white/5 border border-white/10 text-gray-300 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors"
          >
            {homeLinkText}
          </a>
        )}
      </div>
    </div>
  )
}
