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
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { outletService } from "@/lib/services/outletService"
import { useBusinessStore } from "@/stores/businessStore"
import type { OutletBusinessType } from "@/lib/types"
import { buildOutletSettings, normalizeOutletBusinessType } from "@/lib/utils/outlet-business-type"

const BUSINESS_TYPE_OPTIONS: { value: OutletBusinessType; label: string }[] = [
  { value: "wholesale_and_retail", label: "Wholesale and Retail" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar" },
]

interface AddEditOutletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  outlet?: any
  onOutletCreated?: () => void
}

export function AddEditOutletModal({ 
  open, 
  onOpenChange, 
  outlet,
  onOutletCreated 
}: AddEditOutletModalProps) {
  const { toast } = useToast()
  const { currentBusiness, loadOutlets } = useBusinessStore()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    businessType: normalizeOutletBusinessType(currentBusiness?.type) as OutletBusinessType,
    isActive: true,
  })

  // Reset form when modal opens/closes or outlet changes
  useEffect(() => {
    if (open) {
      if (outlet) {
        setFormData({
          name: outlet.name || "",
          address: outlet.address || "",
          phone: outlet.phone || "",
          businessType: normalizeOutletBusinessType(outlet.businessType),
          isActive: outlet.isActive !== undefined ? outlet.isActive : true,
        })
      } else {
        setFormData({
          name: "",
          address: "",
          phone: "",
          businessType: normalizeOutletBusinessType(currentBusiness?.type),
          isActive: true,
        })
      }
    }
  }, [open, outlet, currentBusiness?.type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Outlet name is required.",
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
      if (outlet) {
        // Update existing outlet
        await outletService.update(outlet.id, {
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          businessType: formData.businessType,
          settings: buildOutletSettings(currentBusiness?.settings, formData.businessType),
          isActive: formData.isActive,
        })
        toast({
          title: "Outlet Updated",
          description: "Outlet has been updated successfully.",
        })
      } else {
        // Create new outlet
        await outletService.create({
          businessId: currentBusiness.id,
          name: formData.name,
          address: formData.address,
          phone: formData.phone,
          businessType: formData.businessType,
          settings: buildOutletSettings(currentBusiness?.settings, formData.businessType),
          isActive: formData.isActive,
        })
        toast({
          title: "Outlet Created",
          description: "Outlet has been created successfully.",
        })
      }

      // Reload outlets list from business store
      if (currentBusiness?.id) {
        await loadOutlets(currentBusiness.id)
      }
      
      // Also refresh tenant context outlets to ensure UI updates
      // Dispatch event to trigger tenant context refresh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("outlets-updated", {
          detail: { outletId: outlet?.id }
        }))
      }

      // Call callback if provided
      if (onOutletCreated) {
        onOutletCreated()
      }

      onOpenChange(false)
    } catch (error: any) {
      console.error("Error saving outlet:", error)
      toast({
        title: outlet ? "Update Failed" : "Creation Failed",
        description: error?.message || `Failed to ${outlet ? "update" : "create"} outlet. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{outlet ? "Edit Outlet" : "Add New Outlet"}</DialogTitle>
          <DialogDescription>
            {outlet ? "Update outlet information" : "Create a new outlet location"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="outlet-name">Outlet Name *</Label>
              <Input 
                id="outlet-name" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter outlet name"
                required 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-type">Business Type *</Label>
              <Select
                value={formData.businessType}
                onValueChange={(value) =>
                  setFormData({ ...formData, businessType: value as OutletBusinessType })
                }
              >
                <SelectTrigger id="business-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input 
                id="address" 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input 
                id="phone" 
                type="tel" 
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.isActive ? "Active" : "Inactive"}
                onValueChange={(value) => setFormData({ ...formData, isActive: value === "Active" })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : outlet ? "Update Outlet" : "Create Outlet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

