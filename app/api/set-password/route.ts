// app/api/set-password/route.ts
// API endpoint for staff users to set their permanent password after
// their first magic link sign-in. Mirrors portal/set-password but for staff roles.
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const STAFF_ROLES = ["admin", "dispatcher", "accounting", "driver"]

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one uppercase letter" },
        { status: 400 }
      )
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one lowercase letter" },
        { status: 400 }
      )
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain at least one number" },
        { status: 400 }
      )
    }

    // Verify the user is authenticated
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: `Not authenticated${userError ? `: ${userError.message}` : ""}. Please sign in again.` },
        { status: 401 }
      )
    }

    // Verify user is a staff role
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("role, password_set")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    if (!STAFF_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: "Only staff users can set passwords here" }, { status: 403 })
    }

    if (profile.password_set) {
      return NextResponse.json(
        { error: "Password already set. Contact an admin to reset your password." },
        { status: 400 }
      )
    }

    // Update the user's password via Supabase Auth admin API
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password,
    })

    if (updateError) {
      console.error("Failed to update password:", updateError.message)
      return NextResponse.json(
        { error: `Failed to set password: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Mark password as set in user_profiles
    const { error: flagError } = await admin
      .from("user_profiles")
      .update({ password_set: true })
      .eq("id", user.id)

    if (flagError) {
      // Password was updated but flag failed — log it, don't fail the request
      console.error("Failed to set password_set flag:", flagError.message)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Set password error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
