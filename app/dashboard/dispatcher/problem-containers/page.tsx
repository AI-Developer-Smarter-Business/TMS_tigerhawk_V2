import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ProblemContainersView } from "@/components/dispatcher/ProblemContainersView"
import { LoadWithRelations } from "@/types/dispatcher"

type ProblemContainerWithHolds = LoadWithRelations & {
  holds?: {
    customs: { status: string; note: string | null } | null
    freight: { status: string; note: string | null } | null
    terminal: { status: string; note: string | null } | null
    fees: { status: string; note: string | null } | null
    other: { status: string; note: string | null } | null
    carrier: boolean
  }
  lfdIssue?: {
    type: string
    daysOverdue: number
  } | null
  problemType?: "problem" | "demurrage" | "missed_cutoff" | "empty_return_closed"
}

async function getProblemContainersData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "dispatcher"].includes(profile.role)) {
    redirect("/dashboard")
  }

  // Fetch all loads to categorize into problems
  const { data: allLoads } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line ),
      drivers ( id, name, phone, status )
    `)
    .order("created_at", { ascending: false })

  // Enhance response with hold details
  const detailedProblems: ProblemContainerWithHolds[] = (allLoads || [])
    .map((load) => {
      // Only include loads with holds or issues
      const hasHolds =
        load.freight_hold !== "none" ||
        load.terminal_hold !== "none" ||
        load.fees_hold !== "none" ||
        load.other_hold !== "none" ||
        load.carrier_hold

      const hasLFDIssue =
        load.containers?.last_free_day &&
        new Date(load.containers.last_free_day) < new Date() &&
        load.status !== "Completed"

      const hasCutoffIssue =
        load.load_type === "Export" &&
        load.outgate_date &&
        new Date(load.outgate_date) < new Date() &&
        load.status !== "Completed"

      const needsEmptyReturn =
        load.status === "Delivered" &&
        load.return_location &&
        load.load_type === "Import"

      if (!hasHolds && !hasLFDIssue && !hasCutoffIssue && !needsEmptyReturn) {
        return null
      }

      return {
        ...load,
        holds: {
          freight: load.freight_hold !== "none" ? { status: load.freight_hold, note: load.freight_hold_note } : null,
          terminal: load.terminal_hold !== "none" ? { status: load.terminal_hold, note: load.terminal_hold_note } : null,
          fees: load.fees_hold !== "none" ? { status: load.fees_hold, note: load.fees_hold_note } : null,
          other: load.other_hold !== "none" ? { status: load.other_hold, note: load.other_hold_note } : null,
          carrier: load.carrier_hold || false,
        },
      }
    })
    .filter((load): load is ProblemContainerWithHolds => load !== null)

  // Categorize problems
  const problemContainers = detailedProblems.filter(
    (load) =>
      load.freight_hold === "hold" ||
      load.terminal_hold === "hold" ||
      load.fees_hold === "hold"
  )

  const demurrage = detailedProblems.filter(
    (load) =>
      load.containers?.last_free_day &&
      new Date(load.containers.last_free_day) < new Date() &&
      load.status !== "Completed"
  )

  const missedCutOff = detailedProblems.filter(
    (load) =>
      load.load_type === "Export" &&
      load.outgate_date &&
      new Date(load.outgate_date) < new Date() &&
      load.status !== "Completed"
  )

  const emptyReturnClosed = detailedProblems.filter(
    (load) =>
      load.status === "Delivered" &&
      load.return_location &&
      load.load_type === "Import"
  )

  return {
    problemContainers: detailedProblems,
    summary: {
      problemContainerCount: problemContainers.length,
      demurrageCount: demurrage.length,
      missedCutOffCount: missedCutOff.length,
      emptyReturnClosedCount: emptyReturnClosed.length,
    },
  }
}

export default async function ProblemContainersPage() {
  const { problemContainers, summary } = await getProblemContainersData()

  return (
    <div className="bg-[#0B1120] rounded-xl border border-white/5 p-6">
      <ProblemContainersView
        problemContainersData={problemContainers}
        summary={summary}
      />
    </div>
  )
}
