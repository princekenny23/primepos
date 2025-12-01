"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Store, Calendar, CreditCard, DollarSign, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTenant } from "@/contexts/tenant-context"
import { useShift, Till } from "@/contexts/shift-context"
import { useRole } from "@/contexts/role-context"
import { cn } from "@/lib/utils"

interface FormErrors {
  outlet?: string
  date?: string
  till?: string
  openingCash?: string
  floatingCash?: string
  general?: string
}

export function StartShiftForm() {
  const router = useRouter()
  const { currentOutlet, outlets } = useTenant()
  const { startShift, getTillsForOutlet, checkShiftExists } = useShift()
  const { role } = useRole()

  const [selectedOutlet, setSelectedOutlet] = useState<string>(currentOutlet?.id || "")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedTill, setSelectedTill] = useState<string>("")
  const [openingCash, setOpeningCash] = useState<string>("0.00")
  const [floatingCash, setFloatingCash] = useState<string>("0.00")
  const [notes, setNotes] = useState<string>("")
  
  const [tills, setTills] = useState<Till[]>([])
  const [loadingTills, setLoadingTills] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // Load tills when outlet changes
  useEffect(() => {
    if (selectedOutlet) {
      loadTills(selectedOutlet)
    } else {
      setTills([])
      setSelectedTill("")
    }
  }, [selectedOutlet])

  // Set default outlet on mount
  useEffect(() => {
    if (currentOutlet && !selectedOutlet) {
      setSelectedOutlet(currentOutlet.id)
    }
  }, [currentOutlet])

  const loadTills = async (outletId: string) => {
    setLoadingTills(true)
    try {
      const availableTills = await getTillsForOutlet(outletId)
      setTills(availableTills)
      // Auto-select first available till if only one
      if (availableTills.length === 1 && !selectedTill) {
        setSelectedTill(availableTills[0].id)
      }
    } catch (error) {
      console.error("Error loading tills:", error)
      setErrors({ general: "Failed to load tills. Please try again." })
    } finally {
      setLoadingTills(false)
    }
  }

  const formatCurrency = (value: string): string => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^\d.]/g, "")
    
    // Handle multiple decimal points
    const parts = numericValue.split(".")
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("")
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + "." + parts[1].substring(0, 2)
    }
    
    return numericValue
  }

  const handleOpeningCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value)
    setOpeningCash(formatted)
    if (errors.openingCash) {
      setErrors({ ...errors, openingCash: undefined })
    }
  }

  const handleFloatingCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value)
    setFloatingCash(formatted)
    if (errors.floatingCash) {
      setErrors({ ...errors, floatingCash: undefined })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!selectedOutlet) {
      newErrors.outlet = "Please select an outlet"
    }

    if (!selectedDate) {
      newErrors.date = "Please select an operating date"
    } else {
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      if (selectedDate > today) {
        newErrors.date = "Operating date cannot be in the future"
      }
    }

    if (!selectedTill) {
      newErrors.till = "Please select a till"
    }

    const openingCashNum = parseFloat(openingCash) || 0
    if (openingCashNum < 0) {
      newErrors.openingCash = "Opening cash balance cannot be negative"
    }

    const floatingCashNum = parseFloat(floatingCash) || 0
    if (floatingCashNum < 0) {
      newErrors.floatingCash = "Floating cash cannot be negative"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // Check if shift already exists
      const dateString = format(selectedDate, "yyyy-MM-dd")
      const shiftExists = await checkShiftExists(selectedOutlet, selectedTill, dateString)
      
      if (shiftExists) {
        setErrors({ general: "A shift already exists for this outlet, date, and till combination." })
        setIsSubmitting(false)
        return
      }

      // Get current user ID (in production, this would come from auth context)
      const userId = "user-1" // Mock user ID

      // Create shift
      const shift = await startShift({
        outletId: selectedOutlet,
        tillId: selectedTill,
        userId,
        operatingDate: dateString,
        openingCashBalance: parseFloat(openingCash) || 0,
        floatingCash: parseFloat(floatingCash) || 0,
        notes: notes.trim() || undefined,
      })

      // Redirect to POS page
      router.push("/dashboard/pos")
    } catch (error) {
      console.error("Error starting shift:", error)
      setErrors({
        general: error instanceof Error ? error.message : "Failed to start shift. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter outlets based on user role (in production, this would come from API)
  const availableOutlets = outlets.filter(outlet => outlet.isActive)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.general && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {errors.general}
        </div>
      )}

      {/* Outlet Selection */}
      <div className="space-y-2">
        <Label htmlFor="outlet" className="flex items-center gap-2">
          <Store className="h-4 w-4" />
          Outlet <span className="text-destructive">*</span>
        </Label>
        <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
          <SelectTrigger id="outlet" className={cn(errors.outlet && "border-destructive")}>
            <SelectValue placeholder="Select an outlet" />
          </SelectTrigger>
          <SelectContent>
            {availableOutlets.map((outlet) => (
              <SelectItem key={outlet.id} value={outlet.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{outlet.name}</span>
                  {outlet.address && (
                    <span className="text-xs text-muted-foreground">{outlet.address}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.outlet && (
          <p className="text-sm text-destructive">{errors.outlet}</p>
        )}
      </div>

      {/* Operating Date */}
      <div className="space-y-2">
        <Label htmlFor="date" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Operating Date <span className="text-destructive">*</span>
        </Label>
        <DatePicker
          date={selectedDate}
          onDateChange={(date) => {
            if (date) {
              setSelectedDate(date)
              if (errors.date) {
                setErrors({ ...errors, date: undefined })
              }
            }
          }}
          className={cn(errors.date && "border-destructive")}
        />
        {errors.date && (
          <p className="text-sm text-destructive">{errors.date}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Select the date for this shift. Cannot be in the future.
        </p>
      </div>

      {/* Till Selection */}
      <div className="space-y-2">
        <Label htmlFor="till" className="flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Till <span className="text-destructive">*</span>
        </Label>
        <Select
          value={selectedTill}
          onValueChange={setSelectedTill}
          disabled={!selectedOutlet || loadingTills}
        >
          <SelectTrigger id="till" className={cn(errors.till && "border-destructive")}>
            <SelectValue placeholder={loadingTills ? "Loading tills..." : "Select a till"} />
          </SelectTrigger>
          <SelectContent>
            {tills.length === 0 && !loadingTills ? (
              <div className="p-2 text-sm text-muted-foreground">No tills available</div>
            ) : (
              tills.map((till) => (
                <SelectItem
                  key={till.id}
                  value={till.id}
                  disabled={till.isInUse}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{till.name}</span>
                    {till.isInUse && (
                      <span className="text-xs text-muted-foreground ml-2">(In Use)</span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {errors.till && (
          <p className="text-sm text-destructive">{errors.till}</p>
        )}
        {loadingTills && (
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading available tills...
          </p>
        )}
      </div>

      {/* Opening Cash Balance */}
      <div className="space-y-2">
        <Label htmlFor="openingCash" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Opening Cash Balance <span className="text-destructive">*</span>
        </Label>
        <Input
          id="openingCash"
          type="text"
          inputMode="decimal"
          value={openingCash}
          onChange={handleOpeningCashChange}
          placeholder="0.00"
          className={cn(errors.openingCash && "border-destructive")}
        />
        {errors.openingCash && (
          <p className="text-sm text-destructive">{errors.openingCash}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Amount of cash in drawer at start of shift
        </p>
      </div>

      {/* Floating Cash */}
      <div className="space-y-2">
        <Label htmlFor="floatingCash" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Floating Cash (Optional)
        </Label>
        <Input
          id="floatingCash"
          type="text"
          inputMode="decimal"
          value={floatingCash}
          onChange={handleFloatingCashChange}
          placeholder="0.00"
          className={cn(errors.floatingCash && "border-destructive")}
        />
        {errors.floatingCash && (
          <p className="text-sm text-destructive">{errors.floatingCash}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Additional cash available for making change
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Notes (Optional)
        </Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter any notes about this shift..."
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          {notes.length}/500 characters
        </p>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-12 text-base font-semibold"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Starting Shift...
          </>
        ) : (
          <>
            <CalendarIcon className="mr-2 h-5 w-5" />
            START SELLING
          </>
        )}
      </Button>
    </form>
  )
}


