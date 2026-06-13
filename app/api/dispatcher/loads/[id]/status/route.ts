// app/api/dispatcher/loads/[id]/status/route.ts
import { getUserFromRequest } from "@/lib/supabase/get-user-from-request"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTemplateEmail } from "@/lib/email/sendTemplateEmail"
import { NextRequest, NextResponse } from "next/server"
import { LoadStatus } from "@/types/dispatcher"
import { getEffectiveTransitions } from "@/lib/transitions"
import { statusChangeSchema } from "@/lib/validations/schemas"
import { validateBody } from "@/lib/validations/validate"
import { getActiveHoldKeys, type LoadHoldSnapshot } from "@/lib/loadHolds"
import {
  buildWaitEventBillingDescription,
  waitEventBillingTag,
} from "@/lib/wait-time/sync-load-billing"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getUserFromRequest(request)
    const { id } = await context.params

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current load
    const { data: currentLoad, error: fetchError } = await supabase
      .from("loads")
      .select("id, status, driver_id, created_at, driver_pay, driver_pay_notes, reference_number, pickup_location, delivery_location, distance, container_size, load_type, is_hazmat, is_overweight, is_oog, is_bonded, is_tanker, is_scale, is_liquor, is_hot, is_overheight, is_street_turn, is_ev, is_genset, is_double, accessorial_charges, detention_charges, freight_hold, customs_hold, terminal_hold, fees_hold, other_hold, carrier_hold, containers(container_number)")
      .eq("id", id)
      .single()

    if (fetchError || !currentLoad) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Get new status from request body
    const body = await request.json()

    const result = validateBody(body, statusChangeSchema)
    if (!result.success) return result.response
    const { status: newStatus } = result.data

    // Check permission - staff or assigned driver
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isStaff = profile && ["admin", "dispatcher"].includes(profile.role)
    const isAssignedDriver = profile?.role === "driver" && currentLoad.driver_id === user.id

    if (!isStaff && !isAssignedDriver) {
      return NextResponse.json(
        { error: "You don't have permission to update this load status" },
        { status: 403 }
      )
    }

    // Validate status transition (uses DB overrides if any, otherwise hardcoded defaults)
    const currentStatus = currentLoad.status as LoadStatus
    const transitionMap = await getEffectiveTransitions()
    const validNextStates = transitionMap[currentStatus] || []

    if (!validNextStates.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
          validNextStates,
        },
        { status: 400 }
      )
    }

    // Block status changes while holds are active (Testing Plan + Handoff §1.5).
    // Admins may still transition (documented exception for break-glass / support).
    const activeHolds = getActiveHoldKeys(currentLoad as LoadHoldSnapshot)
    if (activeHolds.length > 0 && profile?.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Cannot change load status while active holds are set. Release or clear holds first.",
          code: "ACTIVE_HOLDS",
          activeHolds,
        },
        { status: 403 }
      )
    }

    // Prepare update data
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    // Set timestamps based on status
    const now = new Date().toISOString()
    if (newStatus === "In Transit" && !currentLoad.driver_id) {
      return NextResponse.json(
        { error: "Cannot mark as In Transit without a driver assigned" },
        { status: 400 }
      )
    }

    if (newStatus === "In Transit") {
      updates.actual_pickup = now
    } else if (newStatus === "Delivered" || newStatus === "Arrived At Delivery") {
      updates.actual_delivery = now
    } else if (newStatus === "Completed") {
      updates.completed_date = now
    }

    // Update load — try full container join first, fall back to safe join if columns missing
    const FULL_SELECT = `*, customers ( id, name, email, phone, address, city, state, zip_code ), containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, seal_number, ph_synced_at, vessel_id, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ), drivers ( id, name, phone, status )`
    const SAFE_SELECT = `*, customers ( id, name, email, phone, address, city, state, zip_code ), containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, seal_number, vessel_id, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ), drivers ( id, name, phone, status )`

    let load: Record<string, unknown> | null = null
    let updateError: { message: string } | null = null

    const res1 = await supabase
      .from("loads")
      .update(updates)
      .eq("id", id)
      .select(FULL_SELECT)
      .single()

    if (res1.error) {
      console.warn("Status update full select failed, retrying with safe join:", res1.error.message)
      // Do the update separately, then select with safe join
      await supabase.from("loads").update(updates).eq("id", id)
      const res2 = await supabase
        .from("loads")
        .select(SAFE_SELECT)
        .eq("id", id)
        .single()
      load = res2.data as Record<string, unknown> | null
      updateError = res2.error
    } else {
      load = res1.data as Record<string, unknown> | null
      updateError = null
    }

    if (updateError || !load) {
      console.error("Status update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update load status" },
        { status: 500 }
      )
    }

    // Update driver status when load is completed
    if (newStatus === "Completed" && currentLoad.driver_id) {
      const { error: driverUpdateError } = await supabase
        .from("drivers")
        .update({ status: "Available" })
        .eq("id", currentLoad.driver_id)

      if (driverUpdateError) {
        console.error("Failed to update driver status:", driverUpdateError)
      }

      // Auto-generate driver pay record on load completion
      // The driver_pay field on the load is typically pre-calculated at dispatch
      // time using the rate engine (defined point-to-point lanes first, then
      // zonal fallback for owner operators). We record that amount into A/P.
      // If driver_pay is not set, attempt to auto-calculate via rate profiles.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const containers = currentLoad.containers as any
        const containerNumber =
          Array.isArray(containers)
            ? containers[0]?.container_number || null
            : containers?.container_number || null

        let payAmount = Number(currentLoad.driver_pay) || 0
        let payNotes = currentLoad.driver_pay_notes || ""
        let payCalculated = false

        // Look up driver's group assignment — needed for both rate calc AND
        // accessorial group rules, so we do this unconditionally.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let driverGroup: any = null
        if (currentLoad.driver_id) {
          try {
            const { data: assignments } = await supabase
              .from("driver_group_assignments")
              .select(`
                driver_group_id,
                driver_groups(id, name, rate_profile_id, base_rate, pay_type)
              `)
              .eq("driver_id", currentLoad.driver_id)
              .order("effective_date", { ascending: false })
              .limit(1)

            console.log(`[AutoPay] Driver ${currentLoad.driver_id} assignments:`, JSON.stringify(assignments))

            if (assignments && assignments.length > 0) {
              driverGroup = (assignments[0] as any).driver_groups
            }
          } catch (grpErr) {
            console.error("Driver group lookup error (non-fatal):", grpErr)
          }
        }

        // If no pre-set driver_pay, try the rate calculation engine
        if (payAmount <= 0 && currentLoad.driver_id) {
          try {
            if (driverGroup) {

              if (driverGroup?.rate_profile_id) {
                // Check rate_profile_driver_groups for linked profiles
                const { data: profileLinks } = await supabase
                  .from("rate_profile_driver_groups")
                  .select("rate_profile_id")
                  .eq("driver_group_id", driverGroup.id)

                if (profileLinks && profileLinks.length > 0) {
                  const profileIds = profileLinks.map((l: { rate_profile_id: string }) => l.rate_profile_id)

                  // Try defined lanes first (point-to-point match on pickup location)
                  const { data: definedLanes } = await supabase
                    .from("rate_profile_lanes")
                    .select(`
                      id, lane_type, pickup_location, delivery_location, priority,
                      rate_profile_charges(charge_code, charge_name, rate, min_amount, max_amount, auto_add, is_active)
                    `)
                    .in("rate_profile_id", profileIds)
                    .eq("is_active", true)
                    .eq("lane_type", "defined")
                    .order("priority", { ascending: false })

                  let matched = false

                  if (definedLanes && definedLanes.length > 0 && currentLoad.pickup_location) {
                    const pickupLower = currentLoad.pickup_location.toLowerCase()
                    const deliveryLower = (currentLoad.delivery_location || "").toLowerCase()

                    const matchedLane = definedLanes.find((lane: any) => {
                      const lanePickup = (lane.pickup_location || "").toLowerCase()
                      const laneDelivery = (lane.delivery_location || "").toLowerCase()
                      // Match if pickup matches (and optionally delivery)
                      const pickupMatch = pickupLower.includes(lanePickup) || lanePickup.includes(pickupLower)
                      const deliveryMatch = !laneDelivery || deliveryLower.includes(laneDelivery) || laneDelivery.includes(deliveryLower)
                      return pickupMatch && deliveryMatch
                    })

                    if (matchedLane) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const charges = ((matchedLane as any).rate_profile_charges || []) as any[]
                      for (const charge of charges) {
                        if (charge.is_active && charge.auto_add) {
                          let amount = parseFloat(charge.rate?.toString() || "0")
                          if (charge.min_amount != null) amount = Math.max(amount, parseFloat(charge.min_amount.toString()))
                          if (charge.max_amount != null) amount = Math.min(amount, parseFloat(charge.max_amount.toString()))
                          payAmount += amount
                        }
                      }
                      matched = true
                      payNotes = `Auto-calculated from defined lane: $${payAmount.toFixed(2)} (${(matchedLane as any).pickup_location} → ${(matchedLane as any).delivery_location || "any"})`
                      payCalculated = true
                    }
                  }

                  // Fall back to zonal lanes if no defined match
                  // Use the load's pre-calculated route distance to match the correct zone
                  if (!matched) {
                    const routeDistance = Number(currentLoad.distance) || 0

                    // Try to find matching origin from lane_origins
                    const { data: origins } = await supabase
                      .from("lane_origins")
                      .select("id, name, code")

                    if (origins && currentLoad.pickup_location) {
                      const pickupLower = currentLoad.pickup_location.toLowerCase()
                      const matchedOrigin = origins.find((o: any) => {
                        const nameLower = (o.name || "").toLowerCase()
                        const codeLower = (o.code || "").toLowerCase()
                        return pickupLower.includes(nameLower) || nameLower.includes(pickupLower) ||
                               pickupLower.includes(codeLower) || codeLower.includes(pickupLower)
                      })

                      if (matchedOrigin) {
                        // Get all zonal lanes for this origin, joined with zone mile ranges
                        const { data: zonalLanes } = await supabase
                          .from("rate_profile_lanes")
                          .select(`
                            id, lane_type, anchor_point_id, zone_id, priority,
                            lane_zones(id, zone_number, name, min_miles, max_miles),
                            rate_profile_charges(charge_code, charge_name, rate, min_amount, max_amount, auto_add, is_active)
                          `)
                          .in("rate_profile_id", profileIds)
                          .eq("is_active", true)
                          .eq("lane_type", "zonal")
                          .eq("anchor_point_id", matchedOrigin.id)
                          .order("priority", { ascending: false })

                        if (zonalLanes && zonalLanes.length > 0) {
                          // Find the lane whose zone's mile range contains the route distance
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          let bestLane: any = null
                          let zoneName = ""

                          if (routeDistance > 0) {
                            bestLane = zonalLanes.find((lane: any) => {
                              const zone = lane.lane_zones
                              if (!zone) return false
                              const minMi = Number(zone.min_miles) || 0
                              const maxMi = Number(zone.max_miles) || Infinity
                              return routeDistance >= minMi && routeDistance <= maxMi
                            })
                            if (bestLane) {
                              zoneName = (bestLane as any).lane_zones?.name || `${(bestLane as any).lane_zones?.min_miles}-${(bestLane as any).lane_zones?.max_miles} mi`
                            }
                          }

                          // If distance didn't match any zone (or distance=0),
                          // fall back to highest-priority lane
                          if (!bestLane) {
                            bestLane = zonalLanes[0]
                            zoneName = (bestLane as any).lane_zones?.name || "default"
                          }

                          const charges = (bestLane.rate_profile_charges || []) as any[]
                          for (const charge of charges) {
                            if (charge.is_active && charge.auto_add) {
                              let amount = parseFloat(charge.rate?.toString() || "0")
                              if (charge.min_amount != null) amount = Math.max(amount, parseFloat(charge.min_amount.toString()))
                              if (charge.max_amount != null) amount = Math.min(amount, parseFloat(charge.max_amount.toString()))
                              payAmount += amount
                            }
                          }
                          payNotes = `Auto-calculated from zonal rate: $${payAmount.toFixed(2)} (origin: ${matchedOrigin.name}, zone: ${zoneName}, ${routeDistance > 0 ? routeDistance + " mi" : "no distance"})`
                          payCalculated = true
                        }
                      }
                    }
                  }
                }
              }
            }

            // If rate engine didn't produce anything, fall back to group base_rate
            if (!payCalculated && driverGroup?.base_rate) {
              const groupRate = Number(driverGroup.base_rate) || 0
              if (groupRate > 0) {
                payAmount = groupRate
                payNotes = `Group base rate (${driverGroup.name || "unknown"}, ${driverGroup.pay_type || "flat"})`
                payCalculated = true
                console.log(`[AutoPay] Using group base_rate for load ${id}: $${groupRate} from group "${driverGroup.name}"`)
              }
            }

            if (payCalculated) {
              console.log(`[AutoPay] Auto-calculated driver pay for load ${id}: $${payAmount}`)
            } else {
              console.log(`[AutoPay] No rate found for load ${id} — driver_pay=0, no rate profile match, no group base_rate`)
            }
          } catch (calcErr) {
            console.error("Rate calculation fallback error (non-fatal):", calcErr)
          }
        }

        // ─── Evaluate accessorials (hazmat, overweight, wait time, etc.) ───
        let accessorialTotal = 0
        const appliedAccessorials: string[] = []

        try {
          // If driver is in a group, check for group-specific overrides first
          const driverGroupId = driverGroup?.id || null
          let groupRuleMap: Record<string, number> = {} // accessorial_id → override_amount

          if (driverGroupId) {
            const { data: groupRules } = await supabase
              .from("accessorial_group_rules")
              .select("accessorial_id, override_amount")
              .eq("group_id", driverGroupId)

            if (groupRules) {
              for (const rule of groupRules) {
                groupRuleMap[rule.accessorial_id] = rule.override_amount != null
                  ? Number(rule.override_amount)
                  : -1 // -1 means "use default_amount"
              }
            }
          }

          const { data: accessorials } = await supabase
            .from("accessorials")
            .select("id, code, name, charge_type, default_amount, trigger_type, trigger_config, container_sizes, load_types")
            .eq("is_active", true)

          if (accessorials && accessorials.length > 0) {
            // Build a map of load properties for trigger evaluation
            const loadProps: Record<string, unknown> = {
              is_hazmat: currentLoad.is_hazmat,
              is_overweight: currentLoad.is_overweight,
              is_oog: currentLoad.is_oog,
              is_bonded: currentLoad.is_bonded,
              is_tanker: currentLoad.is_tanker,
              is_scale: currentLoad.is_scale,
              is_liquor: currentLoad.is_liquor,
              is_hot: currentLoad.is_hot,
              is_overheight: currentLoad.is_overheight,
              is_street_turn: currentLoad.is_street_turn,
              is_ev: currentLoad.is_ev,
              is_genset: currentLoad.is_genset,
              is_double: currentLoad.is_double,
              detention_hours: Number(currentLoad.detention_charges) || 0,
              container_size: currentLoad.container_size,
              load_type: currentLoad.load_type,
            }

            // Track which trigger fields have already fired to prevent
            // duplicates (e.g. seed "Hazmat" + user-created "Hazardous Material"
            // both triggering on is_hazmat).
            const appliedTriggerFields = new Set<string>()

            for (const acc of accessorials) {
              let shouldApply = false
              const triggerType = acc.trigger_type as string | null
              const triggerConfig = acc.trigger_config as Record<string, unknown> | null

              // Evaluate trigger
              if (triggerType === "load_property" && triggerConfig) {
                const field = triggerConfig.field as string
                const value = triggerConfig.value
                if (field && loadProps[field] === value) {
                  shouldApply = true
                }
              } else if (triggerType === "event_threshold" && triggerConfig) {
                const field = triggerConfig.field as string
                const operator = triggerConfig.operator as string
                const threshold = Number(triggerConfig.threshold) || 0
                const loadValue = Number(loadProps[field]) || 0

                if (operator === ">" && loadValue > threshold) shouldApply = true
                else if (operator === ">=" && loadValue >= threshold) shouldApply = true
                else if (operator === "==" && loadValue === threshold) shouldApply = true
              }
              // 'manual' trigger_type: skip — dispatcher adds these explicitly
              // No trigger_type: skip to avoid double-counting

              if (!shouldApply) continue

              // Deduplicate: skip if another accessorial already fired for this
              // trigger field (prevents seed + user-created duplicates)
              const triggerField = (triggerConfig as Record<string, unknown> | null)?.field as string | undefined
              if (triggerField) {
                if (appliedTriggerFields.has(triggerField)) {
                  console.log(`[Accessorial] Skipping duplicate trigger for field "${triggerField}": ${acc.name} (${acc.code})`)
                  continue
                }
                appliedTriggerFields.add(triggerField)
              }

              // Check container_sizes filter
              const accSizes = acc.container_sizes as string[] | null
              if (accSizes && accSizes.length > 0) {
                if (!currentLoad.container_size || !accSizes.includes(currentLoad.container_size)) {
                  continue
                }
              }

              // Check load_types filter
              const accTypes = acc.load_types as string[] | null
              if (accTypes && accTypes.length > 0) {
                if (!currentLoad.load_type || !accTypes.includes(currentLoad.load_type)) {
                  continue
                }
              }

              // Determine amount: group override > default_amount
              let amount: number
              if (groupRuleMap[acc.id] !== undefined) {
                amount = groupRuleMap[acc.id] === -1
                  ? (Number(acc.default_amount) || 0)
                  : groupRuleMap[acc.id]
              } else {
                amount = Number(acc.default_amount) || 0
              }

              if (amount > 0) {
                accessorialTotal += amount
                appliedAccessorials.push(`${acc.name}: $${amount.toFixed(2)}`)
              }
            }
          }
        } catch (accErr) {
          console.error("Accessorial evaluation error (non-fatal):", accErr)
        }

        // Add accessorial total to pay amount
        if (accessorialTotal > 0) {
          payAmount += accessorialTotal
          const accNote = `Accessorials: ${appliedAccessorials.join(", ")}`
          payNotes = payNotes ? `${payNotes} | ${accNote}` : accNote
          console.log(`Accessorials for load ${id}: $${accessorialTotal} (${appliedAccessorials.join(", ")})`)
        }

        // ─── Include logged wait time (driver pay portion) ───
        try {
          const { data: waitEvents } = await supabase
            .from("waiting_time_events")
            .select("id, event_name, duration_minutes, driver_payable, driver_pay_amount")
            .eq("load_id", id)
            .eq("driver_payable", true)

          if (waitEvents && waitEvents.length > 0) {
            const waitPayTotal = waitEvents.reduce(
              (sum, e) => sum + (Number(e.driver_pay_amount) || 0),
              0
            )
            const totalWaitMinutes = waitEvents.reduce(
              (sum, e) => sum + (e.duration_minutes || 0),
              0
            )

            if (waitPayTotal > 0) {
              payAmount += waitPayTotal
              const waitNote = `Wait time: ${totalWaitMinutes} min ($${waitPayTotal.toFixed(2)})`
              payNotes = payNotes ? `${payNotes} | ${waitNote}` : waitNote
              console.log(`Wait time pay for load ${id}: $${waitPayTotal} (${totalWaitMinutes} min across ${waitEvents.length} events)`)
            }
          }
        } catch (waitErr) {
          console.error("Wait time evaluation error (non-fatal):", waitErr)
        }

        // Only create the pay record if we have a positive amount
        if (payAmount > 0) {
          // 1. Write to ap_driver_pay (accounts payable system)
          // Use admin client because RLS restricts INSERT to admin/accounting roles,
          // but this code runs as the dispatcher or driver user.
          const apAdminClient = createAdminClient()
          const { error: payError } = await apAdminClient
            .from("ap_driver_pay")
            .insert({
              driver_id: currentLoad.driver_id,
              load_id: id,
              container_number: containerNumber,
              load_status: "Completed",
              from_location: currentLoad.pickup_location || null,
              to_location: currentLoad.delivery_location || null,
              pay_date: new Date().toISOString(),
              amount: payAmount,
              status: "Unapproved",
              notes: payNotes || `Auto-generated on load completion (${currentLoad.reference_number || id})`,
            })

          if (payError) {
            console.error("[AP_DRIVER_PAY] INSERT FAILED for load", id, ":", JSON.stringify(payError))
          } else {
            console.log(`[AP_DRIVER_PAY] Successfully created record for load ${id}: driver=${currentLoad.driver_id}, amount=$${payAmount}, pay_date=${new Date().toISOString()}`)
          }

          // 2. Write back to loads.driver_pay so the load detail DriverPayTab shows it
          const { error: loadPayError } = await supabase
            .from("loads")
            .update({
              driver_pay: payAmount,
              driver_pay_notes: payNotes || `Auto-calculated on completion`,
            })
            .eq("id", id)

          if (loadPayError) {
            console.error("Failed to update load driver_pay:", loadPayError)
          }
        }

        // ─── Create A/R billing records (load_billing) for customer charges ───
        // Accessorials that triggered get added as individual billing line items
        try {
          const billingRecords: Array<{
            load_id: string
            charge_type: string
            description: string
            amount: number
            created_at: string
            updated_at: string
          }> = []

          const billingNow = new Date().toISOString()

          // Add each triggered accessorial as a billing charge
          // Re-use the same appliedAccessorials list from driver pay evaluation
          // to avoid re-querying and to maintain deduplication consistency.
          if (appliedAccessorials.length > 0) {
            // Re-evaluate with same deduplication logic
            const { data: billingAccessorials } = await supabase
              .from("accessorials")
              .select("id, code, name, charge_type, default_amount, trigger_type, trigger_config, container_sizes, load_types")
              .eq("is_active", true)

            if (billingAccessorials) {
              const loadProps: Record<string, unknown> = {
                is_hazmat: currentLoad.is_hazmat,
                is_overweight: currentLoad.is_overweight,
                is_oog: currentLoad.is_oog,
                is_bonded: currentLoad.is_bonded,
                is_tanker: currentLoad.is_tanker,
                is_scale: currentLoad.is_scale,
                is_liquor: currentLoad.is_liquor,
                is_hot: currentLoad.is_hot,
                is_overheight: currentLoad.is_overheight,
                is_street_turn: currentLoad.is_street_turn,
                is_ev: currentLoad.is_ev,
                is_genset: currentLoad.is_genset,
                is_double: currentLoad.is_double,
                detention_hours: Number(currentLoad.detention_charges) || 0,
                container_size: currentLoad.container_size,
                load_type: currentLoad.load_type,
              }

              const billingTriggerFields = new Set<string>()

              for (const acc of billingAccessorials) {
                let shouldApply = false
                const triggerType = acc.trigger_type as string | null
                const triggerConfig = acc.trigger_config as Record<string, unknown> | null

                if (triggerType === "load_property" && triggerConfig) {
                  const field = triggerConfig.field as string
                  const value = triggerConfig.value
                  if (field && loadProps[field] === value) shouldApply = true
                } else if (triggerType === "event_threshold" && triggerConfig) {
                  const field = triggerConfig.field as string
                  const operator = triggerConfig.operator as string
                  const threshold = Number(triggerConfig.threshold) || 0
                  const loadValue = Number(loadProps[field]) || 0
                  if (operator === ">" && loadValue > threshold) shouldApply = true
                  else if (operator === ">=" && loadValue >= threshold) shouldApply = true
                  else if (operator === "==" && loadValue === threshold) shouldApply = true
                }

                if (!shouldApply) continue

                // Deduplicate by trigger field (same as driver pay evaluation)
                const bTriggerField = (triggerConfig as Record<string, unknown> | null)?.field as string | undefined
                if (bTriggerField) {
                  if (billingTriggerFields.has(bTriggerField)) continue
                  billingTriggerFields.add(bTriggerField)
                }

                const accSizes = acc.container_sizes as string[] | null
                if (accSizes && accSizes.length > 0) {
                  if (!currentLoad.container_size || !accSizes.includes(currentLoad.container_size)) continue
                }
                const accTypes = acc.load_types as string[] | null
                if (accTypes && accTypes.length > 0) {
                  if (!currentLoad.load_type || !accTypes.includes(currentLoad.load_type)) continue
                }

                const amount = Number(acc.default_amount) || 0
                if (amount > 0) {
                  billingRecords.push({
                    load_id: id,
                    charge_type: "Accessorial",
                    description: `${acc.name} (${acc.code || "auto"})`,
                    amount,
                    created_at: billingNow,
                    updated_at: billingNow,
                  })
                }
              }
            }
          }

          // Add wait time / detention as billing charges (customer-facing)
          const { data: billableWaitEvents } = await supabase
            .from("waiting_time_events")
            .select("id, event_name, duration_minutes, billable, charge_amount, free_time_minutes, end_time")
            .eq("load_id", id)
            .eq("billable", true)

          if (billableWaitEvents && billableWaitEvents.length > 0) {
            const billingAdmin = createAdminClient()
            for (const evt of billableWaitEvents) {
              const chargeAmt = Number(evt.charge_amount) || 0
              if (chargeAmt <= 0) continue

              const tag = waitEventBillingTag(evt.id)
              const { data: existingBill } = await billingAdmin
                .from("load_billing")
                .select("id")
                .eq("load_id", id)
                .ilike("description", `%${tag}%`)
                .maybeSingle()
              if (existingBill) continue

              billingRecords.push({
                load_id: id,
                charge_type: "Detention",
                description: buildWaitEventBillingDescription(evt),
                amount: chargeAmt,
                created_at: billingNow,
                updated_at: billingNow,
              })
            }
          }

          // Insert all billing records in one go (use admin client for RLS safety)
          if (billingRecords.length > 0) {
            const billingAdmin = createAdminClient()
            const { error: billingError } = await billingAdmin
              .from("load_billing")
              .insert(billingRecords)

            if (billingError) {
              console.error("Failed to auto-generate billing records:", billingError)
            } else {
              console.log(`Created ${billingRecords.length} billing record(s) for load ${id}`)
            }
          }
        } catch (billErr) {
          console.error("Billing record generation error (non-fatal):", billErr)
        }
      } catch (payErr) {
        console.error("Error auto-generating driver pay:", payErr)
      }
    }

    // Log activity to both audit systems
    const adminSupabase = createAdminClient()

    // 1. Global activity_log (master audit log)
    await adminSupabase.from("activity_log").insert({
      entity_type: "load",
      entity_id: id,
      action: "status_changed",
      user_id: user.id,
      details: {
        reference_number: (load as any).reference_number,
        from_status: currentStatus,
        to_status: newStatus,
        changed_by: user.email,
      },
    })

    // 2. Load-specific audit log (load detail AuditTab reads from this)
    const { error: auditLogError } = await adminSupabase.from("load_audit_log").insert({
      load_id: id,
      user_id: user.id,
      user_name: user.email,
      field_changed: "status",
      old_value: currentStatus,
      new_value: newStatus,
      changed_at: new Date().toISOString(),
    })
    if (auditLogError) {
      console.error("Failed to write load_audit_log:", auditLogError)
    } else {
      console.log(`[AuditLog] Wrote status change for load ${id}: ${currentStatus} → ${newStatus}`)
    }

    // Send load_status_update email to customer (fire-and-forget)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadAny = load as any
    const customerEmail = loadAny.customers?.email as string | undefined
    if (customerEmail) {
      sendTemplateEmail({
        templateKey: "load_status_update",
        to: customerEmail,
        variables: {
          customer_name: loadAny.customers?.name || "Customer",
          reference_number: loadAny.reference_number || "",
          container_number: loadAny.containers?.container_number || "",
          old_status: currentStatus,
          new_status: newStatus,
          updated_date: new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        },
      }).catch((err) => console.error("Load status email error:", err))
    }

    return NextResponse.json(load)
  } catch (error) {
    console.error("Error updating load status:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
