// components/portal/PortalDocumentsClient.tsx
"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { PortalDocument } from "@/types/portal"
import { formatDate } from "@/lib/utils"
import { exportToCSV, type ExportColumn, formatDateForExport } from "@/lib/exportCSV"
import { ExportButton } from "@/components/ui/ExportButton"

type Props = {
  documents: PortalDocument[]
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function PortalDocumentsClient({ documents }: Props) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("All")

  // Extract unique document types
  const typeOptions = useMemo(() => {
    const set = new Set<string>()
    documents.forEach((d) => { if (d.document_type) set.add(d.document_type) })
    return Array.from(set).sort()
  }, [documents])

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (typeFilter !== "All" && doc.document_type !== typeFilter) return false
      if (!search) return true
      const s = search.toLowerCase()
      return (
        doc.filename?.toLowerCase().includes(s) ||
        doc.document_type?.toLowerCase().includes(s) ||
        doc.load_reference_number?.toLowerCase().includes(s)
      )
    })
  }, [documents, search, typeFilter])

  const docExportColumns: ExportColumn<PortalDocument>[] = [
    { header: "Filename", accessor: (d) => d.filename },
    { header: "Type", accessor: (d) => d.document_type },
    { header: "Load #", accessor: (d) => d.load_reference_number },
    { header: "File Size", accessor: (d) => formatFileSize(d.file_size) },
    { header: "Uploaded", accessor: (d) => formatDateForExport(d.uploaded_at) },
  ]

  const handleExportDocs = () => {
    exportToCSV("portal-documents", docExportColumns, filteredDocs)
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by filename, load #, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#0B1120] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#E8700A]/50"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-[#0B1120] border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-[#E8700A]/50"
        >
          <option value="All">All Types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <ExportButton onClick={handleExportDocs} count={filteredDocs.length} />
      </div>

      {/* Results */}
      <p className="text-xs text-gray-500">
        Showing {filteredDocs.length} of {documents.length} documents
      </p>

      {/* Table */}
      <div className="bg-[#141922] border border-[#1e2530] rounded-xl overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No documents found
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="divide-y divide-[#1e2530]/60 sm:hidden">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="px-4 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm text-white font-medium truncate">
                          {doc.filename}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-300">
                          {doc.document_type}
                        </span>
                        <Link
                          href={`/portal/loads/${doc.load_id}`}
                          className="text-[#FF8C21] hover:text-[#E8700A] font-medium"
                        >
                          {doc.load_reference_number}
                        </Link>
                        <span className="text-gray-600">{formatFileSize(doc.file_size)}</span>
                        <span className="text-gray-600">
                          {doc.uploaded_at ? formatDate(doc.uploaded_at) : "—"}
                        </span>
                      </div>
                    </div>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E8700A] hover:text-[#FF8C21] bg-[#E8700A]/10 hover:bg-[#E8700A]/20 rounded-lg transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Filename</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Type</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Load #</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Size</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Uploaded</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap bg-[#0B1120] border-b border-[#1e2530]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-[#1e2530]/60 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-white font-medium truncate max-w-[200px]">
                            {doc.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-300">
                          {doc.document_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/portal/loads/${doc.load_id}`}
                          className="text-[#FF8C21] hover:text-[#E8700A] text-xs font-medium"
                        >
                          {doc.load_reference_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatFileSize(doc.file_size)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {doc.uploaded_at ? formatDate(doc.uploaded_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#E8700A] hover:text-[#FF8C21] bg-[#E8700A]/10 hover:bg-[#E8700A]/20 rounded-lg transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
