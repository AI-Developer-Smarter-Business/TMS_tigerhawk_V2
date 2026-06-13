// app/api/dispatcher/loads/[id]/messages/route.ts
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify load exists
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id")
      .eq("id", id)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from("load_messages")
      .select("*")
      .eq("load_id", id)
      .order("created_at", { ascending: true })

    if (messagesError) {
      console.error("Messages fetch error:", messagesError)
      return NextResponse.json(
        { error: messagesError.message || "Failed to fetch messages" },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: messages })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify load exists
    const { data: load, error: loadError } = await supabase
      .from("loads")
      .select("id, reference_number")
      .eq("id", id)
      .single()

    if (loadError || !load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // Get user info for message
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("name")
      .eq("id", user.id)
      .single()

    // Create message record
    const { data: message, error: insertError } = await supabase
      .from("load_messages")
      .insert({
        load_id: id,
        sender_id: user.id,
        sender_name: profile?.name || user.email,
        message: body.message,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("Message insert error:", insertError)
      return NextResponse.json(
        { error: insertError.message || "Failed to add message" },
        { status: 500 }
      )
    }

    // Log activity
    const adminSupabase = createAdminClient()
    await adminSupabase.from("activity_log").insert({
      entity_type: "load_message",
      entity_id: message.id,
      action: "created",
      user_id: user.id,
      details: {
        load_id: id,
        load_reference: load.reference_number,
        message_preview: body.message.substring(0, 100),
        created_by: user.email,
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error("Error adding message:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
