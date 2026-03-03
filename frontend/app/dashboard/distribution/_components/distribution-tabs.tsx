"use client"

import { useRouter } from "next/navigation"
import { FilterableTabs, TabsContent } from "@/components/ui/filterable-tabs"

type DistributionTabKey = "vehicles" | "drivers" | "delivery-orders" | "active-trips" | "trip-history"

const tabs: Array<{ value: DistributionTabKey; label: string }> = [
  { value: "vehicles", label: "Vehicles" },
  { value: "drivers", label: "Drivers" },
  { value: "delivery-orders", label: "Delivery Orders" },
  { value: "active-trips", label: "Active Trips" },
  { value: "trip-history", label: "Trip History" },
]

const tabRouteMap: Record<DistributionTabKey, string> = {
  vehicles: "/dashboard/distribution/vehicles",
  drivers: "/dashboard/distribution/drivers",
  "delivery-orders": "/dashboard/distribution/deliveries",
  "active-trips": "/dashboard/distribution/active-trips",
  "trip-history": "/dashboard/distribution/trip-history",
}

interface DistributionTabsProps {
  activeTab: DistributionTabKey
}

export function DistributionTabs({ activeTab }: DistributionTabsProps) {
  const router = useRouter()

  return (
    <FilterableTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(value) => router.push(tabRouteMap[(value as DistributionTabKey) || "vehicles"])}
      className="w-full"
      tabsListClassName="grid w-full h-9 items-center gap-1 rounded-md bg-gray-100 p-1"
    >
      <TabsContent value="vehicles" className="hidden" />
      <TabsContent value="drivers" className="hidden" />
      <TabsContent value="delivery-orders" className="hidden" />
      <TabsContent value="active-trips" className="hidden" />
      <TabsContent value="trip-history" className="hidden" />
    </FilterableTabs>
  )
}