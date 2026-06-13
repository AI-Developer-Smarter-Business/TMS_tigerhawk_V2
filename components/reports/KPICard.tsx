"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  trend?: {
    value: number
    label: string
  }
  icon?: React.ReactNode
  bg?: string
}

export function KPICard({ title, value, subtitle, trend, icon, bg = "bg-[#111827]" }: KPICardProps) {
  const trendColor = trend
    ? trend.value > 0
      ? "text-green-400"
      : trend.value < 0
      ? "text-red-400"
      : "text-gray-400"
    : ""

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
      ? TrendingDown
      : Minus
    : null

  return (
    <div className={`${bg} border border-white/10 rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
        {icon && <div className="text-gray-500">{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-white mt-2">{value}</p>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-1">
          {trend && TrendIcon && (
            <span className={`flex items-center gap-1 text-xs ${trendColor}`}>
              <TrendIcon className="w-3 h-3" />
              {Math.abs(trend.value)}% {trend.label}
            </span>
          )}
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      )}
    </div>
  )
}
