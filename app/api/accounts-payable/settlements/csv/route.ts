import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  const raw = String(value)
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n") || safe.includes("\r")) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = profile?.role || "driver"
    if (!["admin", "finance", "accounting"].includes(role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get("type") || "pay-breakdown"
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      )
    }

    let csvContent = ""
    let filename = ""

    if (type === "pay-breakdown") {
      const { data: payData } = await supabase
        .from("ap_driver_pay")
        .select(`
          id,
          driver_id,
          amount,
          created_at,
          drivers!inner(id, name, phone, truck_number)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate)

      csvContent = "Driver Name,Phone,Truck Number,Amount,Date\n"
      payData?.forEach((record: any) => {
        csvContent += [
          escapeCsvValue(record.drivers?.name),
          escapeCsvValue(record.drivers?.phone),
          escapeCsvValue(record.drivers?.truck_number),
          escapeCsvValue(record.amount),
          escapeCsvValue(record.created_at),
        ].join(",") + "\n"
      })
      filename = `pay-breakdown-${new Date().toISOString().split("T")[0]}.csv`
    } else if (type === "deductions") {
      const { data: dedData } = await supabase
        .from("ap_deductions")
        .select(`
          id,
          driver_id,
          deduction_type,
          amount,
          final_amount,
          created_at,
          drivers!inner(id, name, phone)
        `)
        .gte("created_at", startDate)
        .lte("created_at", endDate)

      csvContent = "Driver Name,Phone,Type,Amount,Final Amount,Date\n"
      dedData?.forEach((record: any) => {
        csvContent += [
          escapeCsvValue(record.drivers?.name),
          escapeCsvValue(record.drivers?.phone),
          escapeCsvValue(record.deduction_type),
          escapeCsvValue(record.amount),
          escapeCsvValue(record.final_amount),
          escapeCsvValue(record.created_at),
        ].join(",") + "\n"
      })
      filename = `deductions-${new Date().toISOString().split("T")[0]}.csv`
    } else {
      return NextResponse.json(
        { error: "Invalid CSV export type" },
        { status: 400 }
      )
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error: any) {
    console.error("Error generating CSV:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
