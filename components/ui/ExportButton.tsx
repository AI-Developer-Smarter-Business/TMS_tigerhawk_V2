"use client"

import { Download } from "lucide-react"

type ExportButtonProps = {
  onClick: () => void
  count?: number
  label?: string
  disabled?: boolean
  className?: string
}

export function ExportButton({
  onClick,
  count,
  label,
  disabled,
  className = "",
}: ExportButtonProps) {
  const isDisabled = disabled || (count !== undefined && count === 0)

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title={`Export ${count ?? ""} rows to CSV`}
      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5
        ${isDisabled
          ? "bg-white/5 text-gray-600 border-white/5 cursor-not-allowed"
          : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200"
        } ${className}`}
    >
      <Download size={13} />
      {label || "Export"}{count !== undefined ? ` ${count}` : ""}
    </button>
  )
}
