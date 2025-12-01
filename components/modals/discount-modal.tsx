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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Percent } from "lucide-react"
import { useState } from "react"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  discount: number
  total: number
}

interface DiscountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: CartItem | null
  onApply: (discount: number) => void
}

export function DiscountModal({ open, onOpenChange, item, onApply }: DiscountModalProps) {
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage")
  const [discountValue, setDiscountValue] = useState<string>("")

  if (!item) return null

  const maxDiscount = discountType === "percentage" ? 100 : item.price * item.quantity
  const calculatedDiscount = discountType === "percentage"
    ? (item.price * item.quantity * parseFloat(discountValue || "0")) / 100
    : parseFloat(discountValue || "0")

  const handleApply = () => {
    const discount = Math.min(calculatedDiscount, maxDiscount)
    onApply(discount)
    setDiscountValue("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Discount</DialogTitle>
          <DialogDescription>
            Apply discount to {item.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Item Total</p>
            <p className="text-xl font-bold">${(item.price * item.quantity).toFixed(2)}</p>
          </div>

          <Tabs value={discountType} onValueChange={(value) => {
            setDiscountType(value as "percentage" | "amount")
            setDiscountValue("")
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="percentage">Percentage</TabsTrigger>
              <TabsTrigger value="amount">Amount</TabsTrigger>
            </TabsList>

            <TabsContent value="percentage" className="space-y-2 mt-4">
              <Label htmlFor="discount-percent">Discount Percentage</Label>
              <div className="relative">
                <Input
                  id="discount-percent"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
                <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              {discountValue && (
                <p className="text-sm text-muted-foreground">
                  Discount: ${calculatedDiscount.toFixed(2)}
                </p>
              )}
            </TabsContent>

            <TabsContent value="amount" className="space-y-2 mt-4">
              <Label htmlFor="discount-amount">Discount Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="discount-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={maxDiscount}
                  placeholder="0.00"
                  className="pl-7"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
              {discountValue && (
                <p className="text-sm text-muted-foreground">
                  Percentage: {((calculatedDiscount / (item.price * item.quantity)) * 100).toFixed(1)}%
                </p>
              )}
            </TabsContent>
          </Tabs>

          {discountValue && calculatedDiscount > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                New Total: ${((item.price * item.quantity) - calculatedDiscount).toFixed(2)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!discountValue || calculatedDiscount <= 0 || calculatedDiscount > maxDiscount}
          >
            Apply Discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

