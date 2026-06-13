"use client"

import { useState } from "react"
import { Upload, CheckCircle2, AlertCircle } from "lucide-react"

interface ChassisUpload {
  id: string
  file_name: string
  row_count: number
  upload_date: string
  created_at: string
  status: string
  error_message?: string | null
}

interface ChassisAuditViewProps {
  initialUploads: ChassisUpload[]
  error: string | null
}

export function ChassisAuditView({ initialUploads, error }: ChassisAuditViewProps) {
  const [uploads, setUploads] = useState(initialUploads)
  const [dragActive, setDragActive] = useState(false)
  const [uploadedData, setUploadedData] = useState<
    Array<{ [key: string]: string | number }>
  >([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const parseCSV = (text: string) => {
    const lines = text.split("\n")
    if (lines.length === 0) return []

    const headers = lines[0].split(",").map((h) => h.trim())
    const data = []

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "") continue

      const values = lines[i].split(",").map((v) => v.trim())
      const row: { [key: string]: string | number } = {}

      headers.forEach((header, idx) => {
        row[header] = values[idx] || ""
      })

      data.push(row)
    }

    return data
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  const handleFiles = (files: FileList) => {
    const file = files[0]
    if (!file.name.endsWith(".csv")) {
      setProcessingStatus({
        type: "error",
        message: "Please upload a CSV file",
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const data = parseCSV(text)
      setUploadedData(data)
      setProcessingStatus({ type: null, message: "" })

      // Add to uploads list
      const newUpload: ChassisUpload = {
        id: Math.random().toString(36).substr(2, 9),
        file_name: file.name,
        row_count: data.length,
        upload_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        status: "Pending Review",
      }
      setUploads([newUpload, ...uploads])
    }
    reader.readAsText(file)
  }

  const handleProcessRecords = async () => {
    if (uploadedData.length === 0) {
      setProcessingStatus({
        type: "error",
        message: "No data to process",
      })
      return
    }

    setIsProcessing(true)
    setProcessingStatus({ type: null, message: "" })

    try {
      // Update the latest upload status to "Processed"
      const updatedUploads = uploads.map((upload, idx) =>
        idx === 0 ? { ...upload, status: "Processed" } : upload
      )
      setUploads(updatedUploads)

      setProcessingStatus({
        type: "success",
        message: `Successfully processed ${uploadedData.length} chassis records`,
      })

      // Clear the uploaded data after a short delay
      setTimeout(() => {
        setUploadedData([])
        setProcessingStatus({ type: null, message: "" })
      }, 3000)
    } catch (err) {
      setProcessingStatus({
        type: "error",
        message: "Failed to process records",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg">
        Error loading chassis audit data: {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-12 transition-colors ${
          dragActive
            ? "border-[#E8700A] bg-[#E8700A]/10"
            : "border-white/20 hover:border-white/30 bg-white/5"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <Upload className="w-16 h-16 text-gray-400" />
          <div className="text-center">
            <p className="text-lg font-medium text-white">
              Upload CSV File Here...
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Drag and drop your chassis audit CSV file
            </p>
          </div>
          <label className="px-6 py-2 bg-[#E8700A] hover:bg-[#d45f08] text-white font-medium rounded-lg transition-colors cursor-pointer">
            Upload CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Uploaded Data Preview */}
      {uploadedData.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Uploaded Records ({uploadedData.length})
          </h2>

          <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {uploadedData.length > 0 &&
                    Object.keys(uploadedData[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {uploadedData.slice(0, 10).map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    {Object.values(row).map((value, valueIdx) => (
                      <td
                        key={valueIdx}
                        className="px-4 py-3 text-gray-300 whitespace-nowrap"
                      >
                        {String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {uploadedData.length > 10 && (
            <p className="text-sm text-gray-400">
              Showing 10 of {uploadedData.length} records
            </p>
          )}

          {/* Status Message */}
          {processingStatus.type && (
            <div
              className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
                processingStatus.type === "success"
                  ? "bg-green-900/30 border border-green-700/50 text-green-300"
                  : "bg-red-900/30 border border-red-700/50 text-red-300"
              }`}
            >
              {processingStatus.type === "success" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm">{processingStatus.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleProcessRecords}
              disabled={isProcessing}
              className="px-6 py-2 bg-[#E8700A] hover:bg-[#d45f08] disabled:bg-[#E8700A]/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isProcessing ? "Processing..." : "Process Records"}
            </button>
            <button
              onClick={() => {
                setUploadedData([])
                setProcessingStatus({ type: null, message: "" })
              }}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Upload History */}
      {uploads.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Upload History</h2>

          <div className="overflow-x-auto border border-white/10 rounded-lg bg-[#111827]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Records
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Upload Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr
                    key={upload.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-white font-medium">
                      {upload.file_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {upload.row_count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {upload.upload_date
                        ? new Date(upload.upload_date).toLocaleDateString("en-US")
                        : upload.created_at
                          ? new Date(upload.created_at).toLocaleDateString("en-US")
                          : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300">
                        {upload.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
