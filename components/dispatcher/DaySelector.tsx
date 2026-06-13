"use client"

type DayFilterMode = "all" | "today" | "tomorrow" | "custom"

type Props = {
  mode: DayFilterMode
  selectedDate: Date
  onModeChange: (mode: DayFilterMode) => void
  onDateChange: (date: Date) => void
}

export function DaySelector({ mode, selectedDate, onModeChange, onDateChange }: Props) {
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    onDateChange(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    onDateChange(newDate)
  }

  const handleToday = () => {
    onModeChange("today")
  }

  const handleSelectChange = (value: string) => {
    if (value === "all" || value === "today" || value === "tomorrow") {
      onModeChange(value)
    } else {
      onModeChange("custom")
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3 bg-[#111827] rounded-lg border border-white/5">
      <div className="flex-1">
        <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Select The Day You Want To Work On
        </label>
        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => handleSelectChange(e.target.value)}
            className="px-3 py-1.5 bg-[#1a2332] border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50"
          >
            <option value="all" className="bg-[#1a2332] text-gray-300">All Days</option>
            <option value="today" className="bg-[#1a2332] text-gray-300">Today</option>
            <option value="tomorrow" className="bg-[#1a2332] text-gray-300">Tomorrow</option>
            <option value="custom" className="bg-[#1a2332] text-gray-300">Custom</option>
          </select>

          <button
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-300"
            title="Previous day"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <span className={`px-3 py-1.5 text-sm font-medium rounded-lg border min-w-fit ${
            mode !== "all"
              ? "text-white bg-[#E8700A]/10 border-[#E8700A]/30"
              : "text-gray-300 bg-white/5 border-white/10"
          }`}>
            {mode === "all" ? "All" : formatDate(selectedDate)}
          </span>

          <button
            onClick={handleNextDay}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-300"
            title="Next day"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5L15.75 12l-7.5 7.5" />
            </svg>
          </button>

          <button
            onClick={handleToday}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-gray-300"
            title="Today"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008Z" />
            </svg>
          </button>

          {mode !== "all" && (
            <button
              onClick={() => onModeChange("all")}
              className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-gray-300 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
