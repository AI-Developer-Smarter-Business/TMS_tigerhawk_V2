"use client"

import { DashboardLayout } from "@/components/layout/DashboardLayout"
import { ReportsLayout } from "@/components/reports/ReportsLayout"

export default function ReportsRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardLayout>
      <ReportsLayout>{children}</ReportsLayout>
    </DashboardLayout>
  )
}
