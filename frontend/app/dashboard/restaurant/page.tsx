"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { 
  Square,
  ChefHat,
  ShoppingCart,
  BookOpen,
  Calendar,
  UtensilsCrossed,
} from "lucide-react"
import { OptionCard, type OptionCardProps } from "@/components/shared/option-card"

const restaurantOptions: (Omit<OptionCardProps, "iconSize">)[] = [
  {
    id: "tables",
    title: "Tables",
    titleKey: "pos.restaurant.tables",
    href: "/dashboard/restaurant/tables",
    icon: Square,
  },
  {
    id: "kitchen",
    title: "Kitchen",
    titleKey: "pos.restaurant.kitchen",
    href: "/dashboard/restaurant/kitchen",
    icon: ChefHat,
  },
  {
    id: "orders",
    title: "Orders",
    titleKey: "pos.restaurant.orders",
    href: "/dashboard/restaurant/orders",
    icon: ShoppingCart,
  },
  {
    id: "menu",
    title: "Menu Builder",
    titleKey: "pos.restaurant.menu",
    href: "/dashboard/restaurant/menu",
    icon: BookOpen,
  },

]

export default function RestaurantPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurantOptions.map((option) => (
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
