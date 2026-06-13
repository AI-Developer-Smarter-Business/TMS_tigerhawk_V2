// app/api/admin/users/mfa/route.ts
// Admin API for managing user MFA (2FA) settings — disable/unenroll TOTP factors
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

// DELETE — Remove all MFA factors for a user (disable 2FA)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can manage MFA
    const { data: callerProfile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Get the user's auth data to find their MFA factors
    const { data: authUserData, error: getUserError } = await adminClient.auth.admin.getUserById(userId)
    if (getUserError || !authUserData?.user) {
      console.error("Error fetching user for MFA:", getUserError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const factors = authUserData.user.factors

    if (!factors || factors.length === 0) {
      return NextResponse.json({ error: "User has no MFA factors enrolled" }, { status: 400 })
    }

    // Unenroll all TOTP factors
    let unenrolled = 0
    const errors: string[] = []

    for (const factor of factors) {
      if (factor.factor_type === "totp") {
        const { error: unenrollError } = await adminClient.auth.admin.mfa.deleteFactor({
          id: factor.id,
          userId,
        })
        if (unenrollError) {
          errors.push(`Factor ${factor.id}: ${unenrollError.message}`)
        } else {
          unenrolled++
        }
      }
    }

    if (unenrolled === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: `Failed to unenroll MFA factors: ${errors.join("; ")}` },
        { status: 500 },
      )
    }

    // Audit log
    try {
      await adminClient.from("activity_log").insert({
        entity_type: "user_account",
        entity_id: userId,
        action: "mfa_disabled",
        user_id: user.id,
        details: {
          target_email: authUserData.user.email,
          factors_removed: unenrolled,
          disabled_by: user.email,
        },
      })
    } catch (err) {
      console.error("Audit log error:", err)
    }

    return NextResponse.json({
      success: true,
      factors_removed: unenrolled,
    })
  } catch (error) {
    console.error("Error in DELETE /api/admin/users/mfa:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
