"use client"

import { useState } from "react"
import { Calendar, ChevronDown } from "lucide-react"

interface DateRangeSelectorProps {
  startDate: string
  endDate: string
  onDateChange: (start: string, end: string) => void
}

const presets = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "Year to Date", days: -1 },
  { label: "Custom", days: 0 },
]

function getPresetDates(days: number): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  if (days === -1) {
    // Year to Date
    start.setMonth(0, 1)
  } else if (days > 0) {
    start.setDate(start.getDate() - days)
  }
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

export function DateRangeSelector({ startDate, endDate, onDateChange }: DateRangeSelectorProps) {
  const [showPresets, setShowPresets] = useState(false)
  const [activePreset, setActivePreset] = useState("Last 30 Days")

  const handlePresetClick = (preset: typeof presets[number]) => {
    setActivePreset(preset.label)
    if (preset.days !== 0) {
      const { start, end } = getPresetDates(preset.days)
      onDateChange(start, end)
    }
    setShowPresets(false)
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex items-center gap-2 px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm text-gray-300 hover:border-white/20 transition-colors"
        >
          <Calendar className="w-4 h-4 text-gray-400" />
          {activePreset}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {showPresets && (
          <div className="absolute top-full left-0 mt-1 bg-[#1e2330] border border-white/10 rounded-lg shadow-xl z-50 min-w-[160px]">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  activePreset === preset.label ? "text-[#E8700A]" : "text-gray-300"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            onDateChange(e.target.value, endDate)
            setActivePreset("Custom")
          }}
          className="px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm text-gray-300 [color-scheme:dark]"
        />
        <span className="text-gray-500">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            onDateChange(startDate, e.target.value)
            setActivePreset("Custom")
          }}
          className="px-3 py-2 bg-[#111827] border border-white/10 rounded-lg text-sm text-gray-300 [color-scheme:dark]"
        />
      </div>
    </div>
  )
}
