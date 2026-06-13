"use client"

import { Download } from "lucide-react"

interface ReportExportButtonProps {
  onClick: () => void
  label?: string
  disabled?: boolean
}

export function ReportExportButton({ onClick, label = "Export CSV", disabled = false }: ReportExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm text-gray-300 hover:border-white/20 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="w-4 h-4" />
      {label}
    </button>
  )
}
