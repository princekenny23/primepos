"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useBusinessStore } from "@/stores/businessStore"
import { useShift } from "@/contexts/shift-context"
import { RestaurantPOS } from "@/components/pos/restaurant-pos"
import { RegisterClosedScreen } from "@/components/pos/register-closed-screen"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { getOutletPOSRoute, getOutletPosMode } from "@/lib/utils/outlet-settings"

export default function RestaurantPOSPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { activeShift, isLoading } = useShift()
  const posMode = getOutletPosMode(currentOutlet, currentBusiness)
  const posRoute = getOutletPOSRoute(currentOutlet, currentBusiness)

  useEffect(() => {
    if (!currentBusiness) {
      router.push("/admin")
      return
    }

    if (posMode !== "restaurant") {
      router.push(posRoute)
      return
    }
  }, [currentBusiness, posMode, posRoute, router])

  if (!currentBusiness || posMode !== "restaurant") {
    return null
  }

  // Show loading while checking shift
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  // If no active shift, show Register Closed screen
  if (!activeShift) {
    return (
      <DashboardLayout>
        <RegisterClosedScreen />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RestaurantPOS />
    </DashboardLayout>
  )
}
