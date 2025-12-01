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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DollarSign, CreditCard, Smartphone, Split } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  onComplete: () => void
}

export function PaymentModal({ open, onOpenChange, total, onComplete }: PaymentModalProps) {
  const { toast } = useToast()
  const [paymentMethod, setPaymentMethod] = useState<string>("cash")
  const [amount, setAmount] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)

  const handlePayment = async () => {
    setIsProcessing(true)

    // In production, this would process payment
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: "Payment Successful",
        description: `Payment of MWK ${total.toFixed(2)} processed successfully.`,
      })
      onComplete()
    }, 1500)
  }

  const change = parseFloat(amount) - total

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Process Payment</DialogTitle>
          <DialogDescription>
            Select payment method and complete transaction
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-3xl font-bold">MWK {total.toFixed(2)}</p>
          </div>

          <Tabs value={paymentMethod} onValueChange={setPaymentMethod}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="cash">
                <DollarSign className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="card">
                <CreditCard className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="mobile">
                <Smartphone className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="split">
                <Split className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cash" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="cash-amount">Amount Received</Label>
                <Input
                  id="cash-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {amount && parseFloat(amount) >= total && (
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Change: MWK {change.toFixed(2)}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="card" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Card Payment</Label>
                <p className="text-sm text-muted-foreground">
                  Process card payment through your card reader
                </p>
              </div>
            </TabsContent>

            <TabsContent value="mobile" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Mobile Money</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mobile money provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="momo">Mobile Money</SelectItem>
                    <SelectItem value="airtel">Airtel Money</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="split" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Split Payment</Label>
                <p className="text-sm text-muted-foreground">
                  Split payment across multiple methods
                </p>
                <div className="space-y-2">
                  <Input placeholder="Cash amount" type="number" />
                  <Input placeholder="Card amount" type="number" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            disabled={
              isProcessing ||
              (paymentMethod === "cash" && (!amount || parseFloat(amount) < total))
            }
          >
            {isProcessing ? "Processing..." : "Complete Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

