// app/api/admin/portal-users/route.ts
// Admin API: create and manage customer portal user accounts
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

// GET: list all portal users
export async function GET() {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin or dispatcher role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch all customer portal users with their customer info
    const adminSupabase = createAdminClient()
    const { data: portalUsers, error } = await adminSupabase
      .from("user_profiles")
      .select(`
        id,
        full_name,
        email,
        role,
        customer_id,
        customers (
          id, name, email
        )
      `)
      .eq("role", "customer")
      .order("full_name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ portalUsers: portalUsers || [] })
  } catch (error) {
    console.error("Portal users list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE: remove a portal user
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = new URL(request.url)
    const userId = url.searchParams.get("id")
    if (!userId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Verify the user is actually a customer (don't allow deleting staff)
    const { data: targetProfile } = await adminSupabase
      .from("user_profiles")
      .select("role")
      .eq("id", userId)
      .single()

    if (!targetProfile || targetProfile.role !== "customer") {
      return NextResponse.json({ error: "User is not a portal user" }, { status: 400 })
    }

    // Delete auth user first — if this fails, profile remains intact and user can retry
    const { error: authError } = await adminSupabase.auth.admin.deleteUser(userId)
    if (authError) {
      console.error("Delete auth user error:", authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Then delete the profile (auth user is already gone, so this is safe to fail)
    const { error: profileDeleteError } = await adminSupabase
      .from("user_profiles")
      .delete()
      .eq("id", userId)

    if (profileDeleteError) {
      console.error("Delete user profile error (auth user already deleted):", profileDeleteError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Portal user delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH: send magic link invite to a portal user
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { email } = body
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 })
    }

    // Use a stateless anon client so the admin's cookies don't interfere
    const anonClient = createAnonClient()
    const { error } = await anonClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://tms.tigerhawklogistics.com"}/auth/callback`,
      },
    })

    if (error) {
      console.error("OTP send error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Login code sent" })
  } catch (error) {
    console.error("Portal user invite error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: create a new customer portal user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin or dispatcher role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { email, full_name, customer_id } = body

    if (!email || !customer_id) {
      return NextResponse.json(
        { error: "Email and customer_id are required" },
        { status: 400 }
      )
    }

    // Verify customer exists
    const adminSupabase = createAdminClient()
    const { data: customer, error: custError } = await adminSupabase
      .from("customers")
      .select("id, name")
      .eq("id", customer_id)
      .single()

    if (custError || !customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 })
    }

    // Check if a user with this email already exists
    const { data: existingUsers } = await adminSupabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (existingUser) {
      // Check if they already have a profile
      const { data: existingProfile } = await adminSupabase
        .from("user_profiles")
        .select("id, role, customer_id")
        .eq("id", existingUser.id)
        .single()

      if (existingProfile) {
        if (existingProfile.role === "customer" && existingProfile.customer_id === customer_id) {
          return NextResponse.json(
            { error: "This user already has portal access for this customer" },
            { status: 409 }
          )
        }
        if (existingProfile.role !== "customer") {
          return NextResponse.json(
            { error: "This email belongs to a staff account. Use a different email for portal access." },
            { status: 409 }
          )
        }
      }
    }

    // Create auth user (or use existing) with a random password
    // (they will use magic links to sign in, so the password is just a placeholder)
    let authUserId: string

    if (existingUser) {
      authUserId = existingUser.id
    } else {
      const randomPassword = crypto.randomUUID() + "Aa1!" // Meets complexity requirements
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true, // Auto-confirm since admin is creating it
      })

      if (createError) {
        console.error("Create auth user error:", createError)
        return NextResponse.json(
          { error: `Failed to create user: ${createError.message}` },
          { status: 500 }
        )
      }

      authUserId = newUser.user.id
    }

    // Create or update user_profiles entry
    const { error: profileError } = await adminSupabase
      .from("user_profiles")
      .upsert({
        id: authUserId,
        email,
        full_name: full_name || email.split("@")[0],
        role: "customer",
        customer_id,
      })

    if (profileError) {
      console.error("Profile upsert error:", profileError)
      return NextResponse.json(
        { error: `Failed to create profile: ${profileError.message}` },
        { status: 500 }
      )
    }

    // Send magic link invite using a stateless client (no admin cookie interference)
    const anonClient = createAnonClient()
    const { error: inviteError } = await anonClient.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://tms.tigerhawklogistics.com"}/auth/callback`,
      },
    })

    if (inviteError) {
      // User was created but invite failed — return success with warning
      console.error("Auto-invite error:", inviteError)
      return NextResponse.json(
        {
          success: true,
          inviteWarning: `User created but magic link failed to send: ${inviteError.message}. Use the "Send Invite" button to retry.`,
          user: {
            id: authUserId,
            email,
            full_name: full_name || email.split("@")[0],
            customer_id,
            customer_name: customer.name,
          },
        },
        { status: 201 }
      )
    }

    // Send welcome email via template (fire-and-forget, doesn't block response)
    sendTemplateEmail({
      templateKey: "portal_welcome",
      to: email,
      variables: {
        customer_name: full_name || email.split("@")[0],
        company_name: customer.name,
        portal_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://tms.tigerhawklogistics.com"}/login`,
      },
    }).catch((err) => console.error("Portal welcome email error:", err))

    return NextResponse.json(
      {
        success: true,
        user: {
          id: authUserId,
          email,
          full_name: full_name || email.split("@")[0],
          customer_id,
          customer_name: customer.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Portal user creation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
