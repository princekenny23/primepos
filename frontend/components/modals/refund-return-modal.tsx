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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { receiptService } from "@/lib/services/receiptService"
import { saleService } from "@/lib/services/saleService"
import { useRouter } from "next/navigation"

interface RefundReturnModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialReceiptNumber?: string
}

type RefundStep = "items" | "restock" | "confirm"

type RefundItem = {
  id: string
  name: string
  quantity: number
  price: number
  total: number
}

export function RefundReturnModal({ open, onOpenChange, initialReceiptNumber }: RefundReturnModalProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [step, setStep] = useState<RefundStep>("items")
  const [receiptNumber, setReceiptNumber] = useState("")
  const [saleId, setSaleId] = useState<string | null>(null)
  const [saleItems, setSaleItems] = useState<RefundItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false)
  const [restock, setRestock] = useState(true)
  const [reason, setReason] = useState("")
  const [refundMethod, setRefundMethod] = useState<"original" | "cash" | "manual" | "">("")
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep("items")
      setReceiptNumber("")
      setSaleId(null)
      setSaleItems([])
      setSelectedItems({})
      setRestock(true)
      setReason("")
      setRefundMethod("")
      setIsLoadingReceipt(false)
      setIsProcessing(false)
      return
    }
    if (initialReceiptNumber) {
      setReceiptNumber(initialReceiptNumber)
    }
  }, [open, initialReceiptNumber])

  const normalizeReceiptNumber = (value: string) => {
    return value
      .trim()
      .replace(/^receipt[-\s]*/i, "")
      .replace(/^#/, "")
  }

  const loadReceipt = async () => {
    if (!receiptNumber.trim()) {
      toast({
        title: "Receipt Required",
        description: "Enter a receipt number to load items.",
        variant: "destructive",
      })
      return
    }

    setIsLoadingReceipt(true)
    try {
      const rawInput = receiptNumber.trim()
      const cleanedInput = normalizeReceiptNumber(rawInput)

      let foundSaleId: string | undefined

      const searchTerm = cleanedInput || rawInput
      const saleSearch = await saleService.list({ search: searchTerm })
      const match = saleSearch.results?.[0]
      foundSaleId = match?.id

      if (!foundSaleId) {
        let receipt = null as any
        try {
          receipt = await receiptService.getByNumber(rawInput)
        } catch (error) {
          if (cleanedInput && cleanedInput !== rawInput) {
            try {
              receipt = await receiptService.getByNumber(cleanedInput)
            } catch (innerError) {
              receipt = null
            }
          } else {
            receipt = null
          }
        }
        foundSaleId = receipt?.sale?.id || receipt?.sale_detail?.id
      }

      if (!foundSaleId) {
        throw new Error("Sale not found for this receipt.")
      }

      const sale = await saleService.get(String(foundSaleId))
      const rawItems = (sale as any)._raw?.items || sale.items || []
      const items: RefundItem[] = rawItems.map((item: any, index: number) => ({
        id: String(item.id || item.sale_item_id || item.product_id || `item-${index}`),
        name: item.product_name || item.productName || item.name || item.product?.name || "Unknown Product",
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        total: Number(item.total || (item.price || 0) * (item.quantity || 0)),
      }))

      const selected: Record<string, number> = {}
      items.forEach((item) => {
        if (item.quantity > 0) {
          selected[item.id] = item.quantity
        }
      })

      setSaleId(String(foundSaleId))
      setSaleItems(items)
      setSelectedItems(selected)
    } catch (error: any) {
      toast({
        title: "Receipt Not Found",
        description: error?.message || "Unable to load receipt items.",
        variant: "destructive",
      })
      setSaleId(null)
      setSaleItems([])
      setSelectedItems({})
    } finally {
      setIsLoadingReceipt(false)
    }
  }

  const toggleItem = (itemId: string, checked: boolean) => {
    setSelectedItems((prev) => {
      const next = { ...prev }
      if (!checked) {
        delete next[itemId]
      } else {
        next[itemId] = next[itemId] || 1
      }
      return next
    })
  }

  const updateQuantity = (itemId: string, quantity: number, max: number) => {
    const safeQty = Math.max(1, Math.min(max, quantity))
    setSelectedItems((prev) => ({ ...prev, [itemId]: safeQty }))
  }

  const selectedCount = Object.values(selectedItems).reduce((sum, qty) => sum + (qty || 0), 0)
  const refundAmount = saleItems.reduce((sum, item) => {
    const qty = selectedItems[item.id]
    if (!qty) return sum
    const perUnit = item.quantity > 0 ? item.total / item.quantity : item.price
    return sum + perUnit * qty
  }, 0)

  const handleConfirmRefund = async () => {
    if (!saleId) return
    if (!refundMethod) {
      toast({
        title: "Refund Method Required",
        description: "Select a refund method to continue.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      const itemsPayload = saleItems
        .filter((item) => selectedItems[item.id])
        .map((item) => ({
          item_id: item.id,
          quantity: selectedItems[item.id],
        }))

      await saleService.refund(String(saleId), {
        reason: reason.trim() || undefined,
        restock,
        refund_method: refundMethod,
        refund_amount: refundAmount,
        items: itemsPayload,
      })

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sale-completed"))
      }

      toast({
        title: "Refund Processed",
        description: "Refund completed successfully.",
      })
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Refund Failed",
        description: error?.message || "Unable to process refund.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Dialog open={open && step === "items"} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onOpenChange(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Select Items to Refund
            </DialogTitle>
            <DialogDescription>
              Choose items and quantities from the receipt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="refund-receipt-number">Receipt Number *</Label>
              <div className="flex gap-2">
                <Input
                  id="refund-receipt-number"
                  placeholder="Enter or scan receipt number"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={loadReceipt}
                  disabled={isLoadingReceipt || !receiptNumber.trim()}
                >
                  {isLoadingReceipt ? "Loading..." : "Load"}
                </Button>
              </div>
            </div>

            {saleItems.length > 0 ? (
              <div className="space-y-2">
                {saleItems.map((item) => {
                  const checked = selectedItems[item.id] !== undefined
                  return (
                    <div key={item.id} className="flex items-center gap-3 border rounded-md p-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleItem(item.id, Boolean(value))}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-gray-500">Sold: {item.quantity}</div>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        max={item.quantity}
                        value={selectedItems[item.id] ?? ""}
                        onChange={(e) => updateQuantity(item.id, Number(e.target.value || 1), item.quantity)}
                        disabled={!checked}
                        className="w-20"
                      />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Load a receipt to see items.</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => router.push("/dashboard/sales/transactions")}>Find Transaction</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => setStep("restock")}
              disabled={!saleId || selectedCount === 0}
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open && step === "restock"} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onOpenChange(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restock & Reason</DialogTitle>
            <DialogDescription>Choose whether to return items to stock and add a reason.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Return to stock?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={restock ? "default" : "outline"}
                  onClick={() => setRestock(true)}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={!restock ? "default" : "outline"}
                  onClick={() => setRestock(false)}
                >
                  No
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason (Optional)</Label>
              <Input
                id="refund-reason"
                placeholder="Reason for refund"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("items")}>Back</Button>
            <Button onClick={() => setStep("confirm")}>Next</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open && step === "confirm"} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onOpenChange(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Refund</DialogTitle>
            <DialogDescription>Review amount and select refund method.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <div className="text-sm text-gray-500">Refund Amount</div>
              <div className="text-lg font-semibold">
                {refundAmount.toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refund-method">Refund Method *</Label>
              <Select value={refundMethod} onValueChange={(value) => setRefundMethod(value as typeof refundMethod)}>
                <SelectTrigger id="refund-method">
                  <SelectValue placeholder="Select refund method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Original Payment</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("restock")}>Back</Button>
            <Button onClick={handleConfirmRefund} disabled={isProcessing || !refundMethod}>
              {isProcessing ? "Processing..." : "Issue Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

