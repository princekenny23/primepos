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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowRightLeft } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface TransferStockModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransferStockModal({ open, onOpenChange }: TransferStockModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // In production, this would call API
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: "Transfer Initiated",
        description: "Stock transfer has been initiated successfully.",
      })
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Stock
          </DialogTitle>
          <DialogDescription>
            Transfer inventory from one outlet to another
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product">Product *</Label>
              <Select required>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Product A</SelectItem>
                  <SelectItem value="2">Product B</SelectItem>
                  <SelectItem value="3">Product C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="from">From Outlet *</Label>
              <Select required>
                <SelectTrigger id="from">
                  <SelectValue placeholder="Select source outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlet-1">Downtown Branch</SelectItem>
                  <SelectItem value="outlet-2">Mall Location</SelectItem>
                  <SelectItem value="outlet-3">Airport Kiosk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="to">To Outlet *</Label>
              <Select required>
                <SelectTrigger id="to">
                  <SelectValue placeholder="Select destination outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outlet-1">Downtown Branch</SelectItem>
                  <SelectItem value="outlet-2">Mall Location</SelectItem>
                  <SelectItem value="outlet-3">Airport Kiosk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input 
                id="quantity" 
                type="number" 
                min="1"
                required
                placeholder="Enter quantity to transfer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Optional notes about this transfer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Processing..." : "Initiate Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

