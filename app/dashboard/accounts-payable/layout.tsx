"use client"

import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { APLayout } from "@/components/accounts-payable/APLayout"

export default function AccountsPayableLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardLayout>
      <APLayout>{children}</APLayout>
    </DashboardLayout>
  )
}
