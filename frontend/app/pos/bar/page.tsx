"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useBusinessStore } from "@/stores/businessStore"
import { useShift } from "@/contexts/shift-context"
import { BarPOS } from "@/components/pos/bar-pos"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { getOutletPOSRoute, getOutletPosMode } from "@/lib/utils/outlet-settings"

export default function BarPOSPage() {
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

    if (posMode !== "bar") {
      router.push(posRoute)
      return
    }
  }, [currentBusiness, posMode, posRoute, router])

  if (!currentBusiness || posMode !== "bar") {
    return null
  }

  // Show loading while checking shift
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Loading POS...</p>
          <p className="text-xs text-muted-foreground">Checking for active shift</p>
        </div>
      </div>
    )
  }

  // Wrap Bar POS in DashboardLayout to show sidebar/topbar
  return (
    <DashboardLayout>
      <BarPOS />
    </DashboardLayout>
  )
}
