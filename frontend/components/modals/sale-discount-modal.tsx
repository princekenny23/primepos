"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Percent, X } from "lucide-react"
import { useState, useEffect } from "react"
import { formatCurrency } from "@/lib/utils/currency"
import type { Business } from "@/lib/types"

export interface SaleDiscount {
  type: "percentage" | "amount"
  value: number
  reason?: string
}

interface SaleDiscountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtotal: number
  currentDiscount?: SaleDiscount | null
  business: Business
  onApply: (discount: SaleDiscount) => void
  onRemove: () => void
}

export function SaleDiscountModal({
  open,
  onOpenChange,
  subtotal,
  currentDiscount,
  business,
  onApply,
  onRemove,
}: SaleDiscountModalProps) {
  const [discountType, setDiscountType] = useState<"percentage" | "amount">(
    currentDiscount?.type || "percentage"
  )
  const [discountValue, setDiscountValue] = useState<string>(
    currentDiscount ? String(currentDiscount.value) : ""
  )
  const [discountReason, setDiscountReason] = useState<string>(
    currentDiscount?.reason || ""
  )

  // Reset form when modal opens/closes or currentDiscount changes
  useEffect(() => {
    if (open) {
      if (currentDiscount) {
        setDiscountType(currentDiscount.type)
        setDiscountValue(String(currentDiscount.value))
        setDiscountReason(currentDiscount.reason || "")
      } else {
        setDiscountType("percentage")
        setDiscountValue("")
        setDiscountReason("")
      }
    }
  }, [open, currentDiscount])

  const maxDiscount = discountType === "percentage" ? 100 : subtotal
  const calculatedDiscount = discountType === "percentage"
    ? (subtotal * parseFloat(discountValue || "0")) / 100
    : parseFloat(discountValue || "0")

  const finalDiscount = Math.min(Math.max(0, calculatedDiscount), maxDiscount)
  const finalTotal = subtotal - finalDiscount

  const handleApply = () => {
    if (!discountValue || finalDiscount <= 0 || finalDiscount > maxDiscount) {
      return
    }

    const discount: SaleDiscount = {
      type: discountType,
      value: discountType === "percentage" ? parseFloat(discountValue) : finalDiscount,
      reason: discountReason.trim() || undefined,
    }

    onApply(discount)
    onOpenChange(false)
  }

  const handleRemove = () => {
    onRemove()
    onOpenChange(false)
  }

  const isValid = discountValue && finalDiscount > 0 && finalDiscount <= maxDiscount

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply Discount to Sale</DialogTitle>
          <DialogDescription>
            Apply a discount to the entire sale
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-4">
            {/* Subtotal Display */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Subtotal</p>
              <p className="text-xl font-bold">{formatCurrency(subtotal, business)}</p>
            </div>

            {/* Discount Type Tabs */}
            <Tabs 
              value={discountType} 
              onValueChange={(value) => {
                setDiscountType(value as "percentage" | "amount")
                setDiscountValue("")
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="percentage">Percentage</TabsTrigger>
                <TabsTrigger value="amount">Amount</TabsTrigger>
              </TabsList>

              <TabsContent value="percentage" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="discount-percent">Discount Percentage</Label>
                  <div className="relative">
                    <Input
                      id="discount-percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0.00"
                      value={discountValue}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "" || (parseFloat(val) >= 0 && parseFloat(val) <= 100)) {
                          setDiscountValue(val)
                        }
                      }}
                      className="pr-10"
                      autoFocus
                    />
                    <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  {discountValue && (
                    <p className="text-sm text-muted-foreground">
                      Discount: {formatCurrency(finalDiscount, business)}
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="amount" className="space-y-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="discount-amount">Discount Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      {business.currencySymbol}
                    </span>
                    <Input
                      id="discount-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={maxDiscount}
                      placeholder="0.00"
                      className="pl-7"
                      value={discountValue}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "" || (parseFloat(val) >= 0 && parseFloat(val) <= maxDiscount)) {
                          setDiscountValue(val)
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  {discountValue && (
                    <p className="text-sm text-muted-foreground">
                      Percentage: {subtotal > 0 ? ((finalDiscount / subtotal) * 100).toFixed(2) : "0.00"}%
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            {/* Discount Reason (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="discount-reason">Reason (Optional)</Label>
              <Textarea
                id="discount-reason"
                placeholder="e.g., Customer loyalty, Manager approval, etc."
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            {/* Preview */}
            {isValid && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal, business)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatCurrency(finalDiscount, business)}
                    </span>
                  </div>
                  <div className="border-t pt-1 mt-1 flex justify-between">
                    <span className="font-semibold">Final Total:</span>
                    <span className="font-bold text-lg">{formatCurrency(finalTotal, business)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {currentDiscount && (
              <Button
                variant="outline"
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Discount
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isValid}
            >
              Apply Discount
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

