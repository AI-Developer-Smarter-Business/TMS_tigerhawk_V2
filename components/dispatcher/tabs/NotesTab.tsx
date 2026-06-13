"use client"

import { useState, useEffect } from "react"
import { LoadWithRelations } from "@/types/dispatcher"

type NotesTabProps = {
  load: LoadWithRelations
  onUpdate: (updates: Partial<LoadWithRelations>) => void
}

export function NotesTab({ load, onUpdate }: NotesTabProps) {
  const [notes, setNotes] = useState(load.notes || "")
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved")

  useEffect(() => {
    setNotes(load.notes || "")
  }, [load])

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value)
    setSaveStatus("unsaved")
  }

  const handleBlur = async () => {
    if (saveStatus === "unsaved") {
      await saveNotes()
    }
  }

  const saveNotes = async () => {
    setIsSaving(true)
    setSaveStatus("saving")
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes || null }),
      })
      if (response.ok) {
        const updated = await response.json()
        setLastSaved(new Date())
        setSaveStatus("saved")
        onUpdate(updated)
      } else {
        setSaveStatus("unsaved")
      }
    } catch (error) {
      console.error("Failed to save notes:", error)
      setSaveStatus("unsaved")
    } finally {
      setIsSaving(false)
    }
  }

  const characterCount = notes.length
  const wordCount = notes.trim().split(/\s+/).filter(w => w.length > 0).length

  return (
    <div className="h-full flex flex-col">
      {/* Header with save status */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
        <div>
          <h4 className="text-sm font-semibold text-white">Load Notes</h4>
          <p className="text-xs text-gray-500 mt-1">Add any special instructions or notes about this load</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-xs font-medium ${
              saveStatus === "saved" ? "text-emerald-400" :
              saveStatus === "saving" ? "text-[#FF8C21]" :
              "text-amber-400"
            }`}>
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "saving" && "Saving..."}
              {saveStatus === "unsaved" && "Unsaved changes"}
            </div>
            {lastSaved && (
              <div className="text-xs text-gray-500 mt-1">
                Last saved: {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
          {saveStatus === "unsaved" && (
            <button
              onClick={saveNotes}
              disabled={isSaving}
              className="px-3 py-1.5 rounded-lg bg-[#E8700A] text-white text-xs font-medium hover:bg-[#FF8C21] transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Textarea */}
      <textarea
        value={notes}
        onChange={handleNotesChange}
        onBlur={handleBlur}
        placeholder="Enter notes here... You can use markdown formatting."
        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#E8700A]/40 focus:border-[#E8700A]/50 resize-none"
      />

      {/* Footer stats */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <span className="text-xs text-gray-500">Characters:</span>
            <span className="text-sm font-mono text-gray-300 ml-2">{characterCount}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500">Words:</span>
            <span className="text-sm font-mono text-gray-300 ml-2">{wordCount}</span>
          </div>
        </div>
        <div className="text-xs text-gray-600">
          Auto-saves when you click outside or manually save anytime
        </div>
      </div>
    </div>
  )
}
