// components/ui/SearchableSelect.tsx
"use client"

import { useState, useRef, useEffect, useMemo } from "react"

type Option = { id: string; name: string }

type Props = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowFreeText?: boolean
}

export function SearchableSelect({ options, value, onChange, placeholder = "Search...", allowFreeText = false }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Resolve display text from current value
  const selectedOption = options.find(o => o.id === value || o.name === value)
  const displayText = selectedOption?.name || (allowFreeText ? value : "")

  const filtered = useMemo(() => {
    if (!query.trim()) return options.slice(0, 50) // Show first 50 by default
    const q = query.toLowerCase()
    return options.filter(o => o.name.toLowerCase().includes(q)).slice(0, 50)
  }, [options, query])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        // If allowFreeText, keep whatever they typed
        if (allowFreeText && query.trim() && !selectedOption) {
          onChange(query.trim())
        }
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }
  }, [open, query, allowFreeText, selectedOption, onChange])

  const handleInputChange = (val: string) => {
    setQuery(val)
    if (!open) setOpen(true)
  }

  const handleSelect = (opt: Option) => {
    onChange(allowFreeText ? opt.name : opt.id)
    setQuery("")
    setOpen(false)
  }

  const handleClear = () => {
    onChange("")
    setQuery("")
    setOpen(false)
  }

  const handleFocus = () => {
    setOpen(true)
    setQuery("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
    }
    if (e.key === "Enter" && allowFreeText && query.trim()) {
      // If there's an exact match, pick it; otherwise use free text
      const exact = filtered.find(o => o.name.toLowerCase() === query.toLowerCase())
      if (exact) {
        handleSelect(exact)
      } else {
        onChange(query.trim())
        setOpen(false)
      }
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : displayText}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-8 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-[#1a2332] border border-white/10 rounded-lg shadow-xl"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              {allowFreeText ? "No matches — press Enter to use custom value" : "No results found"}
            </div>
          ) : (
            filtered.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                  (opt.id === value || opt.name === value)
                    ? "text-[#FF8C21] bg-[#E8700A]/5"
                    : "text-gray-300"
                }`}
              >
                {opt.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
