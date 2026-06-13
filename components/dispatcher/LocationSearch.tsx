"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

type OrgOption = {
  id: string
  name: string
  type: "Customer" | "Terminal" | "Warehouse" | "Yard"
  address?: string | null
  city?: string | null
  state?: string | null
}

export type OrgType = "Customer" | "Terminal" | "Warehouse" | "Yard"

type LocationSearchProps = {
  value: string
  onChange: (name: string) => void
  /** Called with full org object on selection (useful for getting id) */
  onSelect?: (org: { id: string; name: string; type: OrgType } | null) => void
  onBlur?: () => void
  /** Filter to only show specific org types */
  orgTypes?: OrgType[]
  placeholder?: string
  className?: string
}

// Module-level cache so all instances share the same org list
let orgCache: OrgOption[] | null = null
let orgCachePromise: Promise<OrgOption[]> | null = null

async function fetchAllOrgs(): Promise<OrgOption[]> {
  if (orgCache) return orgCache
  if (orgCachePromise) return orgCachePromise

  orgCachePromise = (async () => {
    const supabase = createClient()
    const [
      { data: custs },
      { data: terms },
      { data: whs },
      { data: yds },
    ] = await Promise.all([
      supabase.from("customers").select("id, name, address, city, state").order("name"),
      supabase.from("terminals").select("id, name, address, city, state").order("name"),
      supabase.from("warehouses").select("id, name, address, city, state").order("name"),
      supabase.from("yards").select("id, name, address, city, state").order("name"),
    ])

    const all: OrgOption[] = [
      ...(custs || []).map((o) => ({ ...o, type: "Customer" as const })),
      ...(terms || []).map((o) => ({ ...o, type: "Terminal" as const })),
      ...(whs || []).map((o) => ({ ...o, type: "Warehouse" as const })),
      ...(yds || []).map((o) => ({ ...o, type: "Yard" as const })),
    ]

    // Sort alphabetically by name
    all.sort((a, b) => a.name.localeCompare(b.name))
    orgCache = all
    return all
  })()

  return orgCachePromise
}

// Invalidate cache (call after adding a new org)
export function invalidateOrgCache() {
  orgCache = null
  orgCachePromise = null
}

const TYPE_COLORS: Record<string, string> = {
  Customer: "text-blue-400 bg-blue-400/10",
  Terminal: "text-emerald-400 bg-emerald-400/10",
  Warehouse: "text-amber-400 bg-amber-400/10",
  Yard: "text-purple-400 bg-purple-400/10",
}

export function LocationSearch({
  value,
  onChange,
  onSelect,
  onBlur,
  orgTypes,
  placeholder = "Search locations...",
  className = "",
}: LocationSearchProps) {
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load orgs
  useEffect(() => {
    fetchAllOrgs().then(setOrgs)
  }, [])

  // Apply type filter
  const typeFiltered = orgTypes ? orgs.filter((o) => orgTypes.includes(o.type)) : orgs

  // Filter orgs based on search term
  const filtered = search.trim()
    ? typeFiltered.filter((o) => {
        const q = search.toLowerCase()
        return (
          o.name.toLowerCase().includes(q) ||
          o.type.toLowerCase().includes(q) ||
          (o.city && o.city.toLowerCase().includes(q)) ||
          (o.state && o.state.toLowerCase().includes(q))
        )
      })
    : typeFiltered

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearch("")
        // Trigger save for any pending changes
        onBlur?.()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option]")
      items[highlightIndex]?.scrollIntoView({ block: "nearest" })
    }
  }, [highlightIndex])

  const selectOrg = useCallback(
    (org: OrgOption) => {
      onChange(org.name)
      onSelect?.({ id: org.id, name: org.name, type: org.type })
      setSearch("")
      setIsOpen(false)
      setHighlightIndex(-1)
      // Trigger blur save after selection
      setTimeout(() => onBlur?.(), 0)
    },
    [onChange, onSelect, onBlur]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightIndex((prev) => Math.max(prev - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          selectOrg(filtered[highlightIndex])
        }
        break
      case "Escape":
        setIsOpen(false)
        setSearch("")
        setHighlightIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleClear = () => {
    onChange("")
    onSelect?.(null)
    setSearch("")
    setTimeout(() => onBlur?.(), 0)
  }

  // Find current org details for the display
  const currentOrg = value ? typeFiltered.find((o) => o.name === value) || orgs.find((o) => o.name === value) : null

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Display current value or search input */}
      {isOpen ? (
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setHighlightIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
          className="w-full px-3 py-2 bg-white/5 border border-[#E8700A]/50 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true)
            setHighlightIndex(-1)
          }}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-left hover:border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 flex items-center gap-2"
        >
          {value ? (
            <>
              {currentOrg && (
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${TYPE_COLORS[currentOrg.type] || "text-gray-400 bg-gray-400/10"}`}>
                  {currentOrg.type.slice(0, 4)}
                </span>
              )}
              <span className="text-gray-300 truncate flex-1">{value}</span>
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
                className="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer flex-shrink-0"
                title="Clear"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </>
          ) : (
            <span className="text-gray-600">{placeholder}</span>
          )}
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-[#1F2937] border border-white/10 rounded-lg shadow-xl"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500 text-center">
              {search ? "No matching locations" : "Loading..."}
            </div>
          ) : (
            filtered.map((org, idx) => (
              <button
                key={`${org.type}-${org.id}`}
                data-option
                type="button"
                onClick={() => selectOrg(org)}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                  idx === highlightIndex
                    ? "bg-[#E8700A]/20 text-white"
                    : "hover:bg-white/5 text-gray-300"
                } ${value === org.name ? "bg-white/5" : ""}`}
              >
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${TYPE_COLORS[org.type] || ""}`}>
                  {org.type.slice(0, 4)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{org.name}</div>
                  {(org.city || org.state) && (
                    <div className="text-[10px] text-gray-500 truncate">
                      {[org.city, org.state].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
                {value === org.name && (
                  <svg className="w-4 h-4 text-[#E8700A] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
