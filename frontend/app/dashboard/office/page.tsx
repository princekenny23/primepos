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
import { useAuthStore } from "@/stores/authStore"
import { isTenantFeatureEnabled } from "@/lib/utils/tenant-permissions"

const officeOptions: (Omit<OptionCardProps, "iconSize">)[] = [
  {
    id: "users",
    title: "User and Staff Management",
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
    title: "Expensee",
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
  const { user } = useAuthStore()

  const filteredOfficeOptions = officeOptions.filter((option) => {
    if (!isTenantFeatureEnabled(user, "allow_office")) return false
    if (option.id === "users" || option.id === "shift-management") return isTenantFeatureEnabled(user, "allow_office_hr")
    if (option.id === "reports") return isTenantFeatureEnabled(user, "allow_office_reports")
    if (option.id === "expenses" || option.id === "quotations") return isTenantFeatureEnabled(user, "allow_office_accounting")
    if (option.id === "customer-management") return isTenantFeatureEnabled(user, "allow_office_analytics")
    return true
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOfficeOptions.map((option) => (
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
