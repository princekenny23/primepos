"use client"

import { useState } from "react"
import { format } from "date-fns"
import { 
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
import { shiftService } from "@/lib/services/shiftService"
import { useBusinessStore } from "@/stores/businessStore"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import type { Shift } from "@/lib/services/shiftService"
import { useI18n } from "@/contexts/i18n-context"

interface CloseShiftModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: Shift | null
  onSuccess?: () => void
}

export function CloseShiftModal({ open, onOpenChange, shift, onSuccess }: CloseShiftModalProps) {
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()
  const { t } = useI18n()
  const [closingCash, setClosingCash] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string>("")

  if (!shift) {
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
    const opening = shift.openingCashBalance || 0
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
      await shiftService.close(shift.id, closingCashNum)
      toast({
        title: "Shift Closed",
        description: "The shift has been closed successfully.",
      })
      handleClose()
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error("Error closing shift:", err)
      setError(err instanceof Error ? err.message : "Failed to close shift. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const shiftDuration = (() => {
    if (!shift.startTime) return 0
    try {
      const startDate = new Date(shift.startTime)
      if (isNaN(startDate.getTime())) return 0
      return Math.round((new Date().getTime() - startDate.getTime()) / (1000 * 60))
    } catch {
      return 0
    }
  })()

  const hours = Math.floor(shiftDuration / 60)
  const minutes = shiftDuration % 60
  const totalPosSales = shift.totalSales ?? shift.systemTotal ?? 0
  const difference = calculateDifference()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Close Shift</DialogTitle>
          <DialogDescription>
            Enter the closing cash balance to close this shift
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shift Info */}
          <div className="rounded-lg border p-4 space-y-3 bg-muted/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Shift ID:</span>
              <span className="font-medium">#{shift.id.slice(-6)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Duration:
              </span>
              <span className="font-medium">{hours}h {minutes}m</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                Opening Cash:
              </span>
              <span className="font-medium">
                {currentBusiness?.currencySymbol || "MWK"} {shift.openingCashBalance.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                Total Sold (POS):
              </span>
              <span className="font-medium">
                {currentBusiness?.currencySymbol || "MWK"} {totalPosSales.toFixed(2)}
              </span>
            </div>
            {shift.startTime && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Started:</span>
                <span className="font-medium">
                  {format(new Date(shift.startTime), "MMM dd, yyyy HH:mm")}
                </span>
              </div>
            )}
          </div>

          {/* Closing Cash Input */}
          <div className="space-y-2">
            <Label htmlFor="closingCash" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Closing Cash Balance <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currentBusiness?.currencySymbol || "MWK"}
              </span>
              <Input
                id="closingCash"
                type="text"
                inputMode="decimal"
                value={closingCash}
                onChange={handleCashChange}
                placeholder={t("common.amount_placeholder")}
                className={cn(error && "border-destructive", "pl-12")}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Difference Display */}
          {closingCash && !isNaN(parseFloat(closingCash)) && (
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Difference:</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    difference > 0
                      ? "text-green-600"
                      : difference < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {difference > 0 ? "+" : ""}
                  {currentBusiness?.currencySymbol || "MWK"} {Math.abs(difference).toFixed(2)}
                </span>
              </div>
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                "Close Shift"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

















