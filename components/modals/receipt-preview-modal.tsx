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
import { Printer, Download, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  discount: number
  total: number
}

interface ReceiptPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: CartItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  onPrint: () => void
  onSkip: () => void
}

export function ReceiptPreviewModal({
  open,
  onOpenChange,
  cart,
  subtotal,
  discount,
  tax,
  total,
  onPrint,
  onSkip,
}: ReceiptPreviewModalProps) {
  const { toast } = useToast()

  const handlePrint = () => {
    toast({
      title: "Printing Receipt",
      description: "Receipt is being sent to printer...",
    })
    onPrint()
  }

  const handleDownload = () => {
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt Preview</DialogTitle>
          <DialogDescription>
            Review the receipt before printing
          </DialogDescription>
        </DialogHeader>

        {/* Receipt Preview */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
          {/* Receipt Header */}
          <div className="text-center mb-4 pb-4 border-b border-dashed">
            <h2 className="text-xl font-bold">PRIMEPOS</h2>
            <p className="text-xs text-muted-foreground mt-1">
              123 Business Street, City, State 12345
            </p>
            <p className="text-xs text-muted-foreground">
              Phone: +1 (555) 123-4567
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(), "MMM dd, yyyy 'at' hh:mm a")}
            </p>
          </div>

          {/* Receipt Items */}
          <div className="space-y-2 mb-4">
            {cart.map((item) => (
              <div key={item.id} className="text-sm">
                <div className="flex justify-between items-start mb-1">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} x MWK {item.price.toFixed(2)}
                      {item.discount > 0 && (
                        <span className="text-green-600 ml-1">
                          (-MWK {item.discount.toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="font-medium ml-2">MWK {item.total.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Receipt Totals */}
          <div className="border-t border-dashed pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>MWK {subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount:</span>
                <span className="text-green-600">-MWK {discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax:</span>
              <span>MWK {tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-dashed">
              <span>Total:</span>
              <span>MWK {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Receipt Footer */}
          <div className="text-center mt-4 pt-4 border-t border-dashed">
            <p className="text-xs text-muted-foreground">
              Thank you for your business!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Receipt #: {Date.now().toString().slice(-8)}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDownload} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={onSkip} className="w-full sm:w-auto">
            <X className="mr-2 h-4 w-4" />
            Skip Receipt
          </Button>
          <Button onClick={handlePrint} className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


