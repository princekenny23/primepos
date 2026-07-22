"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Lock, PlayCircle, Clock, Loader2 } from "lucide-react"
import { useBusinessStore } from "@/stores/businessStore"
import { useShift } from "@/contexts/shift-context"
import { shiftService } from "@/lib/services/shiftService"
import { format } from "date-fns"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Shift } from "@/lib/services/shiftService"

export function RegisterClosedScreen() {
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { setActiveShift } = useShift()
  const [openShifts, setOpenShifts] = useState<Shift[]>([])
  const [selectedShiftId, setSelectedShiftId] = useState<string>("")
  const [isLoadingShifts, setIsLoadingShifts] = useState(true)
  const [isSelectingShift, setIsSelectingShift] = useState(false)
  const [hasAutoOpenedSingleShift, setHasAutoOpenedSingleShift] = useState(false)

  useEffect(() => {
    loadOpenShifts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness])

  const loadOpenShifts = async () => {
    if (!currentBusiness) return
    
    setIsLoadingShifts(true)
    try {
      const shifts = await shiftService.listOpen()
      setOpenShifts(shifts)
    } catch (error) {
      console.error("Failed to load open shifts:", error)
      setOpenShifts([])
    } finally {
      setIsLoadingShifts(false)
    }
  }

  const handleStartNew = () => {
    router.push("/dashboard/pos/start-shift")
  }

  const handleSelectShift = async () => {
    if (!selectedShiftId) return

    setIsSelectingShift(true)
    try {
      const shift = openShifts.find(s => s.id === selectedShiftId)
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
        // Refresh the page to show POS
        window.location.reload()
      }
    } catch (error) {
      console.error("Failed to select shift:", error)
    } finally {
      setIsSelectingShift(false)
    }
  }

  const getShiftDisplayName = (shift: Shift): string => {
    // Try to get outlet and till names
    // For now, just show ID and date
    return `Shift #${shift.id.slice(-6)} - ${format(new Date(shift.operatingDate), "MMM dd, yyyy")}`
  }

  useEffect(() => {
    if (isLoadingShifts || isSelectingShift || hasAutoOpenedSingleShift || !currentBusiness) {
      return
    }

    const shiftsForCurrentOutlet = currentOutlet
      ? openShifts.filter((shift) => String(shift.outletId) === String(currentOutlet.id))
      : []

    const shouldAutoOpenCurrentOutlet = shiftsForCurrentOutlet.length === 1
    const shouldAutoOpenSingleOverall = !currentOutlet && openShifts.length === 1

    if (!shouldAutoOpenCurrentOutlet && !shouldAutoOpenSingleOverall) {
      return
    }

    const targetShift = shouldAutoOpenCurrentOutlet
      ? shiftsForCurrentOutlet[0]
      : openShifts[0]

    const contextShift = {
      id: targetShift.id,
      outletId: targetShift.outletId,
      tillId: targetShift.tillId,
      userId: targetShift.userId,
      operatingDate: targetShift.operatingDate,
      openingCashBalance: targetShift.openingCashBalance,
      floatingCash: targetShift.floatingCash,
      notes: targetShift.notes,
      status: targetShift.status,
      startTime: targetShift.startTime,
      endTime: targetShift.endTime,
    }

    setHasAutoOpenedSingleShift(true)
    setActiveShift(contextShift)
    window.location.reload()
  }, [
    currentBusiness,
    currentOutlet,
    hasAutoOpenedSingleShift,
    isLoadingShifts,
    isSelectingShift,
    openShifts,
    setActiveShift,
  ])

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8">
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-12 pb-12">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-12 w-12 text-muted-foreground" />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">REGISTER CLOSED</h1>
              <p className="text-muted-foreground">
                The register is currently closed. Start a new shift or select an existing one to begin processing sales.
              </p>
            </div>

            {/* Options */}
            <div className="w-full max-w-md space-y-4">
              {/* Select Existing Shift */}
              {openShifts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Select Running Shift
                    </CardTitle>
                    <CardDescription>
                      Choose from {openShifts.length} active shift{openShifts.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingShifts ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a shift..." />
                          </SelectTrigger>
                          <SelectContent>
                            {openShifts.map((shift) => (
                              <SelectItem key={shift.id} value={shift.id}>
                                {getShiftDisplayName(shift)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleSelectShift}
                          disabled={!selectedShiftId || isSelectingShift}
                          className="w-full"
                          variant="default"
                        >
                          {isSelectingShift ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Selecting...
                            </>
                          ) : (
                            <>
                              <Clock className="mr-2 h-4 w-4" />
                              USE SELECTED SHIFT
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Divider */}
              {openShifts.length > 0 && (
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
              <Button
                onClick={handleStartNew}
                size="lg"
                className="w-full h-12 text-base font-semibold"
                variant={openShifts.length > 0 ? "outline" : "default"}
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                START NEW SHIFT
              </Button>
            </div>

            {/* Info */}
            <p className="text-xs text-muted-foreground pt-4">
              {openShifts.length > 0 
                ? "Select an existing shift to continue, or start a new one for a different outlet/till."
                : "You'll need to set up your till, opening cash balance, and other shift details before you can start selling."
              }
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


