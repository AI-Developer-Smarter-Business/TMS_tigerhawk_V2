"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { LoadWithRelations, LoadDocument } from "@/types/dispatcher"
import { isDriverUploadDocument } from "@/lib/load-documents/enrich"
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh"

function formatDocumentDate(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  const yyyy = d.getUTCFullYear()
  return `${mm}/${dd}/${yyyy}`
}

const DOCUMENT_TYPES = [
  "BOL",
  "POD",
  "Rate Con",
  "Weight Ticket",
  "In-Gate Ticket",
  "Out-Gate Ticket",
  "Customs",
  "Photo",
  "Driver",
  "Other",
] as const

type DocumentsTabProps = {
  load: LoadWithRelations
  onUpdate?: (updates: Partial<LoadWithRelations>) => void
  onDocumentsChange?: () => void
}

export function DocumentsTab({ load, onDocumentsChange }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<LoadDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState<string>("Other")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/documents`, {
        cache: "no-store",
      })
      if (response.ok) {
        const data = await response.json()
        setDocuments(data.documents || [])
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error)
    } finally {
      setIsLoading(false)
    }
  }, [load.id])

  useEffect(() => {
    void fetchDocuments()
  }, [fetchDocuments])

  useRealtimeRefresh({
    tables: ["load_documents"],
    onRefresh: () => {
      void fetchDocuments()
      onDocumentsChange?.()
    },
    debounceMs: 300,
  })

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    handleFiles(files)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files) {
      handleFiles(files)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return
    setIsUploading(true)
    setUploadError(null)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        if (file.size > 52428800) {
          setUploadError(`${file.name} exceeds 50MB limit`)
          continue
        }

        const formData = new FormData()
        formData.append("file", file)
        formData.append("document_type", selectedDocType)

        const response = await fetch(`/api/dispatcher/loads/${load.id}/documents`, {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          setUploadError(errData.error || `Failed to upload ${file.name}`)
        }
      }
      await fetchDocuments()
      onDocumentsChange?.()
    } catch (error) {
      console.error("Failed to upload documents:", error)
      setUploadError("Upload failed — please try again")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Delete this document?")) return

    try {
      const response = await fetch(`/api/dispatcher/loads/${load.id}/documents/${docId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        await fetchDocuments()
        onDocumentsChange?.()
      }
    } catch (error) {
      console.error("Failed to delete document:", error)
    }
  }

  const handleDownloadDocument = (doc: LoadDocument) => {
    window.open(doc.url, "_blank")
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—"
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  const getDocTypeBadgeColor = (type: string, isDriverUpload: boolean) => {
    if (isDriverUpload || type === "Driver") {
      return "bg-[#E8700A]/20 text-[#FF8C21] border-[#E8700A]/35"
    }
    switch (type) {
      case "BOL": return "bg-blue-500/20 text-blue-300 border-blue-500/30"
      case "POD": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      case "Rate Con": return "bg-purple-500/20 text-purple-300 border-purple-500/30"
      case "Weight Ticket": return "bg-amber-500/20 text-amber-300 border-amber-500/30"
      case "In-Gate Ticket": return "bg-teal-500/20 text-teal-300 border-teal-500/30"
      case "Out-Gate Ticket": return "bg-orange-500/20 text-orange-300 border-orange-500/30"
      case "Customs": return "bg-red-500/20 text-red-300 border-red-500/30"
      case "Photo": return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
      default: return "bg-white/10 text-gray-400 border-white/10"
    }
  }

  const getRowClassName = (doc: LoadDocument) => {
    if (isDriverUploadDocument(doc)) {
      return "border-b border-[#E8700A]/15 bg-[#E8700A]/8 hover:bg-[#E8700A]/12"
    }
    return "border-b border-white/5 hover:bg-white/5"
  }

  if (isLoading) {
    return <div className="text-gray-400">Loading documents...</div>
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? "border-[#E8700A] bg-[#E8700A]/10"
            : "border-white/10 bg-[#1F2937] hover:border-white/20"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          disabled={isUploading}
          className="hidden"
          id="file-input"
        />

        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Document Type:</span>
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#E8700A]"
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type} className="bg-[#111827] text-white">
                {type}
              </option>
            ))}
          </select>
        </div>

        <label htmlFor="file-input" className="flex flex-col items-center gap-2 cursor-pointer">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-300">
              {isUploading ? "Uploading..." : "Drag files here or click to upload"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Max 50MB per file</p>
          </div>
        </label>
      </div>

      {uploadError && (
        <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
          {uploadError}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Rows with a soft orange background were uploaded by the assigned driver (mobile). Dispatch can delete any document.
      </p>

      <div className="overflow-x-auto bg-[#1F2937] rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-[#111827]">
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Filename</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
              <th className="text-right py-3 px-4 text-gray-400 font-semibold">Size</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Uploaded By</th>
              <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
              <th className="text-center py-3 px-4 text-gray-400 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-gray-500">
                  No documents yet. Upload one to get started.
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const driverUpload = isDriverUploadDocument(doc)
                return (
                  <tr key={doc.id} className={getRowClassName(doc)}>
                    <td className="py-3 px-4">
                      <div className="text-gray-300 truncate max-w-[240px]">{doc.filename}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getDocTypeBadgeColor(doc.document_type, driverUpload)}`}
                      >
                        {driverUpload && doc.document_type !== "Driver"
                          ? "Driver"
                          : doc.document_type || "Other"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-400">
                      {formatFileSize(doc.file_size)}
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {doc.uploaded_by_name || doc.uploaded_by || "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {formatDocumentDate(doc.uploaded_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDownloadDocument(doc)}
                          className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                          title="Download"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
