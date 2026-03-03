"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { 
  Tag, 
  Sliders, 
  ClipboardCheck,
  Truck,
} from "lucide-react"
import { OptionCard, type OptionCardProps } from "@/components/shared/option-card"
import { useAuthStore } from "@/stores/authStore"
import { isTenantFeatureEnabled } from "@/lib/utils/tenant-permissions"

const inventoryOptions: (Omit<OptionCardProps, "iconSize">)[] = [
  {
    id: "stock-items",
    title: "Stock & Items",
    titleKey: "inventory.menu.stock_items",
    href: "/dashboard/inventory/products",
    icon: Tag,
  },
  {
    id: "stock-control",
    title: "Stock Control",
    titleKey: "inventory.menu.stock_control",
    href: "/dashboard/inventory/stock-control",
    icon: Sliders,
  },
  {
    id: "stock-taking",
    title: "Stock Taking",
    titleKey: "inventory.menu.stock_taking",
    href: "/dashboard/inventory/stock-taking",
    icon: ClipboardCheck,
  },
  {
    id: "suppliers",
    title: "Suppliers",
    titleKey: "inventory.menu.suppliers",
    href: "/dashboard/inventory/suppliers",
    icon: Truck,
  },
]

export default function InventoryPage() {
  const { user } = useAuthStore()

  const filteredInventoryOptions = inventoryOptions.filter((option) => {
    if (!isTenantFeatureEnabled(user, "allow_inventory")) return false

    if (option.id === "stock-items") return isTenantFeatureEnabled(user, "allow_inventory_products")
    if (option.id === "stock-taking") return isTenantFeatureEnabled(user, "allow_inventory_stock_take")
    if (option.id === "suppliers") return isTenantFeatureEnabled(user, "allow_inventory_suppliers")
    if (option.id === "stock-control") {
      return (
        isTenantFeatureEnabled(user, "allow_inventory_adjustments") ||
        isTenantFeatureEnabled(user, "allow_inventory_transfers")
      )
    }
    return true
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInventoryOptions.map((option) => (
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
