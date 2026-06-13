// components/dashboard/ModuleCard.tsx
// Shared wrapper for all dashboard modules
"use client"

import React from "react"

interface ModuleCardProps {
  title: string
  linkHref?: string
  linkText?: string
  children: React.ReactNode
  className?: string
}

export function ModuleCard({
  title,
  linkHref,
  linkText = "View all",
  children,
  className = "",
}: ModuleCardProps) {
  return (
    <div
      className={`bg-[#111827] rounded-xl border border-white/5 ${className}`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {linkHref && (
          <a
            href={linkHref}
            className="text-xs text-[#E8700A] font-medium hover:text-[#FF8C21]"
          >
            {linkText}
          </a>
        )}
      </div>
      {children}
    </div>
  )
}
