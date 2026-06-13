"use client"

import { useState, useEffect } from "react"
import {
  Settings,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Ship,
  Database,
  Shield,
  Users,
  FileText,
} from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"

const S = {
  panel: "bg-[#141922] border-[#1e2530]",
  panelHeader: "bg-[#0B1120] border-[#1e2530]",
}

type SyncStatus = {
  key: string
  value: string
  updated_at: string
}

type SystemInfo = {
  // Port Houston sync
  portHoustonSyncEntries: SyncStatus[]
  // User counts
  totalStaffUsers: number
  totalPortalUsers: number
  // Config counts
  rateProfileCount: number
  chargeCodeCount: number
  deductionTemplateCount: number
  // Table stats
  loadCount: number
  customerCount: number
  driverCount: number
}

export function SystemSettingsView() {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchInfo = async () => {
    setLoading(true)
    setError("")
    try {
      const [
        syncRes,
        staffRes,
        portalRes,
        rateProfileRes,
        chargeCodeRes,
        deductionRes,
        loadRes,
        customerRes,
        driverRes,
      ] = await Promise.all([
        supabase.from("port_houston_sync").select("key, value, updated_at").order("key"),
        supabase
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .in("role", ["admin", "dispatcher", "accounting", "driver"]),
        supabase
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "customer"),
        supabase.from("rate_profiles").select("id", { count: "exact", head: true }),
        supabase.from("charge_codes").select("id", { count: "exact", head: true }),
        supabase.from("deduction_templates").select("id", { count: "exact", head: true }),
        supabase.from("loads").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("drivers").select("id", { count: "exact", head: true }),
      ])

      setInfo({
        portHoustonSyncEntries: syncRes.data || [],
        totalStaffUsers: staffRes.count || 0,
        totalPortalUsers: portalRes.count || 0,
        rateProfileCount: rateProfileRes.count || 0,
        chargeCodeCount: chargeCodeRes.count || 0,
        deductionTemplateCount: deductionRes.count || 0,
        loadCount: loadRes.count || 0,
        customerCount: customerRes.count || 0,
        driverCount: driverRes.count || 0,
      })
    } catch (err) {
      console.error("Error fetching system info:", err)
      setError("Failed to load system information")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#E8700A] animate-spin" />
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="p-6">
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-300">
          {error || "Failed to load system info"}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings size={20} className="text-[#E8700A]" />
            System Settings
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Integration status, system configuration, and data overview
          </p>
        </div>
        <button
          onClick={fetchInfo}
          className="flex items-center gap-2 px-3 py-2 text-xs bg-[#1a2236] border border-white/10 rounded-lg text-gray-300 hover:text-white hover:border-white/20 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Integration Status */}
      <div className={`rounded-xl border ${S.panel}`}>
        <div className={`px-5 py-3 border-b rounded-t-xl ${S.panelHeader}`}>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Ship size={14} className="text-blue-400" />
            Port Houston Integration
          </h2>
        </div>
        <div className="p-5">
          {info.portHoustonSyncEntries.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <XCircle size={14} className="text-gray-600" />
              No sync state entries found. Port Houston integration may not be configured.
            </div>
          ) : (
            <div className="space-y-3">
              {info.portHoustonSyncEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between py-2 border-b border-[#1e2530]/60 last:border-b-0"
                >
                  <div>
                    <div className="text-xs font-medium text-gray-300">
                      {entry.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5 max-w-md truncate">
                      {entry.value}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={12} className="text-green-400" />
                    <span className="text-[10px] text-gray-500">
                      {new Date(entry.updated_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Counts */}
        <div className={`rounded-xl border ${S.panel}`}>
          <div className={`px-5 py-3 border-b rounded-t-xl ${S.panelHeader}`}>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users size={14} className="text-green-400" />
              User Accounts
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <StatRow label="Staff Users" value={info.totalStaffUsers} href="/dashboard/admin/users" />
            <StatRow label="Portal (Customer) Users" value={info.totalPortalUsers} href="/dashboard/admin/portal-users" />
            <StatRow label="Total Accounts" value={info.totalStaffUsers + info.totalPortalUsers} />
          </div>
        </div>

        {/* Data Counts */}
        <div className={`rounded-xl border ${S.panel}`}>
          <div className={`px-5 py-3 border-b rounded-t-xl ${S.panelHeader}`}>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database size={14} className="text-purple-400" />
              Data Overview
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <StatRow label="Total Loads" value={info.loadCount} href="/dashboard/dispatcher" />
            <StatRow label="Customers" value={info.customerCount} href="/dashboard/organizations" />
            <StatRow label="Drivers" value={info.driverCount} href="/dashboard/drivers" />
          </div>
        </div>

        {/* Configuration */}
        <div className={`rounded-xl border ${S.panel}`}>
          <div className={`px-5 py-3 border-b rounded-t-xl ${S.panelHeader}`}>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText size={14} className="text-yellow-400" />
              Rate & Pay Configuration
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <StatRow label="Rate Profiles" value={info.rateProfileCount} href="/dashboard/drivers?tab=driver-pay-rates" />
            <StatRow label="Charge Codes" value={info.chargeCodeCount} />
            <StatRow label="Deduction Templates" value={info.deductionTemplateCount} href="/dashboard/accounts-payable/deductions" />
          </div>
        </div>

        {/* Security Info */}
        <div className={`rounded-xl border ${S.panel}`}>
          <div className={`px-5 py-3 border-b rounded-t-xl ${S.panelHeader}`}>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield size={14} className="text-red-400" />
              Security & Access
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[#1e2530]/60">
              <span className="text-xs text-gray-400">Row Level Security</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 size={12} /> Enabled
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[#1e2530]/60">
              <span className="text-xs text-gray-400">Role-Based Access Control</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <CheckCircle2 size={12} /> Active
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-gray-400">Activity Logging</span>
              <a
                href="/dashboard/admin/activity-log"
                className="flex items-center gap-1.5 text-xs text-[#E8700A] hover:text-[#FF8C21] transition-colors"
              >
                <Clock size={12} /> View Log
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-component ──────────────────────────────────────────

function StatRow({
  label,
  value,
  href,
}: {
  label: string
  value: number
  href?: string
}) {
  const content = (
    <div className="flex items-center justify-between py-2 border-b border-[#1e2530]/60 last:border-b-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-white">{value.toLocaleString()}</span>
    </div>
  )

  if (href) {
    return (
      <a href={href} className="block hover:bg-[#1a2030]/50 -mx-2 px-2 rounded transition-colors">
        {content}
      </a>
    )
  }

  return content
}
