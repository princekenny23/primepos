"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, UserPlus } from "lucide-react"

interface PaymentSectionProps {
  subtotal: number
  discount: number
  tax: number
  total: number
  onPayment: () => void
  onAddCustomer: () => void
  disabled: boolean
}

export function PaymentSection({
  subtotal,
  discount,
  tax,
  total,
  onPayment,
  onAddCustomer,
  disabled,
}: PaymentSectionProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>MWK {subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-green-600">-MWK {discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span>MWK {tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span>MWK {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            className="w-full h-12 text-lg"
            onClick={onPayment}
            disabled={disabled}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Process Payment
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={onAddCustomer}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

