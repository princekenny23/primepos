"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ShoppingCart, 
  Lock, 
  PlayCircle, 
  Clock, 
  Loader2, 
  Store,
  CreditCard,
  CheckCircle2,
  Calculator
} from "lucide-react"
import { useBusinessStore } from "@/stores/businessStore"
import { useShift } from "@/contexts/shift-context"
import { useTenant } from "@/contexts/tenant-context"
import { shiftService, type Shift } from "@/lib/services/shiftService"
import { tillService, type Till } from "@/lib/services/tillService"
import { format } from "date-fns"
import { getOutletPOSRoute, getOutletPosMode } from "@/lib/utils/outlet-settings"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"

interface RegisterStatus {
  outlet: { id: string; name: string }
  till: Till
  hasActiveShift: boolean
  activeShift?: Shift
}

export default function POSLandingPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { outlets } = useTenant()
  const { setActiveShift, activeShift } = useShift()
  const [isLoading, setIsLoading] = useState(true)
  const [registerStatuses, setRegisterStatuses] = useState<RegisterStatus[]>([])
  const [activeShifts, setActiveShifts] = useState<Shift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string>("")
  const [isSelectingShift, setIsSelectingShift] = useState(false)

  useEffect(() => {
    if (!currentBusiness) {
      router.push("/admin")
      return
    }

    // Route based on POS type
    if (currentBusiness.posType === "single_product") {
      // For single-product POS, redirect directly if shift is active
      if (activeShift) {
        router.push("/pos/single-product")
      }
      // Otherwise stay on landing page (single-product POS doesn't need register selection)
      return
    }

    // For standard POS, check business type
    const posMode = getOutletPosMode(currentOutlet, currentBusiness)
    if (posMode === "standard") {
      // loadRegisterStatuses will be called in useEffect
    } else {
      // For other business types, redirect to their specific POS
      router.push(getOutletPOSRoute(currentOutlet, currentBusiness))
    }
  }, [currentBusiness, currentOutlet, outlets, activeShift, router])

  const loadRegisterStatuses = useCallback(async () => {
    if (!currentBusiness || !outlets.length) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // Load all active shifts
      const shifts = await shiftService.listOpen()
      setActiveShifts(shifts)

      // Load all tills for all outlets
      const allRegisters: RegisterStatus[] = []
      
      for (const outlet of outlets.filter(o => o.isActive)) {
        try {
          const tills = await tillService.getByOutlet(outlet.id)
          
          for (const till of tills.filter(t => t.is_active)) {
            const shiftForTill = shifts.find(
              s => s.outletId === outlet.id && s.tillId === till.id
            )
            
            allRegisters.push({
              outlet,
              till,
              hasActiveShift: !!shiftForTill,
              activeShift: shiftForTill,
            })
          }
        } catch (error) {
          console.error(`Failed to load tills for outlet ${outlet.id}:`, error)
        }
      }

      setRegisterStatuses(allRegisters)
    } catch (error) {
      console.error("Failed to load register statuses:", error)
      setRegisterStatuses([])
    } finally {
      setIsLoading(false)
    }
  }, [currentBusiness, outlets])

  // If user already has an active shift, redirect to appropriate POS
  useEffect(() => {
    loadRegisterStatuses()
    if (activeShift && currentBusiness) {
      if (currentBusiness.posType === "single_product") {
        router.push("/pos/single-product")
      } else {
        router.push(getOutletPOSRoute(currentOutlet, currentBusiness))
      }
    }
  }, [activeShift, currentBusiness, currentOutlet, router, loadRegisterStatuses])

  const handleStartNew = () => {
    router.push("/dashboard/office/shift-management/start-shift")
  }

  const handleSelectShift = async () => {
    if (!selectedShiftId) return

    setIsSelectingShift(true)
    try {
      const shift = activeShifts.find(s => s.id === selectedShiftId)
      if (shift) {
        // Transform to context format
        const contextShift = {
          id: shift.id,
          outletId: shift.outletId,
          tillId: shift.tillId,
          userId: shift.userId,
          operatingDate: shift.operatingDate,
          openingCashBalance: shift.openingCashBalance,
          floatingCash: shift.floatingCash,
          notes: shift.notes,
          status: shift.status,
          startTime: shift.startTime,
          endTime: shift.endTime,
        }
        setActiveShift(contextShift)
        // Redirect to POS
        router.push("/pos/retail")
      }
    } catch (error) {
      console.error("Failed to select shift:", error)
    } finally {
      setIsSelectingShift(false)
    }
  }

  const getShiftDisplayName = (shift: Shift): string => {
    const outlet = outlets.find(o => o.id === shift.outletId)
    const register = registerStatuses.find(
      r => r.outlet.id === shift.outletId && r.till.id === shift.tillId
    )
    const tillName = register?.till.name || `Till #${shift.tillId.slice(-4)}`
    const outletName = outlet?.name || `Outlet #${shift.outletId.slice(-4)}`
    return `${outletName} - ${tillName} (${format(new Date(shift.operatingDate), "MMM dd")})`
  }

  const closedRegisters = registerStatuses.filter(r => !r.hasActiveShift)
  const openRegisters = registerStatuses.filter(r => r.hasActiveShift)

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Loading registers...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Point of Sale"
        description="Select a running shift or start a new one to begin selling"
      >
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8">
          <div className="w-full max-w-2xl space-y-8">
            {/* Cash Register Icon */}
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calculator className="h-12 w-12 text-primary" />
                </div>
              </div>
            </div>

          {/* Main Options Card */}
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="space-y-6">
                {/* Running Shifts Selection */}
                {activeShifts.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Running Shifts ({activeShifts.length})
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select an active shift to continue selling
                      </p>
                    </div>
                    <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                      <SelectTrigger className="w-full h-12 text-base">
                        <SelectValue placeholder="Select a shift from the dropdown..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeShifts.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {getShiftDisplayName(shift)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleSelectShift}
                      disabled={!selectedShiftId || isSelectingShift}
                      className="w-full h-12 text-base font-semibold"
                      size="lg"
                    >
                      {isSelectingShift ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-5 w-5" />
                          USE SELECTED SHIFT
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Divider */}
                {activeShifts.length > 0 && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">OR</span>
                    </div>
                  </div>
                )}

                {/* Start New Shift */}
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                      <PlayCircle className="h-5 w-5 text-primary" />
                      Start New Shift
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create a new shift for any outlet and till
                    </p>
                  </div>
                  <Link href="/dashboard/office/shift-management/start-shift" className="block">
                    <Button
                      className="w-full h-12 text-base font-semibold"
                      size="lg"
                      variant={activeShifts.length > 0 ? "outline" : "default"}
                    >
                      <PlayCircle className="mr-2 h-5 w-5" />
                      START NEW SHIFT
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Message */}
          {activeShifts.length === 0 && closedRegisters.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <div className="text-center space-y-2">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">
                    No registers found. Please set up outlets and tills first.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Info */}
          {(closedRegisters.length > 0 || openRegisters.length > 0) && (
            <div className="text-center text-xs text-muted-foreground space-y-1">
              {closedRegisters.length > 0 && (
                <p>
                  {closedRegisters.length} closed register{closedRegisters.length !== 1 ? "s" : ""} available
                </p>
              )}
              {openRegisters.length > 0 && (
                <p>
                  {openRegisters.length} open register{openRegisters.length !== 1 ? "s" : ""} with active shifts
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      </PageLayout>
    </DashboardLayout>
  )
}
