import type { SupabaseClient } from "@supabase/supabase-js"

import { sendTemplateEmail } from "@/lib/email/sendTemplateEmail"
import { resolveDetentionEmailCc } from "@/lib/wait-time/constants"

export type WaitEventEmailRow = {
  id: string
  load_id: string
  event_name: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  free_time_minutes: number | null
  charge_amount?: number | null
  billable?: boolean | null
  rate_per_hour?: number | null
}

export type LoadEmailContext = {
  id: string
  reference_number: string | null
  delivery_location: string | null
  customers: {
    name: string | null
    email: string | null
    phone: string | null
  } | null
  containers: { container_number: string | null } | null
}

export type LoadEmailRow = {
  id: string
  reference_number: string | null
  delivery_location: string | null
  customers:
    | { name: string | null; email: string | null; phone: string | null }
    | { name: string | null; email: string | null; phone: string | null }[]
    | null
  containers:
    | { container_number: string | null }
    | { container_number: string | null }[]
    | null
}

const LOAD_WAIT_EMAIL_SELECT = `
  id,
  reference_number,
  delivery_location,
  customers ( name, email, phone ),
  containers ( container_number )
`

function firstJoinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function normalizeLoadEmailContext(row: LoadEmailRow): LoadEmailContext {
  return {
    id: row.id,
    reference_number: row.reference_number,
    delivery_location: row.delivery_location,
    customers: firstJoinedRow(row.customers),
    containers: firstJoinedRow(row.containers),
  }
}

export async function fetchLoadEmailContext(
  adminSupabase: SupabaseClient,
  loadId: string,
): Promise<LoadEmailContext | null> {
  const { data: load, error } = await adminSupabase
    .from("loads")
    .select(LOAD_WAIT_EMAIL_SELECT)
    .eq("id", loadId)
    .maybeSingle()

  if (error || !load) {
    console.error("[detention-email] load fetch failed:", error?.message)
    return null
  }

  return normalizeLoadEmailContext(load as LoadEmailRow)
}

export function resolvePrimaryCustomerEmail(load: LoadEmailContext): string | null {
  const email = load.customers?.email?.trim()
  return email || null
}

export function formatDetentionUsd(amount: number | null | undefined): string {
  const value = Number(amount)
  if (!Number.isFinite(value) || value <= 0) return "—"
  return `$${value.toFixed(2)}`
}

export async function hasDetentionEmailTerminalLog(
  adminSupabase: SupabaseClient,
  eventId: string,
  terminalActions: readonly string[],
): Promise<boolean> {
  const { data } = await adminSupabase
    .from("activity_log")
    .select("id")
    .eq("entity_type", "waiting_time_event")
    .eq("entity_id", eventId)
    .in("action", [...terminalActions])
    .limit(1)
    .maybeSingle()

  return Boolean(data)
}

export async function logDetentionEmailActivity(
  adminSupabase: SupabaseClient,
  params: {
    eventId: string
    loadId: string
    actorUserId: string
    action: string
    logType: string
    templateKey: string
    recipient?: string | null
    messageId?: string | null
    error?: string | null
    templateInactive?: boolean
    durationMinutes?: number
  },
): Promise<void> {
  await adminSupabase.from("activity_log").insert({
    entity_type: "waiting_time_event",
    entity_id: params.eventId,
    action: params.action,
    user_id: params.actorUserId,
    details: {
      type: params.logType,
      template_key: params.templateKey,
      load_id: params.loadId,
      event_id: params.eventId,
      recipient: params.recipient ?? null,
      message_id: params.messageId ?? null,
      error: params.error ?? null,
      template_inactive: params.templateInactive ?? false,
      duration_minutes: params.durationMinutes ?? null,
    },
  })
}

export type DetentionEmailSendConfig = {
  templateKey: string
  logType: string
  terminalActions: readonly string[]
  sentAction: string
  failedAction: string
  skippedInactiveAction: string
  skippedNoRecipientAction: string
}

export async function sendDetentionCustomerEmail(
  adminSupabase: SupabaseClient,
  params: {
    event: WaitEventEmailRow
    actorUserId: string
    load: LoadEmailContext
    durationMinutes: number
    config: DetentionEmailSendConfig
    variables: Record<string, string>
  },
): Promise<boolean> {
  const { event, actorUserId, load, durationMinutes, config, variables } = params
  const customerEmail = resolvePrimaryCustomerEmail(load)

  if (!customerEmail) {
    await logDetentionEmailActivity(adminSupabase, {
      eventId: event.id,
      loadId: event.load_id,
      actorUserId,
      action: config.skippedNoRecipientAction,
      logType: config.logType,
      templateKey: config.templateKey,
      durationMinutes,
    })
    return false
  }

  const emailResult = await sendTemplateEmail({
    templateKey: config.templateKey,
    to: customerEmail,
    variables,
    cc: resolveDetentionEmailCc(),
  })

  if (emailResult.templateInactive) {
    await logDetentionEmailActivity(adminSupabase, {
      eventId: event.id,
      loadId: event.load_id,
      actorUserId,
      action: config.skippedInactiveAction,
      logType: config.logType,
      templateKey: config.templateKey,
      recipient: customerEmail,
      templateInactive: true,
      durationMinutes,
    })
    return false
  }

  if (!emailResult.success) {
    await logDetentionEmailActivity(adminSupabase, {
      eventId: event.id,
      loadId: event.load_id,
      actorUserId,
      action: config.failedAction,
      logType: config.logType,
      templateKey: config.templateKey,
      recipient: customerEmail,
      error: emailResult.error ?? "Unknown error",
      durationMinutes,
    })
    return false
  }

  await logDetentionEmailActivity(adminSupabase, {
    eventId: event.id,
    loadId: event.load_id,
    actorUserId,
    action: config.sentAction,
    logType: config.logType,
    templateKey: config.templateKey,
    recipient: customerEmail,
    messageId: emailResult.messageId ?? null,
    durationMinutes,
  })

  return true
}
