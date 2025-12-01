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
import { AlertTriangle, ArrowUp } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ConfirmSubscriptionUpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConfirmSubscriptionUpgradeModal({ open, onOpenChange }: ConfirmSubscriptionUpgradeModalProps) {
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleUpgrade = async () => {
    setIsProcessing(true)

    // In production, this would process the upgrade
    setTimeout(() => {
      setIsProcessing(false)
      toast({
        title: "Subscription Upgraded",
        description: "Your subscription has been upgraded successfully.",
      })
      onOpenChange(false)
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUp className="h-5 w-5" />
            Confirm Subscription Upgrade
          </DialogTitle>
          <DialogDescription>
            Upgrade your subscription plan
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Upgrade Confirmation</AlertTitle>
            <AlertDescription>
              You are about to upgrade to the Enterprise plan. This will change your billing immediately.
            </AlertDescription>
          </Alert>

          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Current Plan:</span>
              <span className="font-medium">Professional - MWK 99/month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">New Plan:</span>
              <span className="font-medium">Enterprise - MWK 199/month</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm font-medium">Price Difference:</span>
              <span className="font-bold text-green-600">+MWK 100/month</span>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Your new plan will be activated immediately. You will be charged the prorated amount for the remaining billing period.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpgrade} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Confirm Upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

