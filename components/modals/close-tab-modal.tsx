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
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreditCard, DollarSign, Check } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface CloseTabModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: any
}

export function CloseTabModal({ open, onOpenChange, tab }: CloseTabModalProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [amount, setAmount] = useState<string>("")

  if (!tab) return null

  // Mock tab items
  const tabItems = [
    { name: "Vodka Shot", quantity: 3, price: 8.00, total: 24.00 },
    { name: "Beer", quantity: 2, price: 5.00, total: 10.00 },
    { name: "Cocktail", quantity: 1, price: 12.00, total: 12.00 },
  ]

  const subtotal = tabItems.reduce((sum, item) => sum + item.total, 0)
  const tax = subtotal * 0.1
  const total = subtotal + tax
  const change = parseFloat(amount || "0") - total

  const handleCloseTab = async () => {
    if (!paymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method.",
        variant: "destructive",
      })
      return
    }

    if (paymentMethod === "cash" && (!amount || parseFloat(amount) < total)) {
      toast({
        title: "Insufficient Amount",
        description: "Please enter an amount greater than or equal to the total.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // In production, this would call API
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: "Tab Closed",
        description: `Tab ${tab.tabNumber} has been closed and payment processed.`,
      })
      setPaymentMethod("cash")
      setAmount("")
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Close Tab - {tab.tabNumber}
          </DialogTitle>
          <DialogDescription>
            Settle payment and close the tab
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-medium">{tab.customer}</p>
          </div>

          {/* Tab Items */}
          <div className="space-y-2">
            <Label>Tab Items</Label>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tabItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.price.toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">
                      ${item.total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax (10%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment */}
          <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cash">Cash</TabsTrigger>
              <TabsTrigger value="card">Card</TabsTrigger>
              <TabsTrigger value="tab">Keep Tab</TabsTrigger>
            </TabsList>

            <TabsContent value="cash" className="space-y-2 mt-4">
              <Label htmlFor="cash-amount">Amount Received *</Label>
              <Input
                id="cash-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount && parseFloat(amount) >= total && (
                <p className="text-sm font-medium text-green-600">
                  Change: ${change.toFixed(2)}
                </p>
              )}
            </TabsContent>

            <TabsContent value="card" className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Process card payment through your card reader
              </p>
            </TabsContent>

            <TabsContent value="tab" className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground">
                Keep the tab open for later payment
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCloseTab}
            disabled={isProcessing || (paymentMethod === "cash" && (!amount || parseFloat(amount) < total))}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? "Processing..." : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Close Tab
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

