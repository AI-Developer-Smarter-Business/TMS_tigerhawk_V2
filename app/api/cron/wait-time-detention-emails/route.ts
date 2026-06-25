// POST — cron: scan open delivery_wait events and send detention customer emails (WT.32).
// Schedule: vercel.json every 5 min, or Netlify scheduled function with Authorization: Bearer CRON_SECRET.
import { NextRequest, NextResponse } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { processOpenDeliveryWaitEmails } from "@/lib/wait-time/process-open-delivery-wait-emails"

export const maxDuration = 60
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const SYSTEM_CRON_ACTOR_ID = "00000000-0000-4000-8000-000000000001"

async function authorizeCron(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    return profile?.role === "admin" || profile?.role === "dispatcher"
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!(await authorizeCron(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const adminSupabase = createAdminClient()
    const result = await processOpenDeliveryWaitEmails(
      adminSupabase,
      SYSTEM_CRON_ACTOR_ID,
    )

    return NextResponse.json({
      ok: true,
      ...result,
      ran_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[cron/wait-time-detention-emails]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
