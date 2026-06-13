import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { StreetTurnsView } from "@/components/dispatcher/StreetTurnsView"
import { mergePhTerminalOptionsForLoadRows } from "@/lib/terminals/phTerminalFilters"

async function getStreetTurnsData() {
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

  // Fetch all import loads (for street turn matching)
  const { data: imports } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ),
      drivers ( id, name, phone, status )
    `)
    .eq("load_type", "Import")
    .is("street_turn_match_id", null)
    .order("created_at", { ascending: false })

  // Fetch all export loads (for street turn matching)
  const { data: exports } = await supabase
    .from("loads")
    .select(`
      *,
      customers ( id, name, email, phone ),
      containers ( id, container_number, bol_number, size, type, status, last_free_day, shipping_line, transit_state, vessels ( id, name, voyage_number, eta, terminal, shipping_line ) ),
      drivers ( id, name, phone, status )
    `)
    .eq("load_type", "Export")
    .is("street_turn_match_id", null)
    .order("created_at", { ascending: false })

  // Fetch linked loads (where street_turn_match_id is set)
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

  const importsList = imports || []
  const exportsList = exports || []
  const linkedImportsList = linkedImports || []
  const linkedExportsList = linkedExports || []

  // Build linked pairs by matching street_turn_match_id
  const linkedPairs: Array<{
    import: typeof importsList[number]
    export: typeof exportsList[number]
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
    imports: importsList,
    exports: exportsList,
    linkedPairs,
    summary: {
      totalImports: importsList.length,
      totalExports: exportsList.length,
      linkedCount: linkedPairs.length,
    },
  }
}

export default async function StreetTurnsPage() {
  const supabase = await createClient()
  const streetTurnsData = await getStreetTurnsData()
  const { data: terminalRows } = await supabase.from("terminals").select("name").order("name")
  const loadsForTerminalMerge = [
    ...streetTurnsData.imports,
    ...streetTurnsData.exports,
    ...streetTurnsData.linkedPairs.flatMap((p) => [p.import, p.export]),
  ]
  const phTerminalFilterOptions = mergePhTerminalOptionsForLoadRows(terminalRows ?? [], loadsForTerminalMerge)

  return (
    <div className="bg-[#0B1120] rounded-xl border border-white/5 p-6">
      <StreetTurnsView
        streetTurnsData={streetTurnsData}
        phTerminalFilterOptions={phTerminalFilterOptions}
      />
    </div>
  )
}
