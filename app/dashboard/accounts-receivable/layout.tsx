"use client"

import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { ARLayout } from "@/components/accounts-receivable/ARLayout"

export default function AccountsReceivableLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardLayout>
      <ARLayout>{children}</ARLayout>
    </DashboardLayout>
  )
}
