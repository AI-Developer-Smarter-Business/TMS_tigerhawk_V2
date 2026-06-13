// components/dashboard/AppointmentsModule.tsx
// Shows today's pickup, delivery, and return appointments
"use client"

import { ModuleCard } from "./ModuleCard"

interface AppointmentLoad {
  id: string
  reference_number: string
  container_number: string | null
  customer_name: string | null
  driver_name: string | null
  pickup_apt_from: string | null
  pickup_apt_to: string | null
  delivery_apt_from: string | null
  delivery_apt_to: string | null
  return_apt_from: string | null
  return_apt_to: string | null
  status: string
}

interface AppointmentsModuleProps {
  loads: AppointmentLoad[]
}

type AptType = "pickup" | "delivery" | "return"

interface Appointment {
  loadId: string
  refNum: string
  containerNumber: string | null
  driverName: string | null
  type: AptType
  from: string
  to: string | null
}

const APT_COLORS: Record<AptType, { bg: string; text: string }> = {
  pickup: { bg: "bg-blue-500/15", text: "text-blue-400" },
  delivery: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  return: { bg: "bg-purple-500/15", text: "text-purple-400" },
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export function AppointmentsModule({ loads }: AppointmentsModuleProps) {
  const appointments: Appointment[] = []

  for (const load of loads) {
    if (load.pickup_apt_from && isToday(load.pickup_apt_from)) {
      appointments.push({
        loadId: load.id,
        refNum: load.reference_number,
        containerNumber: load.container_number,
        driverName: load.driver_name,
        type: "pickup",
        from: load.pickup_apt_from,
        to: load.pickup_apt_to,
      })
    }
    if (load.delivery_apt_from && isToday(load.delivery_apt_from)) {
      appointments.push({
        loadId: load.id,
        refNum: load.reference_number,
        containerNumber: load.container_number,
        driverName: load.driver_name,
        type: "delivery",
        from: load.delivery_apt_from,
        to: load.delivery_apt_to,
      })
    }
    if (load.return_apt_from && isToday(load.return_apt_from)) {
      appointments.push({
        loadId: load.id,
        refNum: load.reference_number,
        containerNumber: load.container_number,
        driverName: load.driver_name,
        type: "return",
        from: load.return_apt_from,
        to: load.return_apt_to,
      })
    }
  }

  // Sort by earliest time
  appointments.sort(
    (a, b) => new Date(a.from).getTime() - new Date(b.from).getTime()
  )

  const pickupCount = appointments.filter((a) => a.type === "pickup").length
  const deliveryCount = appointments.filter((a) => a.type === "delivery").length
  const returnCount = appointments.filter((a) => a.type === "return").length

  return (
    <ModuleCard
      title="Today's Appointments"
      linkHref="/dashboard/shipments"
      linkText="All loads"
    >
      {/* Summary */}
      <div className="px-6 py-3 flex gap-4 border-b border-white/5">
        {appointments.length === 0 ? (
          <span className="text-xs text-gray-500">
            No appointments scheduled for today
          </span>
        ) : (
          <>
            {pickupCount > 0 && (
              <span className="text-xs text-blue-400 font-medium">
                {pickupCount} pickup{pickupCount !== 1 ? "s" : ""}
              </span>
            )}
            {deliveryCount > 0 && (
              <span className="text-xs text-emerald-400 font-medium">
                {deliveryCount} deliver{deliveryCount !== 1 ? "ies" : "y"}
              </span>
            )}
            {returnCount > 0 && (
              <span className="text-xs text-purple-400 font-medium">
                {returnCount} return{returnCount !== 1 ? "s" : ""}
              </span>
            )}
          </>
        )}
      </div>

      {/* Timeline */}
      <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
        {appointments.slice(0, 12).map((apt, i) => {
          const colors = APT_COLORS[apt.type]
          return (
            <a
              key={`${apt.loadId}-${apt.type}-${i}`}
              href={`/dashboard/shipments/${apt.loadId}`}
              className="px-6 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
            >
              {/* Time */}
              <div className="w-20 shrink-0 text-right">
                <p className="text-sm font-mono text-gray-300">
                  {formatTime(apt.from)}
                </p>
                {apt.to && (
                  <p className="text-[10px] text-gray-500">
                    – {formatTime(apt.to)}
                  </p>
                )}
              </div>

              {/* Type badge */}
              <span
                className={`shrink-0 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${colors.bg} ${colors.text}`}
              >
                {apt.type.slice(0, 3)}
              </span>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {apt.refNum}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {apt.containerNumber || "—"} &middot;{" "}
                  {apt.driverName || "Unassigned"}
                </p>
              </div>
            </a>
          )
        })}
      </div>
    </ModuleCard>
  )
}
