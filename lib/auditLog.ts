// lib/auditLog.ts
// Lightweight audit-log helper — fire-and-forget insert into activity_log.
// Uses the service-role client so RLS is bypassed.

import { createAdminClient } from "@/lib/supabase/admin"

export type AuditEntry = {
  entity_type: string
  entity_id: string
  action: string
  user_id: string
  details?: Record<string, unknown>
}

/**
 * Insert an audit log entry. Swallows errors so it never blocks the caller.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from("activity_log").insert(entry)
  } catch (err) {
    console.error("Audit log insert failed:", err)
  }
}
