// app/portal/layout.tsx
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PortalLayout } from "@/components/portal/PortalLayout"

export const metadata = {
  title: "TigerHawk - Customer Portal",
  description: "Track your shipments and access documents",
}

export default async function PortalRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── No user: render bare children (login page) ──
  // The middleware already ensures unauthenticated users on /portal/*
  // (except /portal/login) are redirected to /portal/login.
  // So if we have no user here, we're on the login page — render without chrome.
  if (!user) {
    return <>{children}</>
  }

  // Get user profile with customer link + password_set status
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, full_name, email, customer_id, password_set")
    .eq("id", user.id)
    .single()

  if (!profile) {
    redirect("/dashboard")
  }

  // ── Customer who hasn't set password: render bare children (set-password page) ──
  // The middleware ensures customers without password_set are redirected to
  // /portal/set-password. So if we're here with password_set=false,
  // we're on the set-password page — render without chrome.
  if (profile.role === "customer" && !profile.password_set) {
    return <>{children}</>
  }

  // Allow customers and staff (admin/dispatcher) to access portal
  const isCustomer = profile.role === "customer"
  const isStaff = profile.role === "admin" || profile.role === "dispatcher"
  if (!isCustomer && !isStaff) {
    redirect("/dashboard")
  }

  // Get customer record (for actual customers with customer_id)
  let companyName = isStaff ? "Admin Preview" : "Customer"
  if (profile.customer_id) {
    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("id", profile.customer_id)
      .single()

    if (customer) {
      companyName = customer.name
    }
  }

  const customerName = profile.full_name || profile.email || user.email || "User"

  return (
    <PortalLayout customerName={customerName} companyName={companyName}>
      {children}
    </PortalLayout>
  )
}
