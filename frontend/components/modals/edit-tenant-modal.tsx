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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Edit } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { adminService, type AdminTenant } from "@/lib/services/adminService"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EditTenantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: AdminTenant | null
  onUpdate?: () => void
}

export function EditTenantModal({ open, onOpenChange, tenant, onUpdate }: EditTenantModalProps) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("business")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    type: "wholesale and retail" as "wholesale and retail" | "restaurant" | "bar",
    address: "",
  })

  useEffect(() => {
    const loadTenantDetails = async () => {
      if (!tenant || !open) return

      setIsLoading(true)
      setActiveTab("business")
      try {
        // Fetch full tenant details to get address and other fields
        const fullTenant = await adminService.getTenant(tenant.id)
        setFormData({
          name: fullTenant.name || "",
          email: fullTenant.email || "",
          phone: fullTenant.phone || "",
          type: (fullTenant.type as "wholesale and retail" | "restaurant" | "bar") || "wholesale and retail",
          address: fullTenant.address || "",
        })
      } catch (error: any) {
        // Fallback to basic tenant data if fetch fails
        setFormData({
          name: tenant.name || "",
          email: tenant.email || "",
          phone: tenant.phone || "",
          type: (tenant.type as "wholesale and retail" | "restaurant" | "bar") || "wholesale and retail",
          address: "",
        })
        console.error("Failed to load tenant details:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTenantDetails()
  }, [tenant, open])

  const handleUpdate = async () => {
    if (!tenant) return

    if (!formData.name.trim() || !formData.email.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and email are required fields.",
        variant: "destructive",
      })
      return
    }

    setIsUpdating(true)

    try {
      await adminService.updateTenant(tenant.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        type: formData.type,
      })

      toast({
        title: "Tenant Updated",
        description: `${formData.name} has been updated successfully.`,
      })

      if (onUpdate) {
        onUpdate()
      }
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update tenant",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  if (!tenant) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Tenant
          </DialogTitle>
          <DialogDescription>
            Update the details for {tenant.name}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading tenant details...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full py-2">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="business">Business Info</TabsTrigger>
            </TabsList>

            <TabsContent value="business" className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="name">Business Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter business name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="business@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+265 123 456 789"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Business Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as "wholesale and retail" | "restaurant" | "bar" })}
                  required
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wholesale and retail">Wholesale and Retail</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="bar">Bar/Nightclub</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="Enter business address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === "business" && (
            <Button
              onClick={handleUpdate}
              disabled={isUpdating || isLoading || !formData.name.trim() || !formData.email.trim()}
            >
              {isUpdating ? "Updating..." : "Update Tenant"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

