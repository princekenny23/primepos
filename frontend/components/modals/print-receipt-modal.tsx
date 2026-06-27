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
import { Printer, Download } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { downloadReceiptForSale, printReceiptForSale } from "@/lib/utils/receipt-actions"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  discount: number
  total: number
}

interface PrintReceiptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartItem[]
  total: number
  saleId?: string
  receiptData?: {
    cart: Array<{ name: string; price: number; quantity: number; total: number; sku?: string }>
    subtotal: number
    discount: number
    tax: number
    total: number
    sale: any
  }
  outletId?: number | string
}

export function PrintReceiptModal({ open, onOpenChange, cart, total, saleId, receiptData, outletId }: PrintReceiptModalProps) {
  const { toast } = useToast()

  const handlePrint = async () => {
    try {
      if (receiptData) {
        await printReceiptForSale({ ...receiptData, outletId })
      }
      toast({
        title: "Receipt sent",
        description: "The receipt was sent to the configured printer.",
      })
    } catch (error: any) {
      toast({
        title: "Print failed",
        description: error?.message || "Unable to print receipt.",
        variant: "destructive",
      })
    } finally {
      onOpenChange(false)
    }
  }

  const handleDownload = async () => {
    if (!saleId) {
      toast({
        title: "Download unavailable",
        description: "Receipt download is not available for this sale yet.",
        variant: "destructive",
      })
      return
    }

    try {
      await downloadReceiptForSale(saleId)
      toast({
        title: "Receipt downloaded",
        description: "The receipt file has been downloaded.",
      })
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error?.message || "Unable to download receipt.",
        variant: "destructive",
      })
    } finally {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receipt Options</DialogTitle>
          <DialogDescription>
            Choose how you want to handle the receipt
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground">Sale Total</p>
            <p className="text-2xl font-bold">MWK {total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {cart.length} item{cart.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="space-y-2">
            <Button className="w-full" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
            <Button variant="outline" className="w-full" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Skip Receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

