"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { 
  Building2,
  Receipt,
  Plug,
  Bell,
  Percent,
  FileText,
  Store,
} from "lucide-react"
import { OptionCard, type OptionCardProps } from "@/components/shared/option-card"
import { useAuthStore } from "@/stores/authStore"
import { isTenantFeatureEnabled } from "@/lib/utils/tenant-permissions"

const settingsOptions: (Omit<OptionCardProps, "iconSize">)[] = [
  {
    id: "business-info",
    title: "Business Info",
    titleKey: "settings.menu.business",
    href: "/dashboard/settings/business",
    icon: Building2,
  },
  {
    id: "outlets-and-tills-management",
    title: "Outlets and Tills",
    titleKey: "settings.menu.outlets",
    href: "/dashboard/settings/outlets-and-tills-management",
    icon: Store,
  },

  {
    id: "integrations",
    title: "Integrations",
    titleKey: "settings.menu.integrations",
    href: "/dashboard/settings/integrations",
    icon: Plug,
  },
  {
    id: "notifications",
    title: "Notifications",
    titleKey: "settings.menu.notifications",
    href: "/dashboard/settings/notifications",
    icon: Bell,
  },
  {
    id: "tax",
    title: "Tax",
    titleKey: "settings.menu.tax",
    href: "/dashboard/settings/tax",
    icon: Percent,
  },
  {
    id: "activity-logs",
    title: "Activity Logs",
    titleKey: "settings.menu.activity_logs",
    href: "/dashboard/settings/activity-logs",
    icon: FileText,
  },
]

export default function SettingsPage() {
  const { user } = useAuthStore()

  const filteredSettingsOptions = settingsOptions.filter((option) => {
    if (!isTenantFeatureEnabled(user, "allow_settings")) return false
    if (option.id === "outlets-and-tills-management") return isTenantFeatureEnabled(user, "allow_settings_outlets")
    if (option.id === "integrations") return isTenantFeatureEnabled(user, "allow_settings_integrations")
    if (option.id === "business-info" || option.id === "tax" || option.id === "notifications" || option.id === "activity-logs") {
      return isTenantFeatureEnabled(user, "allow_settings_advanced")
    }
    return true
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSettingsOptions.map((option) => (
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
