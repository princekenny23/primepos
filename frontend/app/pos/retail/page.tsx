"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useBusinessStore } from "@/stores/businessStore"
import { useShift } from "@/contexts/shift-context"
import { RetailPOS } from "@/components/pos/retail-pos"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { getOutletPOSRoute, getOutletPosMode } from "@/lib/utils/outlet-settings"

export default function RetailPOSPage() {
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

    // Redirect single-product POS types to their specific POS
    if (currentBusiness.posType === "single_product") {
      router.push("/pos/single-product")
      return
    }

    // Redirect non-retail/wholesale businesses to their specific POS
    if (posMode !== "standard") {
      router.push(posRoute)
      return
    }

    // If no active shift, redirect to POS landing page
    if (!isLoading && !activeShift) {
      router.push("/dashboard/pos")
      return
    }
  }, [currentBusiness, posMode, posRoute, router, activeShift, isLoading])

  // Only allow standard POS with "wholesale and retail" type to use this POS
  if (!currentBusiness || currentBusiness.posType !== "standard" || posMode !== "standard") {
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

  // If no active shift, redirect to landing page (handled in useEffect, but show loading while redirecting)
  if (!activeShift) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <RetailPOS />
    </DashboardLayout>
  )
}
