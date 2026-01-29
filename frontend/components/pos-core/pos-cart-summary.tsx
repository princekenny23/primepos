'use client'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CreditCard, Percent, Trash2 } from 'lucide-react'

interface PosCartSummaryProps {
  subtotal: number
  tax: number
  discount: number
  total: number
  itemCount: number
  onApplyDiscount?: () => void
  onProcessPayment?: () => void
  onClear?: () => void
  isProcessing?: boolean
  paymentLabel?: string
}

/**
 * Unified POS cart summary/footer used across all POS systems
 * Shows totals and quick action buttons
 */
export function PosCartSummary({
  subtotal,
  tax,
  discount,
  total,
  itemCount,
  onApplyDiscount,
  onProcessPayment,
  onClear,
  isProcessing = false,
  paymentLabel = 'Checkout',
}: PosCartSummaryProps) {
  return (
    <div className="border-t bg-card p-4 space-y-3">
      {/* Item Count */}
      <div className="text-sm text-muted-foreground">
        {itemCount} items in cart
      </div>

      {/* Totals */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span className="font-medium">${subtotal.toFixed(2)}</span>
        </div>

        {tax > 0 && (
          <div className="flex justify-between">
            <span>Tax:</span>
            <span className="font-medium">${tax.toFixed(2)}</span>
          </div>
        )}

        {discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount:</span>
            <span className="font-medium">-${discount.toFixed(2)}</span>
          </div>
        )}

        <Separator className="my-2" />

        <div className="flex justify-between text-base font-bold">
          <span>Total:</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
        {onApplyDiscount && (
          <Button
            variant="outline"
            size="sm"
            onClick={onApplyDiscount}
            disabled={isProcessing || itemCount === 0}
            className="flex-1"
          >
            <Percent className="h-4 w-4 mr-1" />
            Discount
          </Button>
        )}

        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={isProcessing || itemCount === 0}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {onProcessPayment && (
          <Button
            onClick={onProcessPayment}
            disabled={isProcessing || itemCount === 0}
            className="flex-1"
          >
            <CreditCard className="h-4 w-4 mr-1" />
            {paymentLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
