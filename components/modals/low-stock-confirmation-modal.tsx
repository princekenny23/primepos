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
import { AlertTriangle } from "lucide-react"

interface LowStockConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productName: string
  currentStock: number
  minStock: number
  onConfirm?: () => void
}

export function LowStockConfirmationModal({ 
  open, 
  onOpenChange, 
  productName,
  currentStock,
  minStock,
  onConfirm
}: LowStockConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <DialogTitle>Low Stock Alert</DialogTitle>
          </div>
          <DialogDescription>
            This product is running low on inventory
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div>
            <p className="font-medium">{productName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Current stock: <span className="font-semibold text-orange-600">{currentStock}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Minimum required: <span className="font-semibold">{minStock}</span>
            </p>
          </div>

          <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              This product has fallen below the minimum stock level. Consider restocking soon to avoid stockouts.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
          <Button onClick={handleConfirm}>
            Create Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

