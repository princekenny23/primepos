"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"

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

// Mock tills data - will be replaced with API calls
const mockTills: Till[] = [
  { id: "till-1", name: "Till 1", outletId: "outlet-1", isActive: true, isInUse: false },
  { id: "till-2", name: "Till 2", outletId: "outlet-1", isActive: true, isInUse: false },
  { id: "till-3", name: "Till 3", outletId: "outlet-1", isActive: true, isInUse: true },
  { id: "till-4", name: "Till 1", outletId: "outlet-2", isActive: true, isInUse: false },
  { id: "till-5", name: "Till 2", outletId: "outlet-2", isActive: true, isInUse: false },
]

export function ShiftProvider({ children }: { children: ReactNode }) {
  const [activeShift, setActiveShiftState] = useState<Shift | null>(null)
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load active shift and history from localStorage on mount
  useEffect(() => {
    const loadShifts = () => {
      try {
        // Load active shift
        const stored = localStorage.getItem("activeShift")
        if (stored) {
          const shift = JSON.parse(stored) as Shift
          // Check if shift is still valid (not expired, still open)
          if (shift.status === "OPEN") {
            setActiveShiftState(shift)
          } else {
            localStorage.removeItem("activeShift")
          }
        }

        // Load shift history
        const historyStored = localStorage.getItem("shiftHistory")
        if (historyStored) {
          const history = JSON.parse(historyStored) as Shift[]
          setShiftHistory(history)
        }
      } catch (error) {
        console.error("Error loading shifts:", error)
        localStorage.removeItem("activeShift")
      } finally {
        setIsLoading(false)
      }
    }

    loadShifts()
  }, [])

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
    // In production, this would be an API call
    // const response = await fetch("/api/shifts/start", { method: "POST", body: JSON.stringify(shiftData) })
    
    // Check if shift already exists
    const exists = await checkShiftExists(shiftData.outletId, shiftData.tillId, shiftData.operatingDate)
    if (exists) {
      throw new Error("A shift already exists for this outlet, date, and till combination.")
    }

    // Check if till is in use
    const tills = await getTillsForOutlet(shiftData.outletId)
    const till = tills.find(t => t.id === shiftData.tillId)
    if (till?.isInUse) {
      throw new Error("This till is currently in use. Please select another till.")
    }

    // Create new shift
    const newShift: Shift = {
      ...shiftData,
      id: `shift-${Date.now()}`,
      status: "OPEN",
      startTime: new Date().toISOString(),
    }

    // Mark till as in use
    const updatedTills = mockTills.map(t => 
      t.id === shiftData.tillId ? { ...t, isInUse: true } : t
    )

    setActiveShiftState(newShift)
    
    // In production, you would update the backend here
    // await fetch("/api/tills/update", { method: "PUT", body: JSON.stringify({ id: shiftData.tillId, isInUse: true }) })

    return newShift
  }

  const closeShift = async (closingCashBalance: number): Promise<void> => {
    if (!activeShift) {
      throw new Error("No active shift to close")
    }

    // In production, this would be an API call
    // await fetch(`/api/shifts/${activeShift.id}/close`, { method: "POST", body: JSON.stringify({ closingCashBalance }) })

    const closedShift: Shift = {
      ...activeShift,
      status: "CLOSED",
      endTime: new Date().toISOString(),
      closingCashBalance,
    }

    // Mark till as available
    const updatedTills = mockTills.map(t => 
      t.id === activeShift.tillId ? { ...t, isInUse: false } : t
    )

    // Add to history
    const updatedHistory = [closedShift, ...shiftHistory].slice(0, 100) // Keep last 100 shifts
    setShiftHistory(updatedHistory)
    localStorage.setItem("shiftHistory", JSON.stringify(updatedHistory))

    setActiveShiftState(null)
    
    // In production, you would update the backend here
  }

  const getTillsForOutlet = async (outletId: string): Promise<Till[]> => {
    // In production, this would be an API call
    // const response = await fetch(`/api/outlets/${outletId}/tills`)
    // return response.json()
    
    return mockTills.filter(till => till.outletId === outletId && till.isActive)
  }

  const checkShiftExists = async (outletId: string, tillId: string, date: string): Promise<boolean> => {
    // In production, this would be an API call
    // const response = await fetch(`/api/shifts/check?outletId=${outletId}&tillId=${tillId}&date=${date}`)
    // return response.json().exists
    
    // For now, check localStorage for existing shifts
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

