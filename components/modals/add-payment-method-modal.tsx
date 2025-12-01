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
import { CreditCard, Smartphone, DollarSign } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface AddPaymentMethodModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPaymentMethodModal({ open, onOpenChange }: AddPaymentMethodModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [methodType, setMethodType] = useState<string>("mobile")

  const handleAdd = async () => {
    setIsLoading(true)

    // In production, this would call API
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Payment Method Added",
        description: "Payment method has been added successfully.",
      })
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add a new payment method to your system
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={methodType} onValueChange={setMethodType}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mobile">
              <Smartphone className="h-4 w-4 mr-2" />
              Mobile
            </TabsTrigger>
            <TabsTrigger value="card">
              <CreditCard className="h-4 w-4 mr-2" />
              Card
            </TabsTrigger>
            <TabsTrigger value="custom">
              <DollarSign className="h-4 w-4 mr-2" />
              Custom
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mobile" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="mobile-provider">Mobile Money Provider</Label>
              <Input id="mobile-provider" placeholder="e.g., M-Pesa, Airtel Money" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-account">Account Number</Label>
              <Input id="mobile-account" placeholder="Enter account number" />
            </div>
          </TabsContent>

          <TabsContent value="card" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="card-processor">Card Processor</Label>
              <Input id="card-processor" placeholder="e.g., Stripe, Square" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-api-key">API Key</Label>
              <Input id="card-api-key" type="password" placeholder="Enter API key" />
            </div>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="custom-name">Method Name *</Label>
              <Input id="custom-name" placeholder="Enter payment method name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-description">Description</Label>
              <Input id="custom-description" placeholder="Optional description" />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isLoading}>
            {isLoading ? "Adding..." : "Add Payment Method"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

