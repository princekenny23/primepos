"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Receipt } from "lucide-react"

interface PreviewReceiptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PreviewReceiptModal({ open, onOpenChange }: PreviewReceiptModalProps) {
  // Mock receipt data
  const receiptItems = [
    { name: "Product A", quantity: 2, price: 29.99, total: 59.98 },
    { name: "Product B", quantity: 1, price: 49.99, total: 49.99 },
  ]

  const subtotal = receiptItems.reduce((sum, item) => sum + item.total, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Receipt Preview
          </DialogTitle>
          <DialogDescription>
            Preview how your receipts will look
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-3 text-sm p-4 border rounded-lg bg-white">
            <div className="text-center border-b pb-2">
              <p className="font-bold text-lg">PRIMEPOS</p>
              <p className="text-xs text-muted-foreground">Receipt</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date().toLocaleString()}
              </p>
            </div>

            <div className="space-y-1 border-b pb-2">
              {receiptItems.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <div className="flex-1">
                    <p>{item.name}</p>
                    <p className="text-muted-foreground">
                      {item.quantity} x ${item.price.toFixed(2)}
                    </p>
                  </div>
                  <p className="font-medium">${item.total.toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs border-b pb-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (10%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>TOTAL</span>
              <span>${total.toFixed(2)}</span>
            </div>

            <div className="text-center text-xs text-muted-foreground pt-4 border-t">
              <p>Thank you for your purchase!</p>
              <p className="mt-1">Visit us again!</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

