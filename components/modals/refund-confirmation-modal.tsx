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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DollarSign, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface RefundConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  returnItem: any
}

export function RefundConfirmationModal({ open, onOpenChange, returnItem }: RefundConfirmationModalProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)
  const [refundMethod, setRefundMethod] = useState<string>("")

  if (!returnItem) return null

  const handleRefund = async () => {
    if (!refundMethod) {
      toast({
        title: "Refund Method Required",
        description: "Please select a refund method.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    // In production, this would call API
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: "Refund Processed",
        description: `Refund of $${returnItem.amount.toFixed(2)} has been processed via ${refundMethod}.`,
      })
      setRefundMethod("")
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Confirm Refund
          </DialogTitle>
          <DialogDescription>
            Process refund for return {returnItem.returnId}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Refund Confirmation</AlertTitle>
            <AlertDescription>
              You are about to process a refund. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Return ID:</span>
              <span className="font-medium">{returnItem.returnId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Sale ID:</span>
              <span className="font-medium">{returnItem.saleId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Customer:</span>
              <span className="font-medium">{returnItem.customer}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm font-medium">Refund Amount:</span>
              <span className="font-bold text-lg">${returnItem.amount.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-method">Refund Method *</Label>
            <Select value={refundMethod} onValueChange={setRefundMethod} required>
              <SelectTrigger id="refund-method">
                <SelectValue placeholder="Select refund method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Original Card</SelectItem>
                <SelectItem value="store-credit">Store Credit</SelectItem>
                <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              The refund will be processed immediately. The customer will receive confirmation via email.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            disabled={isProcessing || !refundMethod}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? "Processing..." : "Confirm Refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

