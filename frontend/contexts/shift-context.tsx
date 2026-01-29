"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { shiftService } from "@/lib/services/shiftService"
import { outletService } from "@/lib/services/outletService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"

export interface Till {
  id: string
  name: string
  outletId: string
  isActive: boolean
  isInUse?: boolean
}

export interface Shift {
  id: string
  outletId: string
  tillId: string
  userId: string
  operatingDate: string // ISO date string
  openingCashBalance: number
  floatingCash: number
  notes?: string
  status: "OPEN" | "CLOSED"
  startTime: string // ISO timestamp
  endTime?: string // ISO timestamp
  closingCashBalance?: number
}

interface ShiftContextType {
  activeShift: Shift | null
  shiftHistory: Shift[]
  setActiveShift: (shift: Shift | null) => void
  startShift: (shiftData: Omit<Shift, "id" | "status" | "startTime" | "endTime">) => Promise<Shift>
  closeShift: (closingCashBalance: number) => Promise<void>
  isLoading: boolean
  getTillsForOutlet: (outletId: string) => Promise<Till[]>
  checkShiftExists: (outletId: string, tillId: string, date: string) => Promise<boolean>
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined)

export function ShiftProvider({ children }: { children: ReactNode }) {
  const { currentOutlet } = useBusinessStore()
  const [activeShift, setActiveShiftState] = useState<Shift | null>(null)
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Track which outlet we've loaded shifts for to prevent duplicate loads
  const loadedOutletRef = React.useRef<string | null>(null)

  // Load active shift and history on mount - only reload when outlet ID changes
  useEffect(() => {
    if (!currentOutlet?.id) {
      setActiveShiftState(null)
      setShiftHistory([])
      setIsLoading(false)
      loadedOutletRef.current = null
      return
    }

    // FIXED: Skip if we've already loaded for this outlet
    if (loadedOutletRef.current === currentOutlet.id) {
      return
    }

    const loadShifts = async () => {
      setIsLoading(true)
      loadedOutletRef.current = currentOutlet.id
      try {
        if (useRealAPI()) {
          // Use real API
          try {
            const active = await shiftService.getActive(currentOutlet.id)
            if (active && active.outletId === currentOutlet.id) {
              // Only set shift if it belongs to current outlet
              const contextShift: Shift = {
                id: active.id,
                outletId: active.outletId,
                tillId: active.tillId,
                userId: active.userId,
                operatingDate: active.operatingDate,
                openingCashBalance: active.openingCashBalance,
                floatingCash: active.floatingCash,
                notes: active.notes,
                status: active.status,
                startTime: active.startTime,
                endTime: active.endTime,
              }
              setActiveShiftState(contextShift)
            } else {
              setActiveShiftState(null)
            }
          } catch (error: any) {
            // No active shift found is OK
            if (!error.message?.includes("404") && !error.message?.includes("No active shift")) {
              console.error("Error loading active shift:", error)
            }
            setActiveShiftState(null)
          }
          
          // Load shift history
          try {
            const history = await shiftService.getHistory({ outlet: currentOutlet.id })
            // Transform to context format
            const contextHistory: Shift[] = history.map(h => ({
              id: h.id,
              outletId: h.outletId,
              tillId: h.tillId,
              userId: h.userId,
              operatingDate: h.operatingDate,
              openingCashBalance: h.openingCashBalance,
              floatingCash: h.floatingCash,
              notes: h.notes,
              status: h.status,
              startTime: h.startTime,
              endTime: h.endTime,
              closingCashBalance: h.closingCashBalance,
            }))
            setShiftHistory(contextHistory)
          } catch (error) {
            console.error("Error loading shift history:", error)
          }
        } else {
          // Fallback to localStorage for simulation mode
          const stored = localStorage.getItem("activeShift")
          if (stored) {
            const shift = JSON.parse(stored) as Shift
            // Only use shift if it belongs to current outlet
            if (shift.status === "OPEN" && shift.outletId === currentOutlet.id) {
              setActiveShiftState(shift)
            } else {
              localStorage.removeItem("activeShift")
              setActiveShiftState(null)
            }
          } else {
            setActiveShiftState(null)
          }

          const historyStored = localStorage.getItem("shiftHistory")
          if (historyStored) {
            const history = JSON.parse(historyStored) as Shift[]
            // Filter history by current outlet
            const filteredHistory = history.filter(h => h.outletId === currentOutlet.id)
            setShiftHistory(filteredHistory)
          } else {
            setShiftHistory([])
          }
        }
      } catch (error) {
        console.error("Error loading shifts:", error)
        setActiveShiftState(null)
        setShiftHistory([])
      } finally {
        setIsLoading(false)
      }
    }

    loadShifts()
  }, [currentOutlet?.id])

  // Save active shift to localStorage whenever it changes
  useEffect(() => {
    if (activeShift) {
      localStorage.setItem("activeShift", JSON.stringify(activeShift))
    } else {
      localStorage.removeItem("activeShift")
    }
  }, [activeShift])

  const setActiveShift = (shift: Shift | null) => {
    setActiveShiftState(shift)
  }

  const startShift = async (
    shiftData: Omit<Shift, "id" | "status" | "startTime" | "endTime">
  ): Promise<Shift> => {
    if (useRealAPI()) {
      // Use real API
      const newShift = await shiftService.start({
        outlet_id: shiftData.outletId,
        till_id: shiftData.tillId,
        operating_date: shiftData.operatingDate,
        opening_cash_balance: shiftData.openingCashBalance,
        floating_cash: shiftData.floatingCash || 0,
        notes: shiftData.notes || "",
      })
      // Transform to context format
      const contextShift: Shift = {
        id: newShift.id,
        outletId: newShift.outletId,
        tillId: newShift.tillId,
        userId: newShift.userId,
        operatingDate: newShift.operatingDate,
        openingCashBalance: newShift.openingCashBalance,
        floatingCash: newShift.floatingCash,
        notes: newShift.notes,
        status: newShift.status,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
      }
      setActiveShiftState(contextShift)
      return contextShift
    } else {
      // Simulation mode - use localStorage
      const exists = await checkShiftExists(shiftData.outletId, shiftData.tillId, shiftData.operatingDate)
      if (exists) {
        throw new Error("A shift already exists for this outlet, date, and till combination.")
      }

      const tills = await getTillsForOutlet(shiftData.outletId)
      const till = tills.find(t => t.id === shiftData.tillId)
      if (till?.isInUse) {
        throw new Error("This till is currently in use. Please select another till.")
      }

      const newShift: Shift = {
        ...shiftData,
        id: `shift-${Date.now()}`,
        status: "OPEN",
        startTime: new Date().toISOString(),
      }

      setActiveShiftState(newShift)
      return newShift
    }
  }

  const closeShift = async (closingCashBalance: number): Promise<void> => {
    if (!activeShift) {
      throw new Error("No active shift to close")
    }

    if (useRealAPI()) {
      // Use real API
      await shiftService.close(activeShift.id, closingCashBalance)
      setActiveShiftState(null)
      
      // Reload history
      if (currentOutlet) {
        try {
          const history = await shiftService.getHistory({ outlet: currentOutlet.id })
          setShiftHistory(history)
        } catch (error) {
          console.error("Error reloading shift history:", error)
        }
      }
    } else {
      // Simulation mode
      const closedShift: Shift = {
        ...activeShift,
        status: "CLOSED",
        endTime: new Date().toISOString(),
        closingCashBalance,
      }

      const updatedHistory = [closedShift, ...shiftHistory].slice(0, 100)
      setShiftHistory(updatedHistory)
      localStorage.setItem("shiftHistory", JSON.stringify(updatedHistory))
      setActiveShiftState(null)
    }
  }

  const getTillsForOutlet = async (outletId: string): Promise<Till[]> => {
    if (useRealAPI()) {
      try {
        return await outletService.getTills(outletId)
      } catch (error) {
        console.error("Error loading tills:", error)
        return []
      }
    } else {
      // Simulation mode - return empty array (tills should be created via API)
      return []
    }
  }

  const checkShiftExists = async (outletId: string, tillId: string, date: string): Promise<boolean> => {
    if (useRealAPI()) {
      try {
        return await shiftService.checkExists(outletId, tillId, date)
      } catch (error) {
        console.error("Error checking shift existence:", error)
        return false
      }
    } else {
      // Simulation mode - check localStorage
      try {
        const stored = localStorage.getItem("activeShift")
        if (stored) {
          const shift = JSON.parse(stored) as Shift
          return (
            shift.outletId === outletId &&
            shift.tillId === tillId &&
            shift.operatingDate === date &&
            shift.status === "OPEN"
          )
        }
      } catch (error) {
        console.error("Error checking shift existence:", error)
      }
      return false
    }
  }

  const value: ShiftContextType = {
    activeShift,
    shiftHistory,
    setActiveShift,
    startShift,
    closeShift,
    isLoading,
    getTillsForOutlet,
    checkShiftExists,
  }

  return <ShiftContext.Provider value={value}>{children}</ShiftContext.Provider>
}

export function useShift() {
  const context = useContext(ShiftContext)
  if (context === undefined) {
    throw new Error("useShift must be used within a ShiftProvider")
  }
  return context
}

