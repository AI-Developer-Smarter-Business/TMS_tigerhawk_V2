"use client"

import { useState, useEffect } from "react"
import { Calculator, DollarSign, Loader2, Zap, MapPin, Truck, AlertTriangle, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { evaluateAccessorialTrigger, describeTrigger } from "@/lib/pay-calculator"
import type { LoadProperties, AccessorialResult, PayCalculationResult } from "@/lib/pay-calculator"

// ─── Types ──────────────────────────────────────────────────────
type LaneOrigin = { id: string; name: string; code: string }
type LaneZone = { id: string; zone_number: number; name: string; min_miles: number; max_miles: number | null; reference_city: string | null }
type DriverGroup = { id: string; name: string; pay_type: string; base_rate: number }
type Driver = { id: string; name: string }
type Accessorial = {
  id: string; code: string; name: string; charge_type: string;
  default_amount: number; trigger_type: string; trigger_config: Record<string, unknown>;
  container_sizes: string[] | null; load_types: string[] | null; is_active: boolean
}

// ─── Main Component ─────────────────────────────────────────────
export default function PayCalculatorView() {
  const supabase = createClient()

  // Data
  const [origins, setOrigins] = useState<LaneOrigin[]>([])
  const [zones, setZones] = useState<LaneZone[]>([])
  const [driverGroups, setDriverGroups] = useState<DriverGroup[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [accessorials, setAccessorials] = useState<Accessorial[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [selectedOrigin, setSelectedOrigin] = useState("")
  const [selectedZone, setSelectedZone] = useState("")
  const [selectedGroup, setSelectedGroup] = useState("")
  const [selectedDriver, setSelectedDriver] = useState("")
  const [loadProps, setLoadProps] = useState<LoadProperties>({
    is_hazmat: false,
    is_overweight: false,
    is_reefer: false,
    is_pre_pull: false,
    is_chassis_split: false,
    detention_hours: 0,
    container_size: "40",
    load_type: "Import",
    delivery_location_type: "warehouse",
  })

  // Result
  const [result, setResult] = useState<PayCalculationResult | null>(null)
  const [calculating, setCalculating] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [originsRes, groupsRes, driversRes, accessorialsRes] = await Promise.all([
        supabase.from("lane_origins").select("id, name, code").eq("is_active", true).order("name"),
        supabase.from("driver_groups").select("id, name, pay_type, base_rate").eq("is_active", true).order("name"),
        supabase.from("drivers").select("id, name").eq("enabled", true).order("name"),
        supabase.from("accessorials").select("*").eq("is_active", true).order("code"),
      ])
      setOrigins(originsRes.data || [])
      setDriverGroups(groupsRes.data || [])
      setDrivers(driversRes.data || [])
      setAccessorials(accessorialsRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  // Fetch zones when origin changes
  useEffect(() => {
    if (!selectedOrigin) { setZones([]); return }
    async function fetchZones() {
      const { data } = await supabase
        .from("lane_zones")
        .select("id, zone_number, name, min_miles, max_miles, reference_city")
        .eq("origin_id", selectedOrigin)
        .eq("is_active", true)
        .order("zone_number")
      setZones(data || [])
      setSelectedZone("")
    }
    fetchZones()
  }, [selectedOrigin, supabase])

  // Calculate
  const handleCalculate = async () => {
    if (!selectedZone || !selectedGroup) return
    setCalculating(true)

    try {
      const group = driverGroups.find((g) => g.id === selectedGroup)
      if (!group) throw new Error("Group not found")

      let basePay = 0
      let baseDescription = ""
      const profileCharges: AccessorialResult[] = []

      // ──────────────────────────────────────────────────────────
      // Try new rate_profile system first:
      // 1. Find rate profiles assigned to this driver group
      // 2. Find matching zonal lanes (anchor_point=origin, zone=zone)
      // 3. Sum auto_add charges from those lanes
      // ──────────────────────────────────────────────────────────
      let usedRateProfile = false

      const { data: profileLinks } = await supabase
        .from("rate_profile_driver_groups")
        .select("rate_profile_id")
        .eq("driver_group_id", selectedGroup)

      if (profileLinks && profileLinks.length > 0) {
        const profileIds = profileLinks.map((l: { rate_profile_id: string }) => l.rate_profile_id)

        // Charge type for lane query
        const laneChargeSelect = `
            id, lane_type, name, anchor_point_id, anchor_role, zone_id,
            pickup_location, delivery_location, priority, is_active,
            rate_profile_charges(
              id, charge_code, charge_name, calculation_mode,
              unit_of_measure, rate, min_amount, max_amount,
              free_units, auto_add, is_active,
              leg_from, leg_from_location, leg_to, leg_to_location
            )
        `

        type MatchedCharge = {
          id: string; charge_code: string; charge_name: string;
          calculation_mode: string; unit_of_measure: string; rate: number;
          min_amount: number | null; max_amount: number | null;
          free_units: number; auto_add: boolean; is_active: boolean;
          leg_from: string | null; leg_from_location: string | null;
          leg_to: string | null; leg_to_location: string | null;
        }

        // Helper to process charges from a matched lane
        const processLaneCharges = (charges: MatchedCharge[], routeFallback: string) => {
          for (const charge of charges) {
            if (!charge.is_active || !charge.auto_add) continue

            let chargeAmount = Number(charge.rate) || 0

            // Apply min/max constraints
            if (charge.min_amount != null && chargeAmount < charge.min_amount) {
              chargeAmount = charge.min_amount
            }
            if (charge.max_amount != null && chargeAmount > charge.max_amount) {
              chargeAmount = charge.max_amount
            }

            // The first charge (typically DRAYAGE / S100) is the "base pay"
            if (charge.charge_code === "S100" || (basePay === 0 && profileCharges.length === 0)) {
              basePay = chargeAmount
              const fromLoc = charge.leg_from_location || ""
              const toLoc = charge.leg_to_location || ""
              const routeLabel = fromLoc && toLoc ? `${fromLoc} → ${toLoc}` : routeFallback
              baseDescription = `${charge.charge_name} — ${routeLabel} @ $${chargeAmount.toFixed(2)}/${charge.unit_of_measure.replace("per_", "")}`
            } else {
              profileCharges.push({
                code: charge.charge_code,
                name: charge.charge_name,
                amount: chargeAmount,
                charge_type: charge.unit_of_measure,
              })
            }
          }
        }

        // ── Step A: Check DEFINED (fixed) lanes first ──
        // Match by pickup_location = origin name (fixed routes take priority over zonal)
        const selectedOriginObj = origins.find((o) => o.id === selectedOrigin)
        const originName = selectedOriginObj?.name || ""
        const originCode = selectedOriginObj?.code || ""

        if (originName || originCode) {
          // Fetch all defined lanes for these profiles, then filter client-side
          // (Supabase doesn't support OR across different columns in .eq())
          const { data: definedLanes } = await supabase
            .from("rate_profile_lanes")
            .select(laneChargeSelect)
            .in("rate_profile_id", profileIds)
            .eq("is_active", true)
            .eq("lane_type", "defined")
            .order("priority", { ascending: false })

          if (definedLanes && definedLanes.length > 0) {
            // Match: any value in comma-separated pickup_location matches origin name or code
            const matchedDefined = definedLanes.find((lane) => {
              const pickup = (lane.pickup_location || "").toLowerCase()
              return pickup === originName.toLowerCase() || pickup === originCode.toLowerCase()
            })

            if (matchedDefined) {
              usedRateProfile = true
              const charges = (matchedDefined.rate_profile_charges || []) as MatchedCharge[]
              const routeLabel = `${matchedDefined.pickup_location || "?"} → ${matchedDefined.delivery_location || "?"}`
              processLaneCharges(charges, routeLabel)
            }
          }
        }

        // ── Step B: Fall back to ZONAL lanes if no defined match ──
        if (!usedRateProfile) {
          const { data: zonalLanes } = await supabase
            .from("rate_profile_lanes")
            .select(laneChargeSelect)
            .in("rate_profile_id", profileIds)
            .eq("is_active", true)
            .eq("lane_type", "zonal")
            .eq("zone_id", selectedZone)
            .eq("anchor_point_id", selectedOrigin)
            .order("priority", { ascending: false })

          if (zonalLanes && zonalLanes.length > 0) {
            usedRateProfile = true
            const bestLane = zonalLanes[0]
            const charges = (bestLane.rate_profile_charges || []) as MatchedCharge[]
            const zone = zones.find((z) => z.id === selectedZone)
            processLaneCharges(charges, zone?.name || "Zone")
          }
        }

        if (usedRateProfile && basePay === 0 && profileCharges.length === 0) {
          baseDescription = `Rate profile lane matched but has no active charges`
        }
      }

      // ──────────────────────────────────────────────────────────
      // Fallback: legacy lane_rates table (if no rate profile match)
      // ──────────────────────────────────────────────────────────
      if (!usedRateProfile) {
        if (group.pay_type === "per_move" || group.pay_type === "per_mile") {
          const { data: rates } = await supabase
            .from("lane_rates")
            .select("rate, unit_of_measure, service_type")
            .eq("zone_id", selectedZone)
            .eq("driver_group_id", selectedGroup)
            .eq("is_active", true)
            .order("effective_date", { ascending: false })
            .limit(1)

          if (rates && rates.length > 0) {
            basePay = rates[0].rate
            const zone = zones.find((z) => z.id === selectedZone)
            const unitLabel = rates[0].unit_of_measure === "per_mile" ? "/mi" : ""
            baseDescription = `${rates[0].service_type} — ${zone?.name || "Zone"} @ $${basePay.toFixed(2)}${unitLabel}`
          } else {
            baseDescription = "No rate found for this zone/group combination"
          }
        } else if (group.pay_type === "hourly") {
          basePay = group.base_rate
          baseDescription = `Hourly rate: $${basePay.toFixed(2)}/hr`
        } else {
          basePay = group.base_rate
          baseDescription = `Flat rate: $${basePay.toFixed(2)}`
        }
      }

      // Evaluate legacy accessorials (always applied on top)
      const triggeredAccessorials: AccessorialResult[] = [...profileCharges]
      for (const acc of accessorials) {
        const { triggered, amount } = evaluateAccessorialTrigger(
          acc as Parameters<typeof evaluateAccessorialTrigger>[0],
          loadProps
        )
        if (triggered && amount > 0) {
          triggeredAccessorials.push({
            code: acc.code,
            name: acc.name,
            amount,
            charge_type: acc.charge_type,
          })
        }
      }

      const accessorialTotal = triggeredAccessorials.reduce((sum, a) => sum + a.amount, 0)

      setResult({
        base_pay: basePay,
        base_description: baseDescription,
        accessorials: triggeredAccessorials,
        accessorial_total: accessorialTotal,
        total_pay: basePay + accessorialTotal,
      })
    } catch (err) {
      console.error("Calculation error:", err)
      setResult(null)
    } finally {
      setCalculating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-[#E8700A] animate-spin" />
      </div>
    )
  }

  const toggleProp = (key: keyof LoadProperties) => {
    setLoadProps((prev) => ({ ...prev, [key]: !prev[key] }))
    setResult(null)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#E8700A]/10 rounded-lg">
          <Calculator className="w-5 h-5 text-[#E8700A]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Pay Calculator</h2>
          <p className="text-sm text-gray-500">Preview driver pay for any lane + scenario combination</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Left: Inputs ──────────────────────── */}
        <div className="space-y-4">
          {/* Lane Selection */}
          <div className="bg-[#0B1120] rounded-lg border border-white/5 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <MapPin size={14} /> Lane Selection
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Origin</label>
                <select
                  value={selectedOrigin}
                  onChange={(e) => { setSelectedOrigin(e.target.value); setResult(null) }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                >
                  <option value="" className="bg-[#111827] text-white">Select origin...</option>
                  {origins.map((o) => (
                    <option key={o.id} value={o.id} className="bg-[#111827] text-white">{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Zone</label>
                <select
                  value={selectedZone}
                  onChange={(e) => { setSelectedZone(e.target.value); setResult(null) }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                  disabled={!selectedOrigin}
                >
                  <option value="" className="bg-[#111827] text-white">Select zone...</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id} className="bg-[#111827] text-white">
                      {z.name} ({z.min_miles}-{z.max_miles || "100+"}mi)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Driver Group</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => { setSelectedGroup(e.target.value); setResult(null) }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                >
                  <option value="" className="bg-[#111827] text-white">Select group...</option>
                  {driverGroups.map((g) => (
                    <option key={g.id} value={g.id} className="bg-[#111827] text-white">
                      {g.name} ({g.pay_type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Driver (optional)</label>
                <select
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                >
                  <option value="" className="bg-[#111827] text-white">Any driver</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#111827] text-white">{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Load Properties */}
          <div className="bg-[#0B1120] rounded-lg border border-white/5 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Truck size={14} /> Load Properties
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Container Size</label>
                <select
                  value={loadProps.container_size || ""}
                  onChange={(e) => { setLoadProps((p) => ({ ...p, container_size: e.target.value })); setResult(null) }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                >
                  <option value="20" className="bg-[#111827] text-white">20&apos;</option>
                  <option value="40" className="bg-[#111827] text-white">40&apos;</option>
                  <option value="45" className="bg-[#111827] text-white">45&apos;</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Load Type</label>
                <select
                  value={loadProps.load_type || ""}
                  onChange={(e) => { setLoadProps((p) => ({ ...p, load_type: e.target.value })); setResult(null) }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                >
                  <option value="Import" className="bg-[#111827] text-white">Import</option>
                  <option value="Export" className="bg-[#111827] text-white">Export</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Delivery Location</label>
                <select
                  value={loadProps.delivery_location_type || ""}
                  onChange={(e) => { setLoadProps((p) => ({ ...p, delivery_location_type: e.target.value })); setResult(null) }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                >
                  <option value="warehouse" className="bg-[#111827] text-white">Warehouse</option>
                  <option value="residential" className="bg-[#111827] text-white">Residential</option>
                  <option value="port" className="bg-[#111827] text-white">Port/Terminal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Detention Hours</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={loadProps.detention_hours || 0}
                  onChange={(e) => { setLoadProps((p) => ({ ...p, detention_hours: parseFloat(e.target.value) || 0 })); setResult(null) }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#E8700A]"
                />
              </div>
            </div>

            {/* Toggle switches */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: "is_hazmat" as const, label: "Hazmat", icon: AlertTriangle },
                { key: "is_overweight" as const, label: "Overweight", icon: Truck },
                { key: "is_reefer" as const, label: "Reefer", icon: Truck },
                { key: "is_pre_pull" as const, label: "Pre-Pull", icon: Truck },
                { key: "is_chassis_split" as const, label: "Chassis Split", icon: Truck },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleProp(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    loadProps[key]
                      ? "bg-[#E8700A]/10 border-[#E8700A]/30 text-[#E8700A]"
                      : "bg-white/5 border-white/10 text-gray-500 hover:text-gray-400"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${loadProps[key] ? "bg-[#E8700A]" : "bg-white/10"}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Calculate Button */}
          <button
            onClick={handleCalculate}
            disabled={!selectedZone || !selectedGroup || calculating}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#E8700A] hover:bg-[#FF8C21] disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors"
          >
            {calculating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            Calculate Driver Pay
          </button>
        </div>

        {/* ─── Right: Results ─────────────────────── */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Total */}
              <div className="bg-[#0B1120] rounded-lg border border-[#E8700A]/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Total Driver Pay</span>
                  <DollarSign className="w-5 h-5 text-[#E8700A]" />
                </div>
                <div className="text-3xl font-bold text-white">
                  ${result.total_pay.toFixed(2)}
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-[#0B1120] rounded-lg border border-white/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Breakdown</h3>

                {/* Base Pay */}
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <div>
                      <div className="text-sm text-white font-medium">Base Pay</div>
                      <div className="text-xs text-gray-500">{result.base_description}</div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white">${result.base_pay.toFixed(2)}</span>
                </div>

                {/* Accessorials */}
                {result.accessorials.length > 0 ? (
                  result.accessorials.map((acc) => (
                    <div key={acc.code} className="flex items-center justify-between py-2 border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#E8700A]" />
                        <div>
                          <div className="text-sm text-white font-medium">{acc.name}</div>
                          <div className="text-xs text-gray-500">
                            {acc.code} — {acc.charge_type}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-[#E8700A]">+${acc.amount.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <div className="py-2 text-xs text-gray-600">No accessorials triggered</div>
                )}

                {/* Totals line */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-gray-400">Accessorial Total</span>
                  <span className="text-sm font-semibold text-[#E8700A]">
                    ${result.accessorial_total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Active Accessorials Reference */}
              <div className="bg-[#0B1120] rounded-lg border border-white/5 p-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Accessorial Trigger Reference
                </h3>
                <div className="space-y-1.5">
                  {accessorials.map((acc) => {
                    const isTriggered = result.accessorials.some((r) => r.code === acc.code)
                    return (
                      <div key={acc.id} className="flex items-center gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full ${isTriggered ? "bg-[#E8700A]" : "bg-white/10"}`} />
                        <span className={isTriggered ? "text-white" : "text-gray-600"}>
                          {acc.code}
                        </span>
                        <ChevronRight size={10} className="text-gray-700" />
                        <span className={isTriggered ? "text-gray-400" : "text-gray-700"}>
                          {describeTrigger(acc.trigger_type, acc.trigger_config)}
                        </span>
                        <span className="ml-auto text-gray-600">
                          ${acc.default_amount.toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#0B1120] rounded-lg border border-white/5 p-12 flex flex-col items-center justify-center text-center">
              <Calculator className="w-10 h-10 text-gray-700 mb-3" />
              <p className="text-sm text-gray-500 mb-1">Select a lane and driver group, then click Calculate</p>
              <p className="text-xs text-gray-600">Toggle load properties to see how accessorials affect the total</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
