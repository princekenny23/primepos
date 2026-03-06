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
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { useTenant } from "@/contexts/tenant-context"
import { inventoryService } from "@/lib/services/inventoryService"
import { ClipboardCheck } from "lucide-react"
import { useBusinessStore } from "@/stores/businessStore"

interface StartStockTakeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StartStockTakeModal({ open, onOpenChange }: StartStockTakeModalProps) {
  const { toast } = useToast()
  const router = useRouter()
  const { outlets } = useTenant()
  const { currentBusiness } = useBusinessStore()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    outletId: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.outletId) {
      toast({
        title: "Validation Error",
        description: "Please select an outlet",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await inventoryService.createStockTake({
        outlet: formData.outletId,
        operating_date: formData.date,
        description: formData.description || "",
        tenant: currentBusiness?.id ? String(currentBusiness.id) : undefined,
      })
      
      toast({
        title: "Stock Take Started",
        description: "Stock take has been created successfully.",
      })
      
      onOpenChange(false)
      
      // Navigate to the specific stock taking page
      router.push(`/dashboard/inventory/stock-taking/${response.id}`)
    } catch (error: any) {
      console.error("Failed to create stock take:", error)
      toast({
        title: "Failed to Start Stock Take",
        description: error.message || "Failed to create stock take. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Start New Stock Take
          </DialogTitle>
          <DialogDescription>
            Create a new stock taking session for inventory audit
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="outlet">Select Outlet *</Label>
              <Select
                value={formData.outletId}
                onValueChange={(value) => setFormData({ ...formData, outletId: value })}
                required
              >
                <SelectTrigger id="outlet">
                  <SelectValue placeholder="Select an outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets
                    .filter((outlet) => outlet.isActive)
                    .map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Enter description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Starting..." : "Start Stock Take"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

