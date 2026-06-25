// app/api/dispatcher/loads/[id]/wait-time/route.ts
// Log, list, and update wait time events for a load.
// WT.8: Bearer auth for mobile drivers; open events (start_time only).
import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/supabase/get-user-from-request"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveWaitTimeAccess } from "@/lib/wait-time/access"
import { resolveWaitEventDriverId } from "@/lib/wait-time/resolve-event-driver-id"
import { maybeNotifyWaitExceeded } from "@/lib/wait-time/notify-exceeded"
import { notifyOpenDeliveryWaitSideEffects } from "@/lib/wait-time/notify-delivery-wait-customer-emails"
import { syncWaitEventToLoadBilling } from "@/lib/wait-time/sync-load-billing"

const VALID_EVENTS = [
  "pickup_wait",
  "delivery_wait",
  "return_wait",
  "customs_hold",
  "yard_wait",
  "other",
] as const

const WAIT_EVENT_SELECT =
  "id, load_id, driver_id, event_name, event_date, start_time, end_time, duration_minutes, location, billable, rate_per_hour, charge_amount, free_time_minutes, driver_payable, driver_rate_per_hour, driver_pay_amount, notes, logged_by, created_at, updated_at"

type Props = { params: Promise<{ id: string }> }

function computeDurationFromTimes(startTime: string, endTime: string): number {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

async function notifyIfBillable(
  event: Record<string, unknown>,
  load: { id: string; reference_number: string | null; driver_id: string | null },
  actorUserId: string,
) {
  try {
    const admin = createAdminClient()
    await maybeNotifyWaitExceeded(
      admin,
      {
        id: event.id as string,
        load_id: event.load_id as string,
        driver_id: (event.driver_id as string | null) ?? null,
        duration_minutes: (event.duration_minutes as number | null) ?? 0,
        free_time_minutes: (event.free_time_minutes as number | null) ?? 60,
        charge_amount: (event.charge_amount as number | null) ?? null,
        billable: (event.billable as boolean | null) ?? true,
      },
      load,
      actorUserId,
    )
  } catch {
    // Non-fatal — billing still applied via trigger
  }
}

async function notifyDeliveryWaitEmailsIfDue(
  adminSupabase: ReturnType<typeof createAdminClient>,
  event: Record<string, unknown>,
  actorUserId: string,
) {
  try {
    await notifyOpenDeliveryWaitSideEffects(
      adminSupabase,
      {
        id: event.id as string,
        load_id: event.load_id as string,
        event_name: event.event_name as string,
        start_time: (event.start_time as string | null) ?? null,
        end_time: (event.end_time as string | null) ?? null,
        duration_minutes: (event.duration_minutes as number | null) ?? null,
        free_time_minutes: (event.free_time_minutes as number | null) ?? null,
        charge_amount: (event.charge_amount as number | null) ?? null,
        billable: (event.billable as boolean | null) ?? null,
        rate_per_hour: (event.rate_per_hour as number | null) ?? null,
      },
      actorUserId,
    )
  } catch (err) {
    console.error("[wait-time] detention customer emails:", err)
  }
}

// ─── GET: List wait time events for this load ───
export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params
    const { user, supabase } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await resolveWaitTimeAccess(supabase, user, id)
    if (!access.canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from("waiting_time_events")
      .select(WAIT_EVENT_SELECT)
      .eq("load_id", id)
      .order("event_date", { ascending: false })

    if (error) {
      console.error("Wait time fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch wait time events" }, { status: 500 })
    }

    const totalMinutes = data?.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) || 0
    const totalBillable = data?.reduce((sum, e) => sum + (e.charge_amount || 0), 0) || 0
    const totalDriverPay = data?.reduce((sum, e) => sum + (e.driver_pay_amount || 0), 0) || 0

    return NextResponse.json({
      events: data || [],
      summary: {
        count: data?.length || 0,
        total_minutes: totalMinutes,
        total_hours: Math.round((totalMinutes / 60) * 100) / 100,
        total_billable: totalBillable,
        total_driver_pay: totalDriverPay,
      },
    })
  } catch (error) {
    console.error("Error fetching wait time:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── POST: Log a new wait time event ───
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params
    const { user, supabase } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await resolveWaitTimeAccess(supabase, user, id)
    if (!access.canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    if (!body.event_name || !VALID_EVENTS.includes(body.event_name)) {
      return NextResponse.json(
        { error: `event_name must be one of: ${VALID_EVENTS.join(", ")}` },
        { status: 400 },
      )
    }

    const hasDuration = body.duration_minutes !== undefined && body.duration_minutes !== null
    const hasStart = Boolean(body.start_time)
    const hasEnd = Boolean(body.end_time)

    // WT.8: allow open event with start_time only (mobile auto-start on Arrived At Delivery)
    if (!hasDuration && !hasStart) {
      return NextResponse.json(
        { error: "Provide duration_minutes or start_time (optionally with end_time)" },
        { status: 400 },
      )
    }

    if (hasStart && hasEnd && !hasDuration) {
      const durationMinutes = computeDurationFromTimes(body.start_time, body.end_time)
      if (durationMinutes < 0) {
        return NextResponse.json({ error: "end_time must be after start_time" }, { status: 400 })
      }
    }

    const { data: load, error: loadErr } = await supabase
      .from("loads")
      .select("id, driver_id, reference_number")
      .eq("id", id)
      .single()

    if (loadErr || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    let durationMinutes = Number(body.duration_minutes) || 0
    if (body.start_time && body.end_time) {
      durationMinutes = computeDurationFromTimes(body.start_time, body.end_time)
    }

    const loggedBy =
      body.logged_by ||
      (access.isAssignedDriver && !access.isStaff ? "driver" : "dispatcher")

    const adminSupabase = createAdminClient()

    if (body.event_name === "delivery_wait" && body.start_time && !body.end_time) {
      const { data: existingOpen } = await adminSupabase
        .from("waiting_time_events")
        .select("id, start_time, end_time")
        .eq("load_id", id)
        .eq("event_name", "delivery_wait")
        .is("end_time", null)
        .not("start_time", "is", null)
        .limit(1)
        .maybeSingle()

      if (existingOpen) {
        return NextResponse.json(existingOpen, { status: 200 })
      }
    }

    const insertData = {
      load_id: id,
      driver_id:
        body.driver_id ||
        (await resolveWaitEventDriverId(adminSupabase, load.driver_id)),
      event_name: body.event_name,
      event_date: body.event_date || new Date().toISOString(),
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      duration_minutes: durationMinutes,
      location: body.location || null,
      billable: body.billable !== false,
      rate_per_hour: body.rate_per_hour ?? 75.0,
      free_time_minutes: body.free_time_minutes ?? 60,
      driver_payable: body.driver_payable !== false,
      driver_rate_per_hour: body.driver_rate_per_hour ?? 75.0,
      notes: body.notes || null,
      logged_by: loggedBy,
    }

    const { data: event, error: insertErr } = await adminSupabase
      .from("waiting_time_events")
      .insert(insertData)
      .select()
      .single()

    if (insertErr) {
      console.error("Wait time insert error:", insertErr)
      return NextResponse.json(
        { error: insertErr.message || "Failed to log wait time" },
        { status: 500 },
      )
    }

    await notifyIfBillable(event, load, user.id)
    await notifyDeliveryWaitEmailsIfDue(adminSupabase, event, user.id)
    if (event.end_time) {
      await syncWaitEventToLoadBilling(adminSupabase, id, event)
    }

    await adminSupabase.from("activity_log").insert({
      entity_type: "waiting_time_event",
      entity_id: event.id,
      action: "created",
      user_id: user.id,
      details: {
        load_id: id,
        reference_number: load.reference_number,
        event_name: body.event_name,
        duration_minutes: durationMinutes,
        logged_by: insertData.logged_by,
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error("Error logging wait time:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── PATCH: Update an existing wait time event ───
export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { id } = await params
    const { user, supabase } = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await resolveWaitTimeAccess(supabase, user, id)
    if (!access.canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    if (!body.event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const { data: existingEvent } = await adminSupabase
      .from("waiting_time_events")
      .select("start_time, end_time, duration_minutes")
      .eq("id", body.event_id)
      .eq("load_id", id)
      .single()

    const updateData: Record<string, unknown> = {}
    if (body.duration_minutes !== undefined) {
      updateData.duration_minutes = Number(body.duration_minutes)
    }
    if (body.start_time !== undefined) updateData.start_time = body.start_time
    if (body.end_time !== undefined) updateData.end_time = body.end_time
    if (body.location !== undefined) updateData.location = body.location
    if (body.billable !== undefined) updateData.billable = body.billable
    if (body.rate_per_hour !== undefined) updateData.rate_per_hour = Number(body.rate_per_hour)
    if (body.free_time_minutes !== undefined) {
      updateData.free_time_minutes = Number(body.free_time_minutes)
    }
    if (body.driver_payable !== undefined) updateData.driver_payable = body.driver_payable
    if (body.driver_rate_per_hour !== undefined) {
      updateData.driver_rate_per_hour = Number(body.driver_rate_per_hour)
    }
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.event_name !== undefined) {
      if (!VALID_EVENTS.includes(body.event_name)) {
        return NextResponse.json({ error: "Invalid event_name" }, { status: 400 })
      }
      updateData.event_name = body.event_name
    }

    const startTime = (body.start_time ?? existingEvent?.start_time) as string | null
    const endTime = (body.end_time ?? existingEvent?.end_time) as string | null
    if (startTime && endTime && body.duration_minutes === undefined) {
      updateData.duration_minutes = computeDurationFromTimes(startTime, endTime)
    }

    const { data: event, error: updateErr } = await adminSupabase
      .from("waiting_time_events")
      .update(updateData)
      .eq("id", body.event_id)
      .eq("load_id", id)
      .select()
      .single()

    if (updateErr) {
      console.error("Wait time update error:", updateErr)
      return NextResponse.json({ error: updateErr.message || "Failed to update" }, { status: 500 })
    }

    const { data: load } = await supabase
      .from("loads")
      .select("id, reference_number, driver_id")
      .eq("id", id)
      .single()

    if (load && event) {
      await notifyIfBillable(event, load, user.id)
      await notifyDeliveryWaitEmailsIfDue(adminSupabase, event, user.id)
      if (event.end_time) {
        await syncWaitEventToLoadBilling(adminSupabase, id, event)
      }
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error("Error updating wait time:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
