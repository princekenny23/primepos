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
import { Switch } from "@/components/ui/switch"
import { CreditCard, Building2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { tillService, type Till } from "@/lib/services/tillService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"

interface AddEditTillModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  till?: Till | null
  onSuccess?: () => void
}

export function AddEditTillModal({ 
  open, 
  onOpenChange, 
  till,
  onSuccess 
}: AddEditTillModalProps) {
  const { toast } = useToast()
  const { outlets } = useTenant()
  const { currentBusiness } = useBusinessStore()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    outlet_id: "",
    is_active: true,
  })

  // Reset form when modal opens/closes or till changes
  useEffect(() => {
    if (open) {
      if (till) {
        // Edit mode
        const outletId = typeof till.outlet === 'object' 
          ? String(till.outlet.id) 
          : String(till.outlet)
        
        setFormData({
          name: till.name || "",
          outlet_id: outletId,
          is_active: till.is_active !== undefined ? till.is_active : true,
        })
      } else {
        // Add mode
        setFormData({
          name: "",
          outlet_id: "",
          is_active: true,
        })
      }
    }
  }, [open, till])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Till name is required.",
        variant: "destructive",
      })
      return
    }

    if (!formData.outlet_id) {
      toast({
        title: "Validation Error",
        description: "Please select an outlet.",
        variant: "destructive",
      })
      return
    }

    if (!currentBusiness) {
      toast({
        title: "Error",
        description: "No business selected. Please select a business first.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const tillData: Partial<Till> = {
        name: formData.name.trim(),
        outlet_id: parseInt(formData.outlet_id),
        tenant_id: String(currentBusiness.id),
        is_active: formData.is_active,
      }

      if (till) {
        // Update existing till
        await tillService.update(till.id, tillData)
        toast({
          title: "Till Updated",
          description: "Till has been updated successfully.",
        })
      } else {
        // Create new till
        await tillService.create(tillData)
        toast({
          title: "Till Created",
          description: "Till has been created successfully.",
        })
      }

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("Failed to save till:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save till.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {till ? "Edit Till" : "Add New Till"}
          </DialogTitle>
          <DialogDescription>
            {till 
              ? "Update till information" 
              : "Create a new cash register till for an outlet"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="outlet">Outlet *</Label>
              <Select
                value={formData.outlet_id}
                onValueChange={(value) => setFormData({ ...formData, outlet_id: value })}
                disabled={!!till} // Can't change outlet after creation
              >
                <SelectTrigger id="outlet">
                  <SelectValue placeholder="Select outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.filter(o => o.isActive).map(outlet => (
                    <SelectItem key={outlet.id} value={String(outlet.id)}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{outlet.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Till Name *</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  className="pl-10"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Till 1, Main Register, Counter 1"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="is_active" className="flex flex-col space-y-1">
                <span>Active</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Inactive tills cannot be used for shifts
                </span>
              </Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (till ? "Updating..." : "Creating...") : (till ? "Update Till" : "Create Till")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

