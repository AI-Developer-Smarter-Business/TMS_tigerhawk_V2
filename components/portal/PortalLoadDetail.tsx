// components/portal/PortalLoadDetail.tsx
"use client"

import Link from "next/link"
import { LOAD_STATUS_COLORS } from "@/types/dispatcher"
import { PortalLoad, PortalDocument } from "@/types/portal"
import { formatDate } from "@/lib/utils"

type Props = {
  load: PortalLoad
  documents: PortalDocument[]
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-300 text-right">{value || "—"}</span>
    </div>
  )
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export function PortalLoadDetail({ load, documents }: Props) {
  const statusColor =
    LOAD_STATUS_COLORS[load.status as keyof typeof LOAD_STATUS_COLORS] || {
      bg: "bg-gray-500/10",
      text: "text-gray-400",
      border: "border-gray-500/20",
    }

  const containerSize = load.container_size || load.containers?.size || ""
  const ssl = load.ssl || load.containers?.shipping_line || ""
  const lfd = load.containers?.last_free_day || null
  const isLFDOverdue = lfd ? new Date(lfd) < new Date() : false

  // Build status timeline from key dates
  const timeline: Array<{ label: string; date: string | null; active: boolean }> = []

  if (load.load_type === "Import") {
    timeline.push(
      { label: "Created", date: load.created_at, active: true },
      { label: "Vessel ETA", date: load.vessel_eta ?? null, active: !!load.vessel_eta },
      { label: "Discharged", date: load.discharge_date ?? null, active: !!load.discharge_date },
      { label: "Picked Up", date: load.actual_pickup ?? null, active: !!load.actual_pickup },
      { label: "Delivered", date: load.actual_delivery ?? null, active: !!load.actual_delivery },
      { label: "Completed", date: load.completed_date ?? null, active: !!load.completed_date },
    )
  } else {
    timeline.push(
      { label: "Created", date: load.created_at, active: true },
      { label: "Picked Up", date: load.actual_pickup ?? null, active: !!load.actual_pickup },
      { label: "Delivered", date: load.actual_delivery ?? null, active: !!load.actual_delivery },
      { label: "Completed", date: load.completed_date ?? null, active: !!load.completed_date },
    )
  }

  return (
    <div className="space-y-6">
      {/* Back link + Title */}
      <div className="flex items-start gap-3">
        <Link
          href="/portal/loads"
          aria-label="Back to active loads"
          className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white mt-0.5"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-2xl font-bold text-white truncate">
              {load.reference_number}
            </h1>
            <span className={`inline-flex items-center self-start px-3 py-1 rounded-lg text-xs sm:text-sm font-medium ${statusColor.bg} ${statusColor.text}`}>
              {load.status}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            {load.load_type || "Load"} · {ssl || "No SSL"} · {containerSize ? `${containerSize}'` : "No size"}
          </p>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-[#141922] border border-[#1e2530] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-4">Timeline</h2>

        {/* Mobile: vertical timeline */}
        <div className="flex flex-col gap-0 sm:hidden">
          {timeline.map((step, idx) => (
            <div key={step.label} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    step.active
                      ? "bg-[#E8700A] border-[#E8700A]"
                      : "bg-transparent border-gray-600"
                  }`}
                />
                {idx < timeline.length - 1 && (
                  <div
                    className={`w-0.5 h-6 ${
                      step.active && timeline[idx + 1]?.active
                        ? "bg-[#E8700A]"
                        : "bg-gray-700"
                    }`}
                  />
                )}
              </div>
              <div className="pb-3 -mt-0.5">
                <p className={`text-xs ${step.active ? "text-white font-medium" : "text-gray-600"}`}>
                  {step.label}
                </p>
                {step.date && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {formatDate(step.date)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: horizontal timeline */}
        <div className="hidden sm:flex items-center gap-0">
          {timeline.map((step, idx) => (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full border-2 ${
                    step.active
                      ? "bg-[#E8700A] border-[#E8700A]"
                      : "bg-transparent border-gray-600"
                  }`}
                />
                <p className={`text-[10px] mt-1.5 whitespace-nowrap ${step.active ? "text-white" : "text-gray-600"}`}>
                  {step.label}
                </p>
                {step.date && (
                  <p className="text-[10px] text-gray-500">
                    {formatDate(step.date)}
                  </p>
                )}
              </div>
              {idx < timeline.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 mt-[-18px] ${
                    step.active && timeline[idx + 1]?.active
                      ? "bg-[#E8700A]"
                      : "bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Load Info */}
        <div className="bg-[#141922] border border-[#1e2530] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Load Information</h2>
          <InfoRow label="Reference #" value={load.reference_number} />
          <InfoRow label="Load Type" value={load.load_type} />
          <InfoRow label="Route Type" value={load.route_type} />
          <InfoRow label="Shipment #" value={load.shipment_number} />
          <InfoRow label="Purchase Order" value={load.purchase_order} />
          <InfoRow label="Commodity" value={load.commodity} />
          <InfoRow label="Weight" value={load.total_weight ? `${load.total_weight} lbs` : null} />
          {load.is_hazmat && <InfoRow label="Hazmat" value="Yes" />}
          {load.is_hot && <InfoRow label="Hot Load" value="Yes" />}
          {load.is_overweight && <InfoRow label="Overweight" value="Yes" />}
        </div>

        {/* Container Info */}
        <div className="bg-[#141922] border border-[#1e2530] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Container</h2>
          <InfoRow label="Container #" value={load.containers?.container_number || load.container_number} />
          <InfoRow label="Size" value={containerSize ? `${containerSize}'` : null} />
          <InfoRow label="Type" value={load.containers?.type} />
          <InfoRow label="SSL" value={ssl} />
          <InfoRow label="Seal #" value={load.seal_number || load.containers?.seal_number} />
          <InfoRow label="BOL #" value={load.containers?.bol_number || load.mbol} />
          <InfoRow label="Chassis #" value={load.chassis_number} />
          <InfoRow
            label="LFD"
            value={lfd ? formatDate(lfd) : null}
          />
          {isLFDOverdue && lfd && (
            <div className="mt-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-xs text-orange-400 font-medium">LFD has passed — container may incur demurrage fees</p>
            </div>
          )}
        </div>

        {/* Locations */}
        <div className="bg-[#141922] border border-[#1e2530] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Locations</h2>
          <InfoRow label="Pickup" value={load.pickup_location} />
          <InfoRow label="Delivery" value={load.delivery_location} />
          <InfoRow label="Return" value={load.return_location} />
          {load.containers?.vessels && (
            <>
              <InfoRow label="Vessel" value={load.containers.vessels.name} />
              <InfoRow label="Voyage" value={load.containers.vessels.voyage_number} />
              <InfoRow label="Terminal" value={load.containers.vessels.terminal} />
            </>
          )}
        </div>

        {/* Dates & Appointments */}
        <div className="bg-[#141922] border border-[#1e2530] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Dates</h2>
          <InfoRow label="Vessel ETA" value={load.vessel_eta ? formatDate(load.vessel_eta) : null} />
          <InfoRow label="Pickup Appointment" value={load.pickup_apt_from ? formatDate(load.pickup_apt_from) : null} />
          <InfoRow label="Delivery Appointment" value={load.delivery_apt_from ? formatDate(load.delivery_apt_from) : null} />
          <InfoRow label="Actual Pickup" value={load.actual_pickup ? formatDate(load.actual_pickup) : null} />
          <InfoRow label="Actual Delivery" value={load.actual_delivery ? formatDate(load.actual_delivery) : null} />
          <InfoRow label="Per Diem Free Day" value={load.per_diem_free_day ? formatDate(load.per_diem_free_day) : null} />
        </div>

        {/* Holds Status */}
        {(load.freight_hold !== "none" || load.customs_hold !== "none" || load.terminal_hold !== "none" || load.fees_hold !== "none") && (
          <div className="bg-[#141922] border border-[#1e2530] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Hold Status</h2>
            {load.freight_hold !== "none" && (
              <InfoRow label="Freight Hold" value={load.freight_hold === "hold" ? "On Hold" : "Released"} />
            )}
            {load.customs_hold !== "none" && (
              <InfoRow label="Customs Hold" value={load.customs_hold === "hold" ? "On Hold" : "Released"} />
            )}
            {load.terminal_hold !== "none" && (
              <InfoRow label="Terminal Hold" value={load.terminal_hold === "hold" ? "On Hold" : "Released"} />
            )}
            {load.fees_hold !== "none" && (
              <InfoRow label="Fees Hold" value={load.fees_hold === "hold" ? "On Hold" : "Released"} />
            )}
          </div>
        )}

        {/* Driver Info (limited) */}
        {load.drivers && (
          <div className="bg-[#141922] border border-[#1e2530] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Driver</h2>
            <InfoRow label="Name" value={load.drivers.name} />
            <InfoRow label="Status" value={load.drivers.status} />
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="bg-[#141922] border border-[#1e2530] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">
            Documents ({documents.length})
          </h2>
        </div>

        {documents.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No documents attached to this load
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{doc.filename}</p>
                  <p className="text-xs text-gray-500">
                    {doc.document_type} · {formatFileSize(doc.file_size)} · {doc.uploaded_at ? formatDate(doc.uploaded_at) : "—"}
                  </p>
                </div>
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium text-[#E8700A] hover:text-[#FF8C21] bg-[#E8700A]/10 hover:bg-[#E8700A]/20 rounded-lg transition-colors flex-shrink-0"
                  >
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes (if any) */}
      {load.notes && (
        <div className="bg-[#141922] border border-[#1e2530] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-2">Notes</h2>
          <p className="text-sm text-gray-400 whitespace-pre-wrap">{load.notes}</p>
        </div>
      )}
    </div>
  )
}
