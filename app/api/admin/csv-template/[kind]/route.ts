import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { readFileSync } from "fs"
import { join } from "path"

const ALLOWED = new Set(["drivers", "driver_groups"])

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
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

  const { kind } = await context.params
  if (!ALLOWED.has(kind)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const fileName =
    kind === "drivers"
      ? "drivers_import_template.csv"
      : "driver_groups_import_template.csv"

  const filePath = join(process.cwd(), "docs", "csv_templates", fileName)

  try {
    const csv = readFileSync(filePath, "utf-8")
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }
}
