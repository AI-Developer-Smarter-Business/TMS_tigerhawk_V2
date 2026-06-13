"use client"

/**
 * Global error boundary — catches errors in the root layout itself.
 * Must include its own <html> and <body> tags since it replaces
 * the root layout when triggered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="bg-[#0B1120] text-white antialiased">
        <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
          {/* Error icon */}
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-8">
            <svg
              className="w-10 h-10 text-red-400"
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

          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-400 max-w-md mb-2">
            An unexpected error occurred. Please try refreshing the page.
          </p>

          {error.digest && (
            <p className="text-xs text-gray-600 mb-8 font-mono">
              Error ID: {error.digest}
            </p>
          )}

          {!error.digest && <div className="mb-8" />}

          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="px-6 py-3 bg-[#E8700A] text-white font-medium rounded-lg hover:bg-[#FF8C21] transition-colors"
            >
              Try Again
            </button>
            <a
              href="/dashboard"
              className="px-6 py-3 bg-white/5 border border-white/10 text-gray-300 font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
