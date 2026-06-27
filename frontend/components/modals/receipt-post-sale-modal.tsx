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
import { Printer, Download, SkipForward } from "lucide-react"

interface ReceiptPostSaleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total?: number
  onAutoPrint: () => void | Promise<void>
  onManualReceipt: () => void | Promise<void>
  onSkip?: () => void
}

export function ReceiptPostSaleModal({
  open,
  onOpenChange,
  total,
  onAutoPrint,
  onManualReceipt,
  onSkip,
}: ReceiptPostSaleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receipt Options</DialogTitle>
          <DialogDescription>
            Choose how you want to handle the receipt for this sale.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {typeof total === "number" && (
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-sm text-muted-foreground">Sale Total</p>
              <p className="text-2xl font-semibold">MWK {total.toFixed(2)}</p>
            </div>
          )}

          <Button className="w-full justify-start" onClick={() => void onAutoPrint()}>
            <Printer className="mr-2 h-4 w-4" />
            Auto Print Receipt
          </Button>

          <Button variant="outline" className="w-full justify-start" onClick={() => void onManualReceipt()}>
            <Download className="mr-2 h-4 w-4" />
            Manual Receipt
          </Button>

          <Button variant="ghost" className="w-full justify-start" onClick={() => onSkip?.()}>
            <SkipForward className="mr-2 h-4 w-4" />
            Skip Receipt
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
