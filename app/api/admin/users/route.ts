// app/api/admin/users/route.ts
// Admin API for managing staff user accounts (admin, dispatcher, accounting, driver)
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { sendTemplateEmail } from "@/lib/email/sendTemplateEmail"
import { NextRequest, NextResponse } from "next/server"

/**
 * Create a stateless Supabase client with NO cookies / NO session.
 * Used exclusively for signInWithOtp so the admin's auth state
 * doesn't interfere with the OTP email delivery.
 */
function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

const STAFF_ROLES = ["admin", "dispatcher", "accounting", "driver"] as const
type StaffRole = (typeof STAFF_ROLES)[number]

// GET — List all staff users (non-customer accounts)
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can manage staff users
    const { data: callerProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Fetch all staff user profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("id, full_name, role, created_at")
      .in("role", STAFF_ROLES as unknown as string[])
      .order("created_at", { ascending: false })

    if (profilesError) {
      console.error("Error fetching user profiles:", profilesError)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    // Fetch auth user emails in bulk using admin client
    const adminClient = createAdminClient()
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    })

    if (authError) {
      console.error("Error fetching auth users:", authError)
      return NextResponse.json({ error: "Failed to fetch user emails" }, { status: 500 })
    }

    // Build email lookup map
    const emailMap = new Map<string, {
      email: string
      last_sign_in_at: string | null
      created_at: string
    }>()
    for (const au of authUsers.users) {
      emailMap.set(au.id, {
        email: au.email || "",
        last_sign_in_at: au.last_sign_in_at || null,
        created_at: au.created_at,
      })
    }

    // Fetch MFA factor status per staff user in parallel
    // listUsers() doesn't reliably include factors, so use the dedicated admin MFA endpoint
    const profileIds = (profiles || []).map((p) => p.id)
    const mfaResults = await Promise.all(
      profileIds.map(async (uid) => {
        try {
          const { data } = await adminClient.auth.admin.mfa.listFactors({ userId: uid })
          const hasVerified = Array.isArray(data?.factors)
            && data.factors.some((f) => f.status === "verified" && f.factor_type === "totp")
          return { uid, mfa_enabled: hasVerified }
        } catch {
          return { uid, mfa_enabled: false }
        }
      })
    )
    const mfaMap = new Map(mfaResults.map((r) => [r.uid, r.mfa_enabled]))

    // Merge profile data with auth data + MFA status
    const users = (profiles || []).map((p) => {
      const auth = emailMap.get(p.id)
      return {
        id: p.id,
        full_name: p.full_name,
        email: auth?.email || null,
        role: p.role,
        last_sign_in_at: auth?.last_sign_in_at || null,
        created_at: p.created_at,
        mfa_enabled: mfaMap.get(p.id) || false,
      }
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error in GET /api/admin/users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST — Create a new staff user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { email, full_name, role } = body

    // Validate required fields
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    if (!role || !STAFF_ROLES.includes(role as StaffRole)) {
      return NextResponse.json(
        { error: `Role must be one of: ${STAFF_ROLES.join(", ")}` },
        { status: 400 }
      )
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Check if a user with this email already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    )

    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 })
    }

    // Create auth user with a random password (they will set their own via magic link)
    const randomPassword = crypto.randomUUID() + "Aa1!" // Meets complexity requirements
    const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password: randomPassword,
      email_confirm: true, // Auto-confirm since admin is creating it
    })

    if (createError) {
      console.error("Error creating auth user:", createError)
      if (createError.message?.includes("already been registered") || createError.message?.includes("duplicate")) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message || "Failed to create user" }, { status: 500 })
    }

    if (!newAuthUser.user) {
      return NextResponse.json({ error: "User creation failed" }, { status: 500 })
    }

    // Create user profile (upsert to handle retries where auth user exists but profile failed)
    const { error: profileError } = await adminClient
      .from("user_profiles")
      .upsert({
        id: newAuthUser.user.id,
        email: email.toLowerCase().trim(),
        full_name: full_name?.trim() || null,
        role,
      }, { onConflict: "id" })

    if (profileError) {
      console.error("Error creating user profile:", profileError)
      // Clean up auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(newAuthUser.user.id)
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 })
    }

    // Send magic link invite using a stateless client (no admin cookie interference)
    const anonClient = createAnonClient()
    const { error: otpError } = await anonClient.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://tms.tigerhawklogistics.com"}/auth/callback`,
      },
    })

    if (otpError) {
      // User was created but invite failed — return success with warning
      console.error("Auto-invite error:", otpError)

      // Audit log
      try {
        await adminClient.from("activity_log").insert({
          entity_type: "user_account",
          entity_id: newAuthUser.user.id,
          action: "created",
          user_id: user.id,
          details: {
            email: email.trim(),
            full_name: full_name?.trim() || null,
            role,
            created_by: user.email,
            invite_warning: otpError.message,
          },
        })
      } catch (err) {
        console.error("Audit log error:", err)
      }

      return NextResponse.json(
        {
          success: true,
          inviteWarning: `User created but magic link failed to send: ${otpError.message}. Use the "Send Invite" button to retry.`,
          user: {
            id: newAuthUser.user.id,
            email: email.trim(),
            full_name: full_name?.trim() || null,
            role,
          },
        },
        { status: 201 }
      )
    }

    // Send welcome email via template (fire-and-forget, doesn't block response)
    sendTemplateEmail({
      templateKey: "staff_welcome",
      to: email.trim(),
      variables: {
        staff_name: full_name?.trim() || email.split("@")[0],
        role: role.charAt(0).toUpperCase() + role.slice(1),
        login_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://tms.tigerhawklogistics.com"}/login`,
      },
    }).catch((err) => console.error("Staff welcome email error:", err))

    // Audit log
    try {
      await adminClient.from("activity_log").insert({
        entity_type: "user_account",
        entity_id: newAuthUser.user.id,
        action: "created",
        user_id: user.id,
        details: {
          email: email.trim(),
          full_name: full_name?.trim() || null,
          role,
          created_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newAuthUser.user.id,
          email: email.trim(),
          full_name: full_name?.trim() || null,
          role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error in POST /api/admin/users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH — Update a staff user's role or name
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role, full_name, sendInvite, email: inviteEmail } = body

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    // ─── Send magic link invite (resend) ─────────────────────
    if (sendInvite && inviteEmail) {
      const anonClient = createAnonClient()
      const { error: otpError } = await anonClient.auth.signInWithOtp({
        email: inviteEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://tms.tigerhawklogistics.com"}/auth/callback`,
        },
      })

      if (otpError) {
        console.error("OTP send error:", otpError)
        return NextResponse.json({ error: otpError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: "Magic link sent" })
    }

    // ─── Update role/name ────────────────────────────────────
    // Prevent admin from demoting themselves
    if (userId === user.id && role && role !== "admin") {
      return NextResponse.json({ error: "You cannot change your own admin role" }, { status: 400 })
    }

    // Build update object
    const updates: Record<string, string> = {}
    if (role) {
      if (!STAFF_ROLES.includes(role as StaffRole)) {
        return NextResponse.json(
          { error: `Role must be one of: ${STAFF_ROLES.join(", ")}` },
          { status: 400 }
        )
      }
      updates.role = role
    }
    if (full_name !== undefined) {
      updates.full_name = full_name?.trim() || ""
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { error: updateError } = await adminClient
      .from("user_profiles")
      .update(updates)
      .eq("id", userId)

    if (updateError) {
      console.error("Error updating user profile:", updateError)
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
    }

    // Audit log
    try {
      await adminClient.from("activity_log").insert({
        entity_type: "user_account",
        entity_id: userId,
        action: "updated",
        user_id: user.id,
        details: {
          changes: updates,
          changed_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in PATCH /api/admin/users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE — Deactivate a staff user (delete auth account, keep profile for audit trail)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: callerProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("id")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
    }

    // Verify target is a staff user (not a customer)
    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("role, full_name")
      .eq("id", userId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (targetProfile.role === "customer") {
      return NextResponse.json(
        { error: "Customer users should be managed from the Portal Users page" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Get email before deletion for audit trail
    const { data: authUserData } = await adminClient.auth.admin.getUserById(userId)
    const targetEmail = authUserData?.user?.email || "unknown"

    // Delete the auth user (this prevents login)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError)
      return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
    }

    // Audit log
    try {
      await adminClient.from("activity_log").insert({
        entity_type: "user_account",
        entity_id: userId,
        action: "deleted",
        user_id: user.id,
        details: {
          deleted_email: targetEmail,
          deleted_name: targetProfile.full_name,
          deleted_role: targetProfile.role,
          deleted_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/admin/users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
