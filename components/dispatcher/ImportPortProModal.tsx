"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import { mapPortProRow, type PortProRow } from "@/lib/portpro/mapRow"

interface ImportPortProModalProps {
  open: boolean
  onClose: () => void
}

type ImportStage = "idle" | "preview" | "importing" | "done"

interface ImportResult {
  loadsImported: number
  loadsUpdated: number
  containersCreated: number
  containersUpdated: number
  customersCreated: number
  driversCreated: number
  errors: string[]
}

const BATCH_SIZE = 50

export function ImportPortProModal({ open, onClose }: ImportPortProModalProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<ImportStage>("idle")
  const [fileName, setFileName] = useState("")
  const [rawRows, setRawRows] = useState<PortProRow[]>([])
  const [mappedCount, setMappedCount] = useState(0)
  const [containerCount, setContainerCount] = useState(0)
  const [previewSample, setPreviewSample] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteExisting, setDeleteExisting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const reset = useCallback(() => {
    setStage("idle")
    setFileName("")
    setRawRows([])
    setMappedCount(0)
    setContainerCount(0)
    setPreviewSample([])
    setProgress(0)
    setResult(null)
    setError(null)
    setDeleteExisting(false)
    setShowDeleteConfirm(false)
    if (fileRef.current) fileRef.current.value = ""
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  // ── File selection + parsing ───────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setError(null)
      setFileName(file.name)

      Papa.parse<PortProRow>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(
              `CSV parse error: ${results.errors[0].message} (row ${results.errors[0].row})`,
            )
            return
          }

          const rows = results.data
          if (rows.length === 0) {
            setError("CSV file is empty")
            return
          }

          // Check for required "Load #" column
          if (!rows[0]["Load #"] && rows[0]["Load #"] !== "") {
            setError(
              'Missing required "Load #" column. Is this a PortPro export?',
            )
            return
          }

          setRawRows(rows)

          // Map rows and count
          let mapped = 0
          let withContainer = 0
          const samples: string[] = []

          for (const row of rows) {
            const result = mapPortProRow(row)
            if (result) {
              mapped++
              if (result.container) withContainer++
              if (samples.length < 5) {
                const ref = result.load.reference_number
                const ctn = result.container?.container_number || "(no container)"
                const customer = result.load.customer_name || "(no customer)"
                const status = result.load.status
                samples.push(`${ref} | ${ctn} | ${customer} | ${status}`)
              }
            }
          }

          setMappedCount(mapped)
          setContainerCount(withContainer)
          setPreviewSample(samples)
          setStage("preview")
        },
        error: (err) => {
          setError(`Failed to read file: ${err.message}`)
        },
      })
    },
    [],
  )

  // ── Import execution ──────────────────────────────────
  const handleImport = useCallback(async () => {
    // If delete is checked but not yet confirmed, show confirmation
    if (deleteExisting && !showDeleteConfirm) {
      setShowDeleteConfirm(true)
      return
    }

    setStage("importing")
    setProgress(0)
    setError(null)

    // If deleteExisting, call the delete endpoint first
    if (deleteExisting) {
      try {
        const delResponse = await fetch("/api/dispatcher/import", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        })
        if (!delResponse.ok) {
          const delData = await delResponse.json().catch(() => ({}))
          setError(`Failed to delete existing data: ${delData.error || delResponse.statusText}`)
          setStage("preview")
          return
        }
      } catch (err) {
        setError(`Failed to delete existing data: ${err instanceof Error ? err.message : "Network error"}`)
        setStage("preview")
        return
      }
    }

    // Map all rows
    const mapped = rawRows
      .map(mapPortProRow)
      .filter(
        (r): r is NonNullable<ReturnType<typeof mapPortProRow>> => r !== null,
      )

    const totalBatches = Math.ceil(mapped.length / BATCH_SIZE)
    const accum: ImportResult = {
      loadsImported: 0,
      loadsUpdated: 0,
      containersCreated: 0,
      containersUpdated: 0,
      customersCreated: 0,
      driversCreated: 0,
      errors: [],
    }

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1

      try {
        const response = await fetch("/api/dispatcher/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batch }),
        })

        const contentType = response.headers.get("content-type") || ""
        if (!contentType.includes("application/json")) {
          throw new Error(
            `Server returned ${response.status} (${response.statusText})`,
          )
        }

        const data = await response.json()

        if (!response.ok) {
          accum.errors.push(
            `Batch ${batchNum}: ${data.error || response.statusText}`,
          )
        } else {
          accum.loadsImported += data.loadsImported || 0
          accum.loadsUpdated += data.loadsUpdated || 0
          accum.containersCreated += data.containersCreated || 0
          accum.containersUpdated += data.containersUpdated || 0
          accum.customersCreated += data.customersCreated || 0
          accum.driversCreated += data.driversCreated || 0
          if (data.errors?.length) {
            accum.errors.push(
              ...data.errors.map((e: string) => `Batch ${batchNum}: ${e}`),
            )
          }
        }
      } catch (err) {
        accum.errors.push(
          `Batch ${batchNum}: ${err instanceof Error ? err.message : "Network error"}`,
        )
      }

      setProgress(Math.round((batchNum / totalBatches) * 100))
    }

    setResult(accum)
    setStage("done")

    // Refresh dispatcher data after a short delay
    setTimeout(() => router.refresh(), 1000)
  }, [rawRows, router, deleteExisting, showDeleteConfirm])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-[#111827] border border-white/10 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-semibold text-white">
            Import from PortPro
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[calc(100vh-14rem)] overflow-y-auto">
          {/* ── Stage: idle — file picker ───────────── */}
          {stage === "idle" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Upload a CSV file exported from PortPro. All loads and
                containers will be imported or updated.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 py-8 border-2 border-dashed border-white/10 rounded-xl text-gray-400 hover:border-[#E8700A]/40 hover:text-gray-300 transition-colors cursor-pointer"
              >
                <svg
                  className="w-10 h-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                  />
                </svg>
                <span className="text-sm font-medium">
                  Click to select CSV file
                </span>
              </button>

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Stage: preview ──────────────────────── */}
          {stage === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  {fileName}
                </div>
                <button
                  onClick={reset}
                  className="text-gray-500 hover:text-gray-300 text-xs underline"
                >
                  Change file
                </button>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Total Loads" value={mappedCount} />
                <StatBox label="With Container" value={containerCount} />
                <StatBox
                  label="Without Container"
                  value={mappedCount - containerCount}
                />
              </div>

              {/* Sample preview */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                  Preview (first 5 rows)
                </p>
                <div className="rounded-lg border border-white/5 bg-white/[0.02] divide-y divide-white/5 text-xs font-mono text-gray-400">
                  <div className="px-3 py-2 text-gray-500 font-sans font-medium">
                    Load # | Container # | Customer | Status
                  </div>
                  {previewSample.map((line, i) => (
                    <div key={i} className="px-3 py-2">
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Existing loads (by Load #) and containers (by Container #) will
                be updated. New records will be created. Missing customers and
                drivers will be auto-created.
              </p>

              {/* Delete existing toggle */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteExisting}
                    onChange={(e) => {
                      setDeleteExisting(e.target.checked)
                      if (!e.target.checked) setShowDeleteConfirm(false)
                    }}
                    className="mt-0.5 rounded border-white/20 bg-white/5 text-[#E8700A] focus:ring-[#E8700A]/50"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-300">
                      Delete all existing loads &amp; containers first
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Removes all current loads and containers before importing.
                      Use this for a clean sync from PortPro.
                    </p>
                  </div>
                </label>
              </div>

              {deleteExisting && !showDeleteConfirm && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <strong>Warning:</strong> This will permanently delete all
                  existing loads and containers before importing. This action
                  cannot be undone.
                </div>
              )}

              {showDeleteConfirm && (
                <div className="px-3 py-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-sm font-medium text-center">
                  Are you sure? All existing loads and containers will be
                  permanently deleted. Click &quot;Confirm Delete &amp; Import&quot; to proceed.
                </div>
              )}

              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── Stage: importing ────────────────────── */}
          {stage === "importing" && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-300 text-center">
                Importing {mappedCount} loads...
              </p>

              {/* Progress bar */}
              <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-[#E8700A] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-center text-sm text-gray-500">{progress}%</p>
            </div>
          )}

          {/* ── Stage: done ─────────────────────────── */}
          {stage === "done" && result && (
            <div className="space-y-4">
              {/* Success / partial success header */}
              <div
                className={`flex items-center gap-2 text-sm font-medium ${
                  result.errors.length === 0
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={
                      result.errors.length === 0
                        ? "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                        : "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                    }
                  />
                </svg>
                {result.errors.length === 0
                  ? "Import completed successfully"
                  : "Import completed with some errors"}
              </div>

              {/* Result stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Loads Created" value={result.loadsImported} />
                <StatBox label="Loads Updated" value={result.loadsUpdated} />
                <StatBox
                  label="Containers Created"
                  value={result.containersCreated}
                />
                <StatBox
                  label="Containers Updated"
                  value={result.containersUpdated}
                />
                <StatBox
                  label="Customers Created"
                  value={result.customersCreated}
                />
                <StatBox
                  label="Drivers Created"
                  value={result.driversCreated}
                />
              </div>

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-red-400">
                    {result.errors.length} error(s):
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded-lg bg-red-500/5 border border-red-500/10 p-2 space-y-1">
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-400 font-mono">
                        {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
          {stage === "preview" && (
            <>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  handleClose()
                }}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              {showDeleteConfirm ? (
                <button
                  onClick={handleImport}
                  className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-500 transition-colors"
                >
                  Confirm Delete &amp; Import
                </button>
              ) : (
                <button
                  onClick={handleImport}
                  className={`px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                    deleteExisting
                      ? "bg-red-600 hover:bg-red-500"
                      : "bg-[#E8700A] hover:bg-[#FF8C21]"
                  }`}
                >
                  {deleteExisting
                    ? `Delete All & Import ${mappedCount} Loads`
                    : `Import ${mappedCount} Loads`}
                </button>
              )}
            </>
          )}

          {stage === "done" && (
            <button
              onClick={handleClose}
              className="px-5 py-2 bg-white/5 border border-white/10 text-gray-300 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-white mt-0.5">{value}</p>
    </div>
  )
}
