import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OrganizationsClient } from "@/components/organizations/OrganizationsClient"
import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { SupabaseClient } from "@supabase/supabase-js"

/**
 * Fetch all rows from a table, paginating past the Supabase server-side
 * max-rows limit (default 1000). Uses .range() to pull in batches.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchAll(supabase: SupabaseClient, table: string, pageSize = 1000): Promise<any[]> {
  const allRows: any[] = []
  let from = 0
  let done = false

  while (!done) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("name")
      .range(from, from + pageSize - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      done = true
    } else {
      allRows.push(...data)
      if (data.length < pageSize) {
        done = true // Last page
      } else {
        from += pageSize
      }
    }
  }

  return allRows
}

async function getOrganizationsData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check role — only admin can view
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard")
  }

  // Fetch all organization data — paginate to bypass server-side row limit
  const [customers, terminals, warehouses, yards] = await Promise.all([
    fetchAll(supabase, "customers"),
    fetchAll(supabase, "terminals"),
    fetchAll(supabase, "warehouses"),
    fetchAll(supabase, "yards"),
  ])

  return { customers, terminals, warehouses, yards }
}

export default async function OrganizationsPage() {
  const data = await getOrganizationsData()

  return (
    <DashboardLayout>
      <OrganizationsClient {...data} />
    </DashboardLayout>
  )
}
