"use client"

import React from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import {
  TrendingUp,
  Users,
  Receipt,
  Wallet,
  DollarSign,
  ClipboardList,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { OptionCard } from "@/components/shared/option-card"

interface ReportNavCard {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
}

const reportCards: ReportNavCard[] = [
  {
    id: "sales",
    title: "Sales Report",
    description: "Detailed sales performance and trends",
    icon: TrendingUp,
    href: "/dashboard/office/reports/sales",
  },
  {
    id: "cashup",
    title: "Cashup Report",
    description: "Shift cash reconciliation summary",
    icon: ClipboardList,
    href: "/dashboard/office/reports/cashup",
  },
 
  {
    id: "inventory",
    title: "Stock Valuation Report",
    description: "Stock valuation summary and item-level detail",
    icon: Receipt,
    href: "/dashboard/office/reports/stock-valuation",
  },
  {
    id: "profit-loss",
    title: "Profit & Loss Report",
    description: "Financial performance analysis",
    icon: Wallet,
    href: "/dashboard/office/reports/profit-loss",
  },
  {
    id: "expenses",
    title: "Expenses Report",
    description: "Operating expense tracking",
    icon: DollarSign,
    href: "/dashboard/office/reports/expenses",
  },
]

export default function OfficeReportsDashboard() {
  return (
    <DashboardLayout>
      <PageLayout title="Reports" description="Choose a report to view">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportCards.map((report) => (
              <OptionCard
                key={report.id}
                id={report.id}
                title={report.title}
                href={report.href}
                icon={report.icon}
                iconSize="sm"
              />
            ))}
          </div>
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}
