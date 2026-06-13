"use client"

import { useState } from "react"
import { LoadWithRelations } from "@/types/dispatcher"
import { generateRateConfirmation } from "@/lib/pdf/generateRateConfirmation"
import { generateProofOfDelivery } from "@/lib/pdf/generateProofOfDelivery"
import { generateInOutGate } from "@/lib/pdf/generateInOutGate"
import { generateBillOfLading } from "@/lib/pdf/generateBillOfLading"

type OrgAddress = {
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

type DocumentGenerationModalProps = {
  load: LoadWithRelations
  orgAddresses: Record<string, OrgAddress>
  onClose: () => void
  onSwitchToDocumentsTab: () => void
}

type DocOption = {
  id: string
  label: string
  description: string
  icon: string
  disabled?: boolean
  disabledReason?: string
}

const DOC_OPTIONS: DocOption[] = [
  {
    id: "rate-con",
    label: "Rate Confirmation",
    description: "Carrier rate confirmation with load details and charges",
    icon: "📋",
  },
  {
    id: "pod",
    label: "Proof of Delivery",
    description: "Delivery receipt with signature fields",
    icon: "✅",
  },
  {
    id: "bol",
    label: "Bill of Lading",
    description: "Standard bill of lading for carrier",
    icon: "📦",
  },
  {
    id: "in-out-gate",
    label: "In/Out Gate Receipt",
    description: "Container inspection and gate receipt",
    icon: "🚛",
  },
  {
    id: "documents",
    label: "Documents",
    description: "View and manage uploaded documents",
    icon: "📂",
  },
  {
    id: "all",
    label: "Download All",
    description: "Generate and download all documents at once",
    icon: "📥",
  },
  {
    id: "invoice",
    label: "Invoice",
    description: "Customer invoice (coming soon)",
    icon: "💵",
    disabled: true,
    disabledReason: "Coming soon",
  },
]

export function DocumentGenerationModal({
  load,
  orgAddresses,
  onClose,
  onSwitchToDocumentsTab,
}: DocumentGenerationModalProps) {
  const [generating, setGenerating] = useState<string | null>(null)

  const generators: Record<string, () => Promise<void>> = {
    "rate-con": () => generateRateConfirmation(load, orgAddresses),
    "pod": () => generateProofOfDelivery(load, orgAddresses),
    "bol": () => generateBillOfLading(load, orgAddresses),
    "in-out-gate": () => generateInOutGate(load, orgAddresses),
  }

  const handleGenerate = async (docId: string) => {
    if (docId === "documents") {
      onSwitchToDocumentsTab()
      onClose()
      return
    }

    if (docId === "all") {
      setGenerating("all")
      try {
        for (const [id, gen] of Object.entries(generators)) {
          setGenerating(id)
          await gen()
        }
      } catch (error) {
        console.error("Failed to generate all documents:", error)
      } finally {
        setGenerating(null)
      }
      return
    }

    setGenerating(docId)
    try {
      const gen = generators[docId]
      if (gen) await gen()
    } catch (error) {
      console.error(`Failed to generate ${docId}:`, error)
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose} style={{ isolation: "isolate" }}>
      <div
        className="bg-[#1A2332] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Generate Document</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Load #{load.reference_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Document options */}
        <div className="p-4 space-y-2">
          {DOC_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => !opt.disabled && handleGenerate(opt.id)}
              disabled={opt.disabled || generating !== null}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg text-left transition-all ${
                opt.disabled
                  ? "opacity-40 cursor-not-allowed bg-white/[0.02]"
                  : generating === opt.id
                  ? "bg-[#E8700A]/10 border border-[#E8700A]/30"
                  : "bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/10"
              }`}
            >
              <span className="text-2xl flex-shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{opt.label}</span>
                  {opt.disabled && opt.disabledReason && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-500">
                      {opt.disabledReason}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
              </div>
              {generating === opt.id ? (
                <div className="w-5 h-5 border-2 border-[#E8700A] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : !opt.disabled ? (
                <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5">
          <p className="text-[10px] text-gray-500 text-center">
            Documents are generated as PDF and downloaded automatically
          </p>
        </div>
      </div>
    </div>
  )
}
