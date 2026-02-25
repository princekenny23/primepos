"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useBusinessStore } from "@/stores/businessStore"
import { useShift } from "@/contexts/shift-context"
import { SingleProductPOS } from "@/components/pos/single-product-pos"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"

export default function SingleProductPOSPage() {
  const router = useRouter()
  const { currentBusiness } = useBusinessStore()
  const { activeShift, isLoading } = useShift()

  useEffect(() => {
    if (!currentBusiness) {
      router.push("/admin")
      return
    }

    // Redirect if not single-product POS type
    if (currentBusiness.posType !== "single_product") {
      router.push("/pos/retail")
      return
    }

    // If no active shift, redirect to POS landing page
    if (!isLoading && !activeShift) {
      router.push("/dashboard/pos")
      return
    }
  }, [currentBusiness, router, activeShift, isLoading])

  // Only allow single-product POS type to use this POS
  if (!currentBusiness || currentBusiness.posType !== "single_product") {
    return null
  }

  // Show loading while checking shift
  if (isLoading) {
    return (
      <DashboardLayout showSubNavbar={false}>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  // If no active shift, redirect to landing page (handled in useEffect, but show loading while redirecting)
  if (!activeShift) {
    return (
      <DashboardLayout showSubNavbar={false}>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout showSubNavbar={false}>
      <SingleProductPOS />
    </DashboardLayout>
  )
}

