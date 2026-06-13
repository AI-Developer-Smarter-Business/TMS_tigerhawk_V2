// app/api/admin/customers/route.ts
// Simple customer list for admin screens (portal user assignment, etc.)
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

    if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: customers, error } = await supabase
      .from("customers")
      .select("id, name, email, city, state")
      .order("name")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ customers: customers || [] })
  } catch (error) {
    console.error("Error fetching customers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
