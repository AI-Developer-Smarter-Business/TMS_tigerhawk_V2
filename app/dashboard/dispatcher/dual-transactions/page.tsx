import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DualTransactionsView } from "@/components/dispatcher/DualTransactionsView"
import { rowToDualPairSlice } from "@/lib/dual-transaction-load-adapter"
import { dualPairCompatible, pairEmptyMilesSaved } from "@/lib/dual-transaction-savings"
import { buildLocationCoordMap, collectLocationStringsFromLoads } from "@/lib/dual-transaction-resolve-server"
import {
  DUAL_BOARD_EXPORT_PICKUP_STATUSES,
  DUAL_BOARD_IMPORT_RETURN_STATUSES,
} from "@/lib/dual-transactions-board-constants"
import { mergePhTerminalOptionsForLoadRows } from "@/lib/terminals/phTerminalFilters"
import type { LoadWithRelations } from "@/types/dispatcher"

async function getDualTransactionsData() {
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

  const { data: importReturns } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ),
      drivers ( id, name, phone, status )
    `)
    .eq("load_type", "Import")
    .in("status", [...DUAL_BOARD_IMPORT_RETURN_STATUSES])
    .is("street_turn_match_id", null)
    .order("created_at", { ascending: false })

  // Fetch export loads available at port for pickup
  const { data: exportPickups } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ),
      drivers ( id, name, phone, status )
    `)
    .eq("load_type", "Export")
    .in("status", [...DUAL_BOARD_EXPORT_PICKUP_STATUSES])
    .is("street_turn_match_id", null)
    .order("created_at", { ascending: false })

  const potentialMatches: Array<{
    import: LoadWithRelations
    export: LoadWithRelations
    estimatedSavings: number
    estimatedSavedMiles: number
  }> = []

  const importReturnsList = importReturns || []
  const exportPickupsList = exportPickups || []

  const coordMap = await buildLocationCoordMap(
    collectLocationStringsFromLoads([...importReturnsList, ...exportPickupsList])
  )

  importReturnsList.forEach((importLoad) => {
    exportPickupsList.forEach((exportLoad) => {
      const imp = rowToDualPairSlice(importLoad as LoadWithRelations)
      const exp = rowToDualPairSlice(exportLoad as LoadWithRelations)
      if (!dualPairCompatible(imp, exp)) return
      const { savedMiles, savingsUsd } = pairEmptyMilesSaved(imp, exp, coordMap)
      potentialMatches.push({
        import: importLoad as LoadWithRelations,
        export: exportLoad as LoadWithRelations,
        estimatedSavings: savingsUsd,
        estimatedSavedMiles: savedMiles,
      })
    })
  })

  potentialMatches.sort((a, b) => b.estimatedSavings - a.estimatedSavings)

  // Fetch linked loads (where street_turn_match_id is set) for dual transactions
  const { data: linkedImports } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ),
      drivers ( id, name, phone, status )
    `)
    .eq("load_type", "Import")
    .not("street_turn_match_id", "is", null)
    .order("created_at", { ascending: false })

  const { data: linkedExports } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ),
      drivers ( id, name, phone, status )
    `)
    .eq("load_type", "Export")
    .not("street_turn_match_id", "is", null)
    .order("created_at", { ascending: false })

  const linkedImportsList = linkedImports || []
  const linkedExportsList = linkedExports || []

  // Build linked pairs by matching street_turn_match_id
  const linkedPairs: Array<{
    import: typeof importReturnsList[number]
    export: typeof exportPickupsList[number]
  }> = []

  linkedImportsList.forEach((imp) => {
    const matchedExport = linkedExportsList.find(
      (exp) => exp.street_turn_match_id === imp.street_turn_match_id
    )
    if (matchedExport) {
      linkedPairs.push({ import: imp, export: matchedExport })
    }
  })

  return {
    importReturns: importReturns || [],
    exportPickups: exportPickups || [],
    potentialMatches,
    linkedPairs,
    summary: {
      importReturnsCount: importReturns?.length || 0,
      exportPickupsCount: exportPickups?.length || 0,
      potentialMatchesCount: potentialMatches.length,
      linkedCount: linkedPairs.length,
    },
  }
}

export default async function DualTransactionsPage() {
  const supabase = await createClient()
  const dualTransactionsData = await getDualTransactionsData()
  const { data: terminalRows } = await supabase.from("terminals").select("name").order("name")
  const loadsForTerminalMerge = [
    ...dualTransactionsData.importReturns,
    ...dualTransactionsData.exportPickups,
    ...dualTransactionsData.linkedPairs.flatMap((p) => [p.import, p.export]),
  ]
  const phTerminalFilterOptions = mergePhTerminalOptionsForLoadRows(terminalRows ?? [], loadsForTerminalMerge)

  return (
    <div className="bg-[#0B1120] rounded-xl border border-white/5 p-6">
      <DualTransactionsView
        dualTransactionsData={dualTransactionsData}
        phTerminalFilterOptions={phTerminalFilterOptions}
      />
    </div>
  )
}
