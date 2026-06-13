// components/search/GlobalSearch.tsx
"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

type SearchResult = {
  id: string
  type: "load" | "container" | "driver" | "vessel" | "customer"
  title: string
  subtitle: string | null
  url: string
}

const CATEGORY_CONFIG: Record<
  SearchResult["type"],
  { label: string; icon: React.ReactNode; color: string }
> = {
  load: {
    label: "Loads",
    color: "text-[#FF8C21]",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  container: {
    label: "Containers",
    color: "text-blue-400",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
  },
  driver: {
    label: "Drivers",
    color: "text-emerald-400",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  vessel: {
    label: "Vessels",
    color: "text-purple-400",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  customer: {
    label: "Customers",
    color: "text-amber-400",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
      </svg>
    ),
  },
}

const CATEGORY_ORDER: SearchResult["type"][] = ["load", "container", "driver", "vessel", "customer"]

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [isMac, setIsMac] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Detect Mac on client only to avoid hydration mismatch
  useEffect(() => {
    setIsMac(navigator.userAgent.includes("Mac"))
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    const timeout = setTimeout(async () => {
      // Abort any in-flight request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("Search failed")
        const data = await res.json()
        setResults(data.results || [])
        setOpen(true)
        setHighlightIndex(-1)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error("Search error:", err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      clearTimeout(timeout)
    }
  }, [query])

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Group results by type
  const grouped = CATEGORY_ORDER.map((type) => ({
    type,
    items: results.filter((r) => r.type === type),
  })).filter((g) => g.items.length > 0)

  // Flat list for keyboard nav
  const flatItems = grouped.flatMap((g) => g.items)

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false)
      setQuery("")
      inputRef.current?.blur()
      router.push(result.url)
    },
    [router]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || flatItems.length === 0) {
      if (e.key === "Escape") {
        setOpen(false)
        inputRef.current?.blur()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1))
        break
      case "Enter":
        e.preventDefault()
        if (highlightIndex >= 0 && highlightIndex < flatItems.length) {
          handleSelect(flatItems[highlightIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        setOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown)
    return () => document.removeEventListener("keydown", handleGlobalKeyDown)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search loads, containers, drivers..."
          className="w-full pl-10 pr-16 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
        />
        {/* Kbd shortcut hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5">
          {loading ? (
            <Loader2 size={14} className="text-gray-500 animate-spin" />
          ) : (
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-gray-500 bg-white/5 border border-white/10 rounded">
              {isMac ? "\u2318K" : "Ctrl+K"}
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2030] border border-white/10 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 max-h-[420px] overflow-y-auto">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              No results for &quot;{query}&quot;
            </div>
          ) : (
            grouped.map((group) => {
              const config = CATEGORY_CONFIG[group.type]
              return (
                <div key={group.type}>
                  {/* Category Header */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111827] border-b border-white/5">
                    <span className={config.color}>{config.icon}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-[10px] text-gray-600">({group.items.length})</span>
                  </div>
                  {/* Items */}
                  {group.items.map((item) => {
                    const flatIdx = flatItems.indexOf(item)
                    const isHighlighted = flatIdx === highlightIndex
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setHighlightIndex(flatIdx)}
                        className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors ${
                          isHighlighted
                            ? "bg-[#E8700A]/10"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div className="text-xs text-gray-500 truncate mt-0.5">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                        <svg
                          className={`w-3.5 h-3.5 mt-1 flex-shrink-0 transition-opacity ${
                            isHighlighted ? "text-gray-400 opacity-100" : "opacity-0"
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
