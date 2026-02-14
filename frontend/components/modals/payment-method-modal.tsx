"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils/currency"
import type { Business } from "@/lib/types"
import { CreditCard, Smartphone, Wallet, Receipt } from "lucide-react"
import type { Customer } from "@/lib/services/customerService"
import { useI18n } from "@/contexts/i18n-context"

type PaymentMethod = "cash" | "card" | "mobile" | "tab"

interface PaymentMethodModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  business: Business | null
  selectedCustomer?: Customer | null
  onConfirm?: (method: PaymentMethod, amount?: number, change?: number) => void
  onCancel?: () => void
}

export function PaymentMethodModal({
  open,
  onOpenChange,
  total,
  business,
  selectedCustomer,
  onConfirm,
  onCancel,
}: PaymentMethodModalProps) {
  const { t } = useI18n()
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [amount, setAmount] = useState<string>("")
  const [change, setChange] = useState<number>(0)
  const amountInputRef = useRef<HTMLInputElement | null>(null)

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelectedMethod(null)
      setAmount("")
      setChange(0)
    }
  }, [open])

  // Calculate change when amount changes
  useEffect(() => {
    if (selectedMethod === "cash" && amount) {
      const amountNum = parseFloat(amount) || 0
      const changeAmount = amountNum >= total ? amountNum - total : 0
      setChange(Math.round(changeAmount * 100) / 100)
    } else {
      setChange(0)
    }
  }, [amount, total, selectedMethod])

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method)
    if (method === "cash") {
      // Auto-focus amount input for cash
      setTimeout(() => {
        amountInputRef.current?.focus()
      }, 100)
    } else {
      setAmount("")
      setChange(0)
    }
  }

  const handleAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, "")
    // Only allow one decimal point
    const parts = cleaned.split(".")
    if (parts.length > 2) {
      return
    }
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return
    }
    setAmount(cleaned)
  }

  const appendAmount = (value: string) => {
    if (value === "clear") {
      setAmount("")
      return
    }

    if (value === "backspace") {
      setAmount((prev) => prev.slice(0, -1))
      return
    }

    if (value === ".") {
      if (!amount) {
        setAmount("0.")
        return
      }
      if (amount.includes(".")) return
    }

    handleAmountChange(`${amount}${value}`)
    setTimeout(() => amountInputRef.current?.focus(), 0)
  }

  const handleConfirm = () => {
    if (!selectedMethod || !onConfirm) return

    if (selectedMethod === "cash") {
      const amountNum = parseFloat(amount)
      const change = amountNum - total
      onConfirm(selectedMethod, amountNum, change)
    } else {
      // For other payment methods, no amount needed
      onConfirm(selectedMethod, total, 0)
    }
  }

  const canConfirm = () => {
    if (!selectedMethod) return false
    if (selectedMethod === "cash") {
      const amountNum = parseFloat(amount) || 0
      return amountNum >= total
    }
    return true
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Select Payment Method</DialogTitle>
          <DialogDescription>
            Total: {formatCurrency(total, business)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payment Method Selection */}
          {!selectedMethod && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleMethodSelect("cash")}
              >
                <Wallet className="h-6 w-6" />
                <span className="text-sm font-medium">Cash</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleMethodSelect("card")}
              >
                <CreditCard className="h-6 w-6" />
                <span className="text-sm font-medium">Card</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleMethodSelect("mobile")}
              >
                <Smartphone className="h-6 w-6" />
                <span className="text-sm font-medium">Mobile</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2"
                onClick={() => handleMethodSelect("tab")}
              >
                <Receipt className="h-6 w-6" />
                <span className="text-sm font-medium">Credit</span>
              </Button>
            </div>
          )}

          {/* Cash Amount Input */}
          {selectedMethod === "cash" && (
            <div className="pt-2 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="amount" className="text-sm">Amount Received</Label>
                  <Input
                    id="amount"
                    ref={amountInputRef}
                    type="number"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    step="0.01"
                    min="0"
                    enterKeyHint="done"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canConfirm()) {
                        handleConfirm()
                      }
                    }}
                    className="text-2xl font-bold text-center h-12"
                    autoFocus
                  />
                </div>

                {/* Change Display */}
                {change > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="text-xs text-muted-foreground">Change</div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(change, business)}
                    </div>
                  </div>
                )}

                {amount && parseFloat(amount) < total && (
                  <div className="text-xs text-destructive text-center">
                    Amount is less than total
                  </div>
                )}
              </div>

              {/* On-screen numeric keypad for touch devices */}
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    className="h-11 text-lg"
                    onClick={() => appendAmount(key)}
                  >
                    {key}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-lg"
                  onClick={() => appendAmount(".")}
                >
                  .
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-lg"
                  onClick={() => appendAmount("0")}
                >
                  0
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-lg"
                  onClick={() => appendAmount("backspace")}
                >
                  ⌫
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-sm col-span-3"
                  onClick={() => appendAmount("clear")}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Card Payment Confirmation */}
          {selectedMethod === "card" && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Card Payment
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Amount to charge: {formatCurrency(total, business)}
              </div>
            </div>
          )}

          {/* Mobile Payment Confirmation */}
          {selectedMethod === "mobile" && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
              <div className="text-sm font-medium text-purple-900 dark:text-purple-100">
                Mobile Payment
              </div>
              <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                Amount to charge: {formatCurrency(total, business)}
              </div>
            </div>
          )}

          {/* Credit/Tab Confirmation */}
          {selectedMethod === "tab" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Credit Sale
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Customer will be charged: {formatCurrency(total, business)}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t flex-shrink-0">
          {selectedMethod ? (
            <>
              <Button variant="outline" onClick={() => setSelectedMethod(null)}>
                Back
              </Button>
              <Button variant="outline" onClick={onCancel || (() => onOpenChange(false))}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!canConfirm()}>
                Confirm Payment
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onCancel || (() => onOpenChange(false))}>
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

