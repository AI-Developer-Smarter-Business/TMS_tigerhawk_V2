import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

interface LoadProperties {
  is_hazmat?: boolean
  is_overweight?: boolean
  is_reefer?: boolean
  is_pre_pull?: boolean
  is_chassis_split?: boolean
  detention_hours?: number
  container_size?: string
  load_type?: string
}

interface AccessorialTrigger {
  trigger_type?: string
  trigger_config?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validation
    if (!body.driver_id) {
      return NextResponse.json(
        { error: "driver_id is required" },
        { status: 400 }
      )
    }

    if (!body.origin_id) {
      return NextResponse.json(
        { error: "origin_id is required" },
        { status: 400 }
      )
    }

    if (!body.zone_id) {
      return NextResponse.json(
        { error: "zone_id is required" },
        { status: 400 }
      )
    }

    const loadProperties: LoadProperties = body.load_properties || {}

    // Step 1: Find driver's group from driver_group_assignments (most recent by effective_date)
    const { data: assignments, error: assignError } = await supabase
      .from("driver_group_assignments")
      .select(`
        id,
        driver_group_id,
        effective_date,
        expires_date,
        driver_groups(id, name, pay_type, base_rate, default_service_type)
      `)
      .eq("driver_id", body.driver_id)
      .order("effective_date", { ascending: false })
      .limit(1)

    if (assignError || !assignments || assignments.length === 0) {
      return NextResponse.json(
        { error: "Driver has no assigned pay group" },
        { status: 404 }
      )
    }

    const assignment = assignments[0]
    const driverGroup = (assignment as any).driver_groups

    if (!driverGroup) {
      return NextResponse.json(
        { error: "Driver group not found" },
        { status: 404 }
      )
    }

    let basePay = 0
    const profileChargeAmounts: number[] = []

    // ─── Step 2: Try new rate_profile system first ───────────────
    let usedRateProfile = false

    const { data: profileLinks } = await supabase
      .from("rate_profile_driver_groups")
      .select("rate_profile_id")
      .eq("driver_group_id", driverGroup.id)

    if (profileLinks && profileLinks.length > 0) {
      const profileIds = profileLinks.map((l: { rate_profile_id: string }) => l.rate_profile_id)

      const laneChargeSelect = `
        id, lane_type, pickup_location, delivery_location, priority, is_active,
        rate_profile_charges(
          id, charge_code, charge_name, unit_of_measure, rate,
          min_amount, max_amount, auto_add, is_active
        )
      `

      // Helper to process charges from a matched lane
      const processCharges = (charges: any[]) => {
        for (const charge of charges) {
          if (!charge.is_active || !charge.auto_add) continue
          let amount = parseFloat(charge.rate?.toString() || "0")
          if (charge.min_amount != null && amount < parseFloat(charge.min_amount.toString())) {
            amount = parseFloat(charge.min_amount.toString())
          }
          if (charge.max_amount != null && amount > parseFloat(charge.max_amount.toString())) {
            amount = parseFloat(charge.max_amount.toString())
          }
          if (charge.charge_code === "S100" || (basePay === 0 && profileChargeAmounts.length === 0)) {
            basePay = amount
          } else {
            profileChargeAmounts.push(amount)
          }
        }
      }

      // ── Step 2a: Check DEFINED (fixed) lanes first ──
      // Resolve origin_id to a name for matching against pickup_location
      const { data: originData } = await supabase
        .from("lane_origins")
        .select("name, code")
        .eq("id", body.origin_id)
        .single()

      if (originData) {
        const { data: definedLanes } = await supabase
          .from("rate_profile_lanes")
          .select(laneChargeSelect)
          .in("rate_profile_id", profileIds)
          .eq("is_active", true)
          .eq("lane_type", "defined")
          .order("priority", { ascending: false })

        if (definedLanes && definedLanes.length > 0) {
          const originNameLower = (originData.name || "").toLowerCase()
          const originCodeLower = (originData.code || "").toLowerCase()
          const matchedDefined = definedLanes.find((lane: any) => {
            const pickup = (lane.pickup_location || "").toLowerCase()
            return pickup === originNameLower || pickup === originCodeLower
          })

          if (matchedDefined) {
            usedRateProfile = true
            processCharges((matchedDefined as any).rate_profile_charges || [])
          }
        }
      }

      // ── Step 2b: Fall back to ZONAL lanes if no defined match ──
      if (!usedRateProfile) {
        const { data: zonalLanes } = await supabase
          .from("rate_profile_lanes")
          .select(laneChargeSelect)
          .in("rate_profile_id", profileIds)
          .eq("is_active", true)
          .eq("lane_type", "zonal")
          .eq("zone_id", body.zone_id)
          .eq("anchor_point_id", body.origin_id)
          .order("priority", { ascending: false })

        if (zonalLanes && zonalLanes.length > 0) {
          usedRateProfile = true
          processCharges((zonalLanes[0] as any).rate_profile_charges || [])
        }
      }
    }

    // ─── Step 3: Fallback to legacy lane_rates if no rate profile match ──
    if (!usedRateProfile) {
      if (driverGroup.pay_type === "per_move") {
        const serviceType = body.service_type || driverGroup.default_service_type || null

        const { data: rates, error: rateError } = await supabase
          .from("lane_rates")
          .select("rate, unit_of_measure")
          .eq("zone_id", body.zone_id)
          .eq("driver_group_id", driverGroup.id)
          .eq("service_type", serviceType)
          .limit(1)

        if (rateError || !rates || rates.length === 0) {
          return NextResponse.json(
            { error: `No rate found for zone ${body.zone_id}, group ${driverGroup.id}, service type ${serviceType}` },
            { status: 404 }
          )
        }

        basePay = parseFloat(rates[0].rate.toString())
      } else if (driverGroup.pay_type === "hourly") {
        basePay = parseFloat(driverGroup.base_rate.toString())
      }
    }

    // Step 4: Fetch active accessorials and check trigger conditions
    const { data: accessorials, error: accessError } = await supabase
      .from("accessorials")
      .select(`
        id,
        code,
        name,
        charge_type,
        default_amount,
        trigger_type,
        trigger_config,
        container_sizes,
        load_types
      `)
      .eq("is_active", true)

    if (accessError) {
      return NextResponse.json(
        { error: "Failed to fetch accessorials" },
        { status: 500 }
      )
    }

    const applicableAccessorials: Array<{
      code: string
      name: string
      amount: number
    }> = []

    // Check each accessorial trigger against load_properties
    for (const accessorial of accessorials || []) {
      let shouldApply = false
      const triggerType = accessorial.trigger_type as string | undefined
      const triggerConfig = accessorial.trigger_config as Record<string, unknown> | undefined

      if (!triggerType) {
        // No trigger means always apply
        shouldApply = true
      } else if (triggerType === "hazmat" && loadProperties.is_hazmat) {
        shouldApply = true
      } else if (triggerType === "overweight" && loadProperties.is_overweight) {
        shouldApply = true
      } else if (triggerType === "reefer" && loadProperties.is_reefer) {
        shouldApply = true
      } else if (triggerType === "pre_pull" && loadProperties.is_pre_pull) {
        shouldApply = true
      } else if (triggerType === "chassis_split" && loadProperties.is_chassis_split) {
        shouldApply = true
      } else if (triggerType === "detention") {
        // Check detention_hours against trigger_config threshold
        const threshold = triggerConfig?.threshold || 0
        if ((loadProperties.detention_hours || 0) >= Number(threshold)) {
          shouldApply = true
        }
      } else if (triggerType === "container_size") {
        // Check if container_size matches any in trigger_config
        const allowedSizes = triggerConfig?.allowed_sizes as string[] | undefined
        if (
          loadProperties.container_size &&
          allowedSizes &&
          allowedSizes.includes(loadProperties.container_size)
        ) {
          shouldApply = true
        }
      } else if (triggerType === "load_type") {
        // Check if load_type matches any in trigger_config
        const allowedTypes = triggerConfig?.allowed_types as string[] | undefined
        if (
          loadProperties.load_type &&
          allowedTypes &&
          allowedTypes.includes(loadProperties.load_type)
        ) {
          shouldApply = true
        }
      }

      // Additional filter checks for container_sizes and load_types on the accessorial
      if (shouldApply) {
        const containerSizes = accessorial.container_sizes as string[] | undefined
        const loadTypes = accessorial.load_types as string[] | undefined

        if (containerSizes && containerSizes.length > 0) {
          if (!loadProperties.container_size || !containerSizes.includes(loadProperties.container_size)) {
            shouldApply = false
          }
        }

        if (shouldApply && loadTypes && loadTypes.length > 0) {
          if (!loadProperties.load_type || !loadTypes.includes(loadProperties.load_type)) {
            shouldApply = false
          }
        }
      }

      if (shouldApply) {
        const amount = parseFloat(accessorial.default_amount?.toString() || "0")
        applicableAccessorials.push({
          code: accessorial.code,
          name: accessorial.name,
          amount,
        })
      }
    }

    // Step 5: Calculate total pay (include profile charges beyond base pay)
    const profileChargeTotal = profileChargeAmounts.reduce((sum, a) => sum + a, 0)
    const accessorialTotal = applicableAccessorials.reduce((sum, acc) => sum + acc.amount, 0)
    const totalPay = basePay + profileChargeTotal + accessorialTotal

    return NextResponse.json(
      {
        base_pay: basePay,
        profile_charge_total: profileChargeTotal,
        used_rate_profile: usedRateProfile,
        driver_group: {
          id: driverGroup.id,
          name: driverGroup.name,
          pay_type: driverGroup.pay_type,
        },
        accessorials: applicableAccessorials,
        accessorial_total: accessorialTotal,
        total_pay: totalPay,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error calculating pay:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
