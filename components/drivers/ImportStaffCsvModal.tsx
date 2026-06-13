"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import type { CsvImportEntity } from "@/lib/csv-import/staff-schemas"
import { FileUp, X } from "lucide-react"

type ImportStaffCsvModalProps = {
  open: boolean
  onClose: () => void
  entity: CsvImportEntity
  templateUrl: string
  title: string
}

export function ImportStaffCsvModal({
  open,
  onClose,
  entity,
  templateUrl,
  title,
}: ImportStaffCsvModalProps) {
  const router = useRouter()
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  const reset = useCallback(() => {
    setFileName(null)
    setError(null)
    setBusy(false)
    setPreviewCount(null)
  }, [])

  const handleClose = () => {
    if (!busy) {
      reset()
      onClose()
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setFileName(file.name)
    setPreviewCount(null)

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(
            `CSV parse error: ${results.errors[0].message} (row ${results.errors[0].row})`,
          )
          return
        }
        const data = results.data.filter(
          (row) => Object.values(row).some((v) => String(v ?? "").trim() !== ""),
        )
        if (data.length === 0) {
          setError("No data rows in file")
          return
        }
        setPreviewCount(data.length)
        void runImport(data)
      },
      error: (err) => setError(err.message),
    })
    e.target.value = ""
  }

  const runImport = async (data: Record<string, unknown>[]) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/csv-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, rows: data }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const details = Array.isArray(json.details)
          ? json.details.join("\n")
          : null
        throw new Error(
          details || json.error || `Import failed (${res.status})`,
        )
      }
      reset()
      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Close"
        onClick={handleClose}
        disabled={busy}
      />
      <div className="relative bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileUp className="w-5 h-5 text-[#E8700A]" />
              {title}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              UTF-8 CSV with header row. See template in{" "}
              <code className="text-gray-300">docs/</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <a
          href={templateUrl}
          className="text-sm text-[#E8700A] hover:underline mb-4 inline-block"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download column template (example)
        </a>

        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-white/15 rounded-lg cursor-pointer hover:border-[#E8700A]/50 transition-colors">
          <span className="text-sm text-gray-400">
            {busy ? "Importing…" : "Choose CSV file"}
          </span>
          {fileName && !busy && (
            <span className="text-xs text-gray-500 mt-1 truncate max-w-full px-2">
              {fileName}
              {previewCount !== null ? ` · ${previewCount} rows` : ""}
            </span>
          )}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={busy}
            onChange={handleFile}
          />
        </label>

        {error && (
          <pre className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300 whitespace-pre-wrap wrap-break-word max-h-40 overflow-y-auto">
            {error}
          </pre>
        )}

        <p className="mt-4 text-xs text-gray-500">
          Upsert: drivers match by <strong className="text-gray-400">id</strong>{" "}
          (if valid) then <strong className="text-gray-400">phone</strong>.
          Groups match by <strong className="text-gray-400">id</strong> then{" "}
          <strong className="text-gray-400">name</strong> (case-insensitive).
          All rows run in a single database transaction.
        </p>
      </div>
    </div>
  )
}
