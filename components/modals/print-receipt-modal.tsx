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
}

export function PrintReceiptModal({ open, onOpenChange, cart, total }: PrintReceiptModalProps) {
  const { toast } = useToast()

  const handlePrint = () => {
    // In production, this would trigger print dialog
    toast({
      title: "Printing Receipt",
      description: "Receipt is being sent to printer...",
    })
    setTimeout(() => {
      onOpenChange(false)
    }, 1000)
  }

  const handleDownload = () => {
    // In production, this would download PDF
    toast({
      title: "Downloading Receipt",
      description: "Receipt PDF is being generated...",
    })
    setTimeout(() => {
      onOpenChange(false)
    }, 1000)
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
            <p className="text-2xl font-bold">${total.toFixed(2)}</p>
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

