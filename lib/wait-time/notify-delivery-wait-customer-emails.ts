import type { SupabaseClient } from "@supabase/supabase-js"

import { maybeAlertForgottenDeliveryWait } from "@/lib/wait-time/forgotten-delivery-wait"
import { maybeNotifyDetentionCompleted } from "@/lib/wait-time/notify-detention-completed"
import { maybeNotifyDetentionStarted } from "@/lib/wait-time/notify-detention-started"
import { maybeNotifyDetentionWarning45 } from "@/lib/wait-time/notify-detention-warning-45"
import type { WaitEventEmailRow } from "@/lib/wait-time/detention-email-shared"

/** Run all customer detention emails applicable to the current event state. */
export async function notifyDeliveryWaitCustomerEmails(
  adminSupabase: SupabaseClient,
  event: WaitEventEmailRow,
  actorUserId: string,
): Promise<void> {
  await maybeNotifyDetentionWarning45(adminSupabase, event, actorUserId)
  await maybeNotifyDetentionStarted(adminSupabase, event, actorUserId)
  if (event.end_time) {
    await maybeNotifyDetentionCompleted(adminSupabase, event, actorUserId)
  }
}

export async function notifyOpenDeliveryWaitSideEffects(
  adminSupabase: SupabaseClient,
  event: WaitEventEmailRow,
  actorUserId: string,
): Promise<void> {
  await maybeAlertForgottenDeliveryWait(adminSupabase, event, actorUserId)
  await notifyDeliveryWaitCustomerEmails(adminSupabase, event, actorUserId)
}
