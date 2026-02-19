"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { 
  UserCircle,
  BarChart3,
  UserCheck,
  Clock,
  Receipt,
  FileText
} from "lucide-react"
import { OptionCard, type OptionCardProps } from "@/components/shared/option-card"

const officeOptions: (Omit<OptionCardProps, "iconSize">)[] = [
  {
    id: "users",
    title: "Users and Staff Management",
    titleKey: "settings.menu.users",
    href: "/dashboard/office/users",
    icon: UserCircle,
  },
  {
    id: "reports",
    title: "Reports",
    titleKey: "common.navigation.reports",
    href: "/dashboard/office/reports",
    icon: BarChart3,
  },
  {
    id: "customer-management",
    title: "Customer Management",
    titleKey: "customers.menu.management",
    href: "/dashboard/office/customer-management",
    icon: UserCheck,
  },
  {
    id: "shift-management",
    title: "Shift Management",
    titleKey: "shifts.menu.management",
    href: "/dashboard/office/shift-management",
    icon: Clock,
  },
  {
    id: "expenses",
    title: "Expenses",
    titleKey: "reports.menu.expenses",
    href: "/dashboard/office/expenses",
    icon: Receipt,
  },
  {
    id: "quotations",
    title: "Quotations",
    titleKey: "sales.menu.quotations",
    href: "/dashboard/office/quotations",
    icon: FileText,
  },
]

export default function OfficePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {officeOptions.map((option) => (
            <OptionCard
              key={option.id}
              {...option}
              iconSize="sm"
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
