import { DashboardLayout } from "@/components/layout/DashboardLayout"

export default function WarehousePage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-[#E8700A]/10 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-[#E8700A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Warehouse</h1>
          <p className="text-gray-400 max-w-md">
            Warehouse management is coming soon. Track inventory, manage receiving and dispatch operations, and monitor warehouse capacity.
          </p>
          <span className="inline-flex px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-semibold text-amber-400 uppercase tracking-wide">
            Coming Soon
          </span>
        </div>
      </div>
    </DashboardLayout>
  )
}
