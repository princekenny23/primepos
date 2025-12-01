"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { 
  X, 
  DollarSign, 
  Clock, 
  Calculator,
  AlertCircle,
  Loader2 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useShift } from "@/contexts/shift-context"
import { cn } from "@/lib/utils"

interface CloseRegisterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CloseRegisterModal({ open, onOpenChange }: CloseRegisterModalProps) {
  const router = useRouter()
  const { activeShift, closeShift } = useShift()
  const [closingCash, setClosingCash] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>("")

  if (!activeShift) {
    return null
  }

  const formatCurrency = (value: string): string => {
    const numericValue = value.replace(/[^\d.]/g, "")
    const parts = numericValue.split(".")
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("")
    }
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + "." + parts[1].substring(0, 2)
    }
    return numericValue
  }

  const handleCashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value)
    setClosingCash(formatted)
    if (error) {
      setError("")
    }
  }

  const calculateDifference = (): number => {
    const opening = activeShift.openingCashBalance || 0
    const closing = parseFloat(closingCash) || 0
    return closing - opening
  }

  const handleClose = () => {
    setClosingCash("")
    setError("")
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const closingCashNum = parseFloat(closingCash) || 0
    if (closingCashNum < 0) {
      setError("Closing cash balance cannot be negative")
      return
    }

    if (!closingCash || closingCashNum === 0) {
      setError("Please enter the closing cash balance")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await closeShift(closingCashNum)
      handleClose()
      // Redirect to start shift page or show register closed screen
      router.push("/dashboard/pos")
    } catch (err) {
      console.error("Error closing shift:", err)
      setError(err instanceof Error ? err.message : "Failed to close register. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const shiftDuration = activeShift.startTime
    ? Math.round((new Date().getTime() - new Date(activeShift.startTime).getTime()) / (1000 * 60))
    : 0

  const hours = Math.floor(shiftDuration / 60)
  const minutes = shiftDuration % 60

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Close Register</DialogTitle>
          <DialogDescription>
            Enter the closing cash balance to end your shift
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Shift Summary */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Shift Duration
              </span>
              <span className="font-medium">
                {hours}h {minutes}m
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Opening Cash
              </span>
              <span className="font-medium">
                MWK {(activeShift.openingCashBalance || 0).toFixed(2)}
              </span>
            </div>
            {activeShift.floatingCash > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Floating Cash</span>
                <span className="font-medium">
                  MWK {activeShift.floatingCash.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Total Available</span>
              <span className="font-semibold">
                MWK {((activeShift.openingCashBalance || 0) + (activeShift.floatingCash || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Closing Cash Input */}
          <div className="space-y-2">
            <Label htmlFor="closingCash" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Closing Cash Balance <span className="text-destructive">*</span>
            </Label>
            <Input
              id="closingCash"
              type="text"
              inputMode="decimal"
              value={closingCash}
              onChange={handleCashChange}
              placeholder="0.00"
              className={cn(error && "border-destructive")}
              autoFocus
            />
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter the total amount of cash in the drawer at the end of the shift
            </p>
          </div>

          {/* Cash Difference */}
          {closingCash && !isNaN(parseFloat(closingCash)) && (
            <div className="p-3 rounded-lg border bg-background">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cash Difference</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    calculateDifference() >= 0
                      ? "text-green-600"
                      : "text-destructive"
                  )}
                >
                  {calculateDifference() >= 0 ? "+" : ""}
                  MWK {calculateDifference().toFixed(2)}
                </span>
              </div>
              {calculateDifference() !== 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {calculateDifference() > 0
                    ? "Cash over (more than opening)"
                    : "Cash short (less than opening)"}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !closingCash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Close Register
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


