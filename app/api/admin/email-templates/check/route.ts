// app/api/admin/email-templates/check/route.ts
// Diagnostic endpoint to verify Resend API key is available at runtime
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
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

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const key = process.env.RESEND_API_KEY
    const hasKey = !!key && key !== "your_resend_key_here"
    const keyPrefix = key ? key.substring(0, 6) + "..." : "(not set)"

    return NextResponse.json({
      resend_configured: hasKey,
      key_preview: keyPrefix,
      key_length: key?.length ?? 0,
      env_type: key === undefined ? "undefined" : key === "" ? "empty_string" : "has_value",
      // Show which other env vars exist (keys only, not values)
      other_env_vars_present: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL,
      },
    })
  } catch (error) {
    console.error("Error in check endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
