// app/dashboard/portal-admin/page.tsx
// Redirect old URL to new admin section
import { redirect } from "next/navigation"

export default function OldPortalAdminRedirect() {
  redirect("/dashboard/admin/portal-users")
}
