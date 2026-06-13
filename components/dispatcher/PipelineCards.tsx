"use client"

import { PipelineCounts } from "@/types/dispatcher"

type Props = {
  counts: PipelineCounts
  activeFilter: string | null
  onFilterChange: (filter: string | null) => void
}

export function PipelineCards({ counts, activeFilter, onFilterChange }: Props) {
  const cards = [
    {
      id: "arriving",
      title: "Arriving On Vessel/Rail",
      count: counts.arrivingOnVessel,
      subCounts: [
        { label: "On Hold", value: counts.arrivingOnHold },
        { label: "Released", value: counts.arrivingReleased },
      ],
    },
    {
      id: "pickup",
      title: "Need Pickup",
      count: counts.needPickup,
      subCounts: [
        { label: "LFD", value: counts.needPickupLFD },
        { label: "Pickup Apt", value: counts.needPickupApt },
      ],
    },
    {
      id: "delivery",
      title: "Need Delivery/Loaded",
      count: counts.needDelivery,
      subCounts: [
        { label: "At Terminal", value: counts.needDeliveryAtTerminal },
        { label: "In Yard", value: counts.needDeliveryInYard },
      ],
    },
    {
      id: "return",
      title: "Need Return",
      count: counts.needReturn,
      subCounts: [
        { label: "Ready", value: counts.needReturnReady },
        { label: "Not Ready", value: counts.needReturnNotReady },
      ],
    },
    {
      id: "dropped",
      title: "Dropped",
      count: counts.dropped,
      subCounts: [
        { label: "In Yard", value: counts.droppedInYard },
        { label: "At Customer", value: counts.droppedAtCustomer },
      ],
    },
    {
      id: "finished",
      title: "Finished Today",
      count: counts.finishedToday,
      highlight: true,
    },
  ]

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400">Pipeline Overview</h3>
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {cards.map((card, index) => (
          <div key={card.id} className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => onFilterChange(activeFilter === card.id ? null : card.id)}
              className={`rounded-lg border transition-all cursor-pointer px-3 py-2.5 min-w-[150px] ${
                activeFilter === card.id
                  ? "border-[#E8700A] bg-[#E8700A]/5"
                  : card.highlight
                    ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                    : "border-white/10 bg-[#111827] hover:border-white/20"
              }`}
            >
              <div className="text-left">
                <p className={`text-[11px] font-medium leading-tight ${card.highlight ? "text-emerald-400" : "text-gray-400"}`}>
                  {card.title}
                </p>
                <p className={`mt-1 text-xl font-bold ${card.highlight ? "text-emerald-400" : "text-white"}`}>
                  {card.count}
                </p>
                {card.subCounts && (
                  <div className="mt-1.5 flex gap-3">
                    {card.subCounts.map((sub) => (
                      <div key={sub.label}>
                        <p className="text-[10px] text-gray-500">{sub.label}</p>
                        <p className="text-xs font-semibold text-gray-300">{sub.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </button>
            {index < cards.length - 1 && (
              <div className="flex items-center text-gray-600 flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
