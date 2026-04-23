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
  const { activeShift, isLoading, shiftLoadError } = useShift()
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

    // Do NOT redirect here on missing shift — we show an in-page screen
    // to break the redirect loop that hammers the API quota.
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

  // API error (throttle / network) — show retry, never redirect
  if (shiftLoadError) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <p className="text-red-500 font-medium">Could not load shift data</p>
          <p className="text-xs text-muted-foreground">The server may be temporarily unavailable. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 rounded bg-blue-900 text-white text-sm hover:bg-blue-800"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // No active shift — show stable screen with button, never auto-redirect
  if (!activeShift) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground font-medium">No active shift found</p>
          <p className="text-xs text-muted-foreground">Open a shift before using the Bar POS.</p>
          <button
            onClick={() => router.push("/dashboard/pos")}
            className="mt-2 px-4 py-2 rounded bg-blue-900 text-white text-sm hover:bg-blue-800"
          >
            Open Shift
          </button>
        </div>
      </div>
    )
  }

  // Wrap Bar POS in DashboardLayout to show sidebar/topbar
  return (
    <DashboardLayout showSubNavbar={false}>
      <BarPOS />
    </DashboardLayout>
  )
}

