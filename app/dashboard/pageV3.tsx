// app/dashboard/page.tsx
import { DashboardLayout } from "@/components/layout/DashboardLayout"

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Dashboard</h2>
            <p className="mt-1 text-sm text-gray-400">
              Overview of your drayage operations
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors">
              Export
            </button>
            <button className="px-4 py-2 bg-[#E8700A] rounded-lg text-sm font-medium text-white hover:bg-[#FF8C21] transition-colors shadow-lg shadow-[#E8700A]/20">
              + New Shipment
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Shipments"
            value="12"
            change="+3 today"
            changeType="up"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            }
          />
          <StatCard
            title="Vessels This Week"
            value="8"
            change="2 arriving today"
            changeType="neutral"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21V3m0 0a3 3 0 1 0 0 6m0-6a3 3 0 1 1 0 6m0 0v12m8.716-6.747a9 9 0 0 0 .284-2.253c0-.113-.002-.225-.006-.337M3.284 14.253A9 9 0 0 1 3 12c0-.113.002-.225.006-.337" />
              </svg>
            }
          />
          <StatCard
            title="Available Containers"
            value="24"
            change="6 ready for pickup"
            changeType="up"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            }
          />
          <StatCard
            title="Demurrage Alerts"
            value="3"
            change="Action needed"
            changeType="warning"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            }
          />
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Shipments */}
          <div className="lg:col-span-2 bg-[#111827] rounded-xl border border-white/5">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Recent Shipments</h3>
              <a href="/dashboard/shipments" className="text-xs text-[#E8700A] font-medium hover:text-[#FF8C21]">
                View all
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Reference</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Container</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <ShipmentRow ref_num="TH-2026-0142" customer="Gulf Steel Corp" container="MSCU7234561" status="In Transit" driver="M. Rodriguez" />
                  <ShipmentRow ref_num="TH-2026-0141" customer="Texas Textiles Inc" container="CMAU9182734" status="Assigned" driver="J. Thompson" />
                  <ShipmentRow ref_num="TH-2026-0140" customer="Bayou Chemical" container="OOLU8374625" status="Delivered" driver="R. Chen" />
                  <ShipmentRow ref_num="TH-2026-0139" customer="Premier Imports" container="TCLU4928371" status="Created" driver="Unassigned" />
                  <ShipmentRow ref_num="TH-2026-0138" customer="Gulf Steel Corp" container="MSCU6192847" status="In Transit" driver="A. Patel" />
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Vessels */}
          <div className="bg-[#111827] rounded-xl border border-white/5">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Incoming Vessels</h3>
              <a href="/dashboard/vessels" className="text-xs text-[#E8700A] font-medium hover:text-[#FF8C21]">
                View all
              </a>
            </div>
            <div className="divide-y divide-white/5">
              <VesselRow name="MSC ANNA" terminal="BCT" eta="Today, 14:30" containers={12} />
              <VesselRow name="EVER GLORY" terminal="BAY" eta="Tomorrow, 08:00" containers={8} />
              <VesselRow name="CMA CGM BRAZIL" terminal="BCT" eta="Feb 19, 06:15" containers={15} />
              <VesselRow name="MAERSK HOUSTON" terminal="BAY" eta="Feb 20, 11:00" containers={6} />
              <VesselRow name="ZIM PACIFIC" terminal="BCT" eta="Feb 21, 16:45" containers={9} />
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Driver Status */}
          <div className="bg-[#111827] rounded-xl border border-white/5">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Driver Status</h3>
              <a href="/dashboard/drivers" className="text-xs text-[#E8700A] font-medium hover:text-[#FF8C21]">
                Manage
              </a>
            </div>
            <div className="divide-y divide-white/5">
              <DriverRow name="M. Rodriguez" status="On Job" location="I-610 near BCT" />
              <DriverRow name="J. Thompson" status="On Job" location="Baytown Warehouse" />
              <DriverRow name="R. Chen" status="Available" location="Yard" />
              <DriverRow name="A. Patel" status="On Job" location="Bayport Terminal" />
              <DriverRow name="D. Williams" status="Off Duty" location="-" />
            </div>
          </div>

          {/* Warehouse Summary */}
          <div className="bg-[#111827] rounded-xl border border-white/5">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Baytown Warehouse</h3>
              <a href="/dashboard/warehouse" className="text-xs text-[#E8700A] font-medium hover:text-[#FF8C21]">
                Details
              </a>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Total Pallets in Storage</span>
                <span className="text-lg font-bold text-white">342</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-[#E8700A] to-[#FF8C21] h-2.5 rounded-full" style={{ width: "68%" }}></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>68% capacity</span>
                <span>500 max</span>
              </div>
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Pending Transloads</span>
                  <span className="font-semibold text-white">4</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Outbound Today</span>
                  <span className="font-semibold text-white">7</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Inbound Expected</span>
                  <span className="font-semibold text-white">3</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function StatCard({
  title,
  value,
  change,
  changeType,
  icon,
}: {
  title: string
  value: string
  change: string
  changeType: "up" | "down" | "neutral" | "warning"
  icon: React.ReactNode
}) {
  const changeColors = {
    up: "text-emerald-400 bg-emerald-400/10",
    down: "text-red-400 bg-red-400/10",
    neutral: "text-blue-400 bg-blue-400/10",
    warning: "text-amber-400 bg-amber-400/10",
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-white/5 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-400">{title}</span>
        <div className="p-2 bg-[#E8700A]/10 rounded-lg text-[#E8700A]">
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <span className="text-3xl font-bold text-white">{value}</span>
      </div>
      <div className="mt-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${changeColors[changeType]}`}>
          {change}
        </span>
      </div>
    </div>
  )
}

function ShipmentRow({
  ref_num,
  customer,
  container,
  status,
  driver,
}: {
  ref_num: string
  customer: string
  container: string
  status: string
  driver: string
}) {
  const statusStyles: Record<string, string> = {
    "Created": "bg-gray-500/10 text-gray-400",
    "Assigned": "bg-blue-500/10 text-blue-400",
    "In Transit": "bg-[#E8700A]/15 text-[#FF8C21]",
    "Delivered": "bg-emerald-500/10 text-emerald-400",
  }

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-6 py-3 text-sm font-medium text-gray-200">{ref_num}</td>
      <td className="px-6 py-3 text-sm text-gray-400">{customer}</td>
      <td className="px-6 py-3 text-xs text-gray-500 font-mono">{container}</td>
      <td className="px-6 py-3">
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || "bg-gray-500/10 text-gray-400"}`}>
          {status}
        </span>
      </td>
      <td className="px-6 py-3 text-sm text-gray-400">{driver}</td>
    </tr>
  )
}

function VesselRow({
  name,
  terminal,
  eta,
  containers,
}: {
  name: string
  terminal: string
  eta: string
  containers: number
}) {
  return (
    <div className="px-6 py-3.5 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">{name}</p>
          <p className="text-xs text-gray-500 mt-0.5">ETA: {eta}</p>
        </div>
        <div className="text-right">
          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-[#E8700A]/15 text-[#E8700A]">
            {terminal}
          </span>
          <p className="text-xs text-gray-500 mt-1">{containers} containers</p>
        </div>
      </div>
    </div>
  )
}

function DriverRow({
  name,
  status,
  location,
}: {
  name: string
  status: string
  location: string
}) {
  const statusStyles: Record<string, string> = {
    "Available": "bg-emerald-500/10 text-emerald-400",
    "On Job": "bg-[#E8700A]/15 text-[#FF8C21]",
    "Off Duty": "bg-white/5 text-gray-500",
  }

  return (
    <div className="px-6 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
          <span className="text-xs font-medium text-gray-300">
            {name.split(" ").map((n) => n[0]).join("")}
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-200">{name}</p>
          <p className="text-xs text-gray-500">{location}</p>
        </div>
      </div>
      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || "bg-white/5 text-gray-400"}`}>
        {status}
      </span>
    </div>
  )
}
