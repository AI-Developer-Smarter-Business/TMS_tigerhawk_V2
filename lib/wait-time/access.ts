import type { SupabaseClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

const STAFF_ROLES = ["admin", "dispatcher"] as const

export type WaitTimeAccess = {
  role: string | null
  isStaff: boolean
  isAssignedDriver: boolean
  canManage: boolean
}

export async function resolveWaitTimeAccess(
  supabase: SupabaseClient,
  user: User,
  loadId: string,
): Promise<WaitTimeAccess> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role ?? null
  const isStaff = role !== null && (STAFF_ROLES as readonly string[]).includes(role)

  let isAssignedDriver = false
  if (role === "driver") {
    const { data: load } = await supabase
      .from("loads")
      .select("driver_id")
      .eq("id", loadId)
      .single()
    isAssignedDriver = load?.driver_id === user.id
  }

  return {
    role,
    isStaff,
    isAssignedDriver,
    canManage: isStaff || isAssignedDriver,
  }
}
