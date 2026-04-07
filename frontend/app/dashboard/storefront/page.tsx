"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Store, ClipboardList, Settings2, LayoutGrid, BarChart3 } from "lucide-react"
import { OptionCard, type OptionCardProps } from "@/components/shared/option-card"
import { useAuthStore } from "@/stores/authStore"
import { isTenantFeatureEnabled } from "@/lib/utils/tenant-permissions"

const storefrontOptions: (Omit<OptionCardProps, "iconSize">)[] = [
  {
    id: "sites",
    title: "Sites",
    href: "/dashboard/storefront/sites",
    icon: LayoutGrid,
  },
  {
    id: "orders",
    title: "Online Orders",
    href: "/dashboard/storefront/orders",
    icon: ClipboardList,
  },
  {
    id: "reports",
    title: "Storefront Reports",
    href: "/dashboard/storefront/reports",
    icon: BarChart3,
  },
  {
    id: "settings",
    title: "Storefront Settings",
    href: "/dashboard/storefront/settings",
    icon: Settings2,
  },
]

export default function StorefrontPage() {
  const { user } = useAuthStore()
  const canSites = isTenantFeatureEnabled(user, "allow_storefront_sites")
  const canOrders = isTenantFeatureEnabled(user, "allow_storefront_orders")
  const canReports = isTenantFeatureEnabled(user, "allow_storefront_reports")
  const canSettings = isTenantFeatureEnabled(user, "allow_storefront_settings")

  const visibleOptions = storefrontOptions.filter((option) => {
    if (option.id === "sites") return canSites
    if (option.id === "orders") return canOrders
    if (option.id === "reports") return canReports
    if (option.id === "settings") return canSettings
    return true
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3 pt-6 pb-2">
          <Store className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Storefront</h1>
            <p className="text-muted-foreground text-sm">Manage your online store and WhatsApp orders</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleOptions.map((option) => (
            <OptionCard
              key={option.id}
              {...option}
              iconSize="sm"
            />
          ))}
        </div>

        {visibleOptions.length === 0 && (
          <p className="text-sm text-muted-foreground">No storefront features are enabled for this tenant.</p>
        )}
      </div>
    </DashboardLayout>
  )
}
