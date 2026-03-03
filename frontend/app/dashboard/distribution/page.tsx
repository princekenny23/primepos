"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageCard } from "@/components/layouts/page-card"
import { PageHeader } from "@/components/layouts/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterableTabs, TabsContent } from "@/components/ui/filterable-tabs"
import { useAuthStore } from "@/stores/authStore"
import { hasDistributionAccess } from "@/lib/utils/tenant-permissions"

export default function DistributionPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const canAccess = hasDistributionAccess(user)

  const tabs = [
    { value: "vehicles", label: "Vehicles" },
    { value: "drivers", label: "Drivers" },
    { value: "delivery-orders", label: "Delivery Orders" },
    { value: "active-trips", label: "Active Trips" },
    { value: "trip-history", label: "Trip History" },
  ]

  const tabRouteMap: Record<string, string> = {
    vehicles: "/dashboard/distribution/vehicles",
    drivers: "/dashboard/distribution/drivers",
    "delivery-orders": "/dashboard/distribution/deliveries",
    "active-trips": "/dashboard/distribution/active-trips",
    "trip-history": "/dashboard/distribution/trip-history",
  }

  useEffect(() => {
    if (canAccess) {
      router.replace("/dashboard/distribution/vehicles")
    }
  }, [canAccess, router])

  return (
    <DashboardLayout>
      <PageCard className="mt-6">
        <PageHeader title="Distribution" />
        {!canAccess ? (
          <Card>
            <CardHeader>
              <CardTitle>Distribution Module</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Distribution is not enabled for this tenant.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <FilterableTabs
              tabs={tabs}
              activeTab="vehicles"
              onTabChange={(value) => router.push(tabRouteMap[value] || tabRouteMap.vehicles)}
              className="w-full"
              tabsListClassName="grid w-full h-9 items-center gap-1 rounded-md bg-gray-100 p-1"
            >
              <TabsContent value="vehicles" className="hidden" />
              <TabsContent value="drivers" className="hidden" />
              <TabsContent value="delivery-orders" className="hidden" />
              <TabsContent value="active-trips" className="hidden" />
              <TabsContent value="trip-history" className="hidden" />
            </FilterableTabs>
            <Card>
              <CardContent className="pt-6 text-muted-foreground">
                Opening distribution workspace...
              </CardContent>
            </Card>
          </div>
        )}
      </PageCard>
    </DashboardLayout>
  )
}
