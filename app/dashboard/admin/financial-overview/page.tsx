// app/dashboard/admin/financial-overview/page.tsx
// Redirect to new location under Reports
import { redirect } from "next/navigation"

export default function FinancialOverviewRedirect() {
  redirect("/dashboard/reports/financial-overview")
}
