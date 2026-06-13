// app/api/admin/change-password/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can change other users' passwords
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Only admins can change passwords" }, { status: 403 })
    }

    const body = await request.json()
    const { userId, email, newPassword } = body

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // If userId is provided, use it directly
    // If email is provided, look up the user first
    let targetUserId = userId

    if (!targetUserId && email) {
      // Look up user by email
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers()

      if (listError) {
        console.error("Error listing users:", listError)
        return NextResponse.json(
          { error: "Failed to look up user" },
          { status: 500 }
        )
      }

      const targetUser = users.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      )

      if (!targetUser) {
        return NextResponse.json(
          { error: `No user account found with email: ${email}` },
          { status: 404 }
        )
      }

      targetUserId = targetUser.id
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Either userId or email must be provided" },
        { status: 400 }
      )
    }

    // Update the user's password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    )

    if (updateError) {
      console.error("Password update error:", updateError)
      return NextResponse.json(
        { error: updateError.message || "Failed to update password" },
        { status: 500 }
      )
    }

    // Audit log - password changes are security-critical events
    try {
      await adminClient.from("activity_log").insert({
        entity_type: "user_account",
        entity_id: targetUserId,
        action: "password_changed",
        user_id: user.id,
        details: {
          target_user_id: targetUserId,
          target_email: email || "N/A",
          changed_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
