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
import { Switch } from "@/components/ui/switch"
import { Shield, FileText, Truck } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { roleService, type Role } from "@/lib/services/staffService"
import { useBusinessStore } from "@/stores/businessStore"

interface AddEditRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: Role | null
  onSuccess?: () => void
}

export function AddEditRoleModal({ open, onOpenChange, role, onSuccess }: AddEditRoleModalProps) {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    can_sales: false,
    can_inventory: false,
    can_products: false,
    can_customers: false,
    can_reports: false,
    can_staff: false,
    can_settings: false,
    can_dashboard: true,
    can_distribution: false,
    can_storefront: false,
    can_pos_retail: true,
    can_pos_restaurant: true,
    can_pos_bar: true,
    can_switch_outlet: true,
    is_active: true,
  })

  useEffect(() => {
    if (open) {
      if (role) {
        // Edit mode
        setFormData({
          name: role.name || "",
          description: role.description || "",
          can_sales: role.can_sales || false,
          can_inventory: role.can_inventory || false,
          can_products: role.can_products || false,
          can_customers: role.can_customers || false,
          can_reports: role.can_reports || false,
          can_staff: role.can_staff || false,
          can_settings: role.can_settings || false,
          can_dashboard: role.can_dashboard !== undefined ? role.can_dashboard : true,
          can_distribution: role.can_distribution || false,
          can_storefront: role.can_storefront || false,
          can_pos_retail: role.can_pos_retail !== undefined ? role.can_pos_retail : true,
          can_pos_restaurant: role.can_pos_restaurant !== undefined ? role.can_pos_restaurant : true,
          can_pos_bar: role.can_pos_bar !== undefined ? role.can_pos_bar : true,
          can_switch_outlet: role.can_switch_outlet !== undefined ? role.can_switch_outlet : true,
          is_active: role.is_active !== undefined ? role.is_active : true,
        })
      } else {
        // Add mode
        setFormData({
          name: "",
          description: "",
          can_sales: false,
          can_inventory: false,
          can_products: false,
          can_customers: false,
          can_reports: false,
          can_staff: false,
          can_settings: false,
          can_dashboard: true,
          can_distribution: false,
          can_storefront: false,
          can_pos_retail: true,
          can_pos_restaurant: true,
          can_pos_bar: true,
          can_switch_outlet: true,
          is_active: true,
        })
      }
    }
  }, [open, role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentBusiness) {
      toast({
        title: "Error",
        description: "No business selected.",
        variant: "destructive",
      })
      return
    }

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Role name is required.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const roleData: Partial<Role> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        can_sales: formData.can_sales,
        can_inventory: formData.can_inventory,
        can_products: formData.can_products,
        can_customers: formData.can_customers,
        can_reports: formData.can_reports,
        can_staff: formData.can_staff,
        can_settings: formData.can_settings,
        can_dashboard: formData.can_dashboard,
        can_distribution: formData.can_distribution,
        can_storefront: formData.can_storefront,
        can_pos_retail: formData.can_pos_retail,
        can_pos_restaurant: formData.can_pos_restaurant,
        can_pos_bar: formData.can_pos_bar,
        can_switch_outlet: formData.can_switch_outlet,
        is_active: formData.is_active,
      }

      if (role) {
        // Update existing role
        await roleService.update(role.id, roleData)
        toast({
          title: "Role Updated",
          description: "Role has been updated successfully.",
        })
      } else {
        // Create new role
        await roleService.create(roleData)
        toast({
          title: "Role Created",
          description: "Role has been created successfully.",
        })
      }

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error("Failed to save role:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save role.",
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
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {role ? "Edit Role" : "Create New Role"}
          </DialogTitle>
          <DialogDescription>
            {role ? "Update role permissions and settings" : "Create a new role with specific permissions"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Role Name *</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  className="pl-10"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., Manager, Cashier, Supervisor"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="description"
                  className="pl-10 min-h-[80px]"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the role and its responsibilities"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-4 block">Permissions</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_dashboard" className="flex flex-col space-y-1">
                    <span>Dashboard Access</span>
                    <span className="font-normal text-xs text-muted-foreground">View dashboard and analytics</span>
                  </Label>
                  <Switch
                    id="can_dashboard"
                    checked={formData.can_dashboard}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_dashboard: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_sales" className="flex flex-col space-y-1">
                    <span>Sales</span>
                    <span className="font-normal text-xs text-muted-foreground">Process sales and transactions</span>
                  </Label>
                  <Switch
                    id="can_sales"
                    checked={formData.can_sales}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_sales: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_products" className="flex flex-col space-y-1">
                    <span>Products</span>
                    <span className="font-normal text-xs text-muted-foreground">Manage products and categories</span>
                  </Label>
                  <Switch
                    id="can_products"
                    checked={formData.can_products}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_products: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_inventory" className="flex flex-col space-y-1">
                    <span>Inventory</span>
                    <span className="font-normal text-xs text-muted-foreground">Manage stock and inventory</span>
                  </Label>
                  <Switch
                    id="can_inventory"
                    checked={formData.can_inventory}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_inventory: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_customers" className="flex flex-col space-y-1">
                    <span>Customers</span>
                    <span className="font-normal text-xs text-muted-foreground">Manage customer relationships</span>
                  </Label>
                  <Switch
                    id="can_customers"
                    checked={formData.can_customers}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_customers: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_reports" className="flex flex-col space-y-1">
                    <span>Reports</span>
                    <span className="font-normal text-xs text-muted-foreground">View and generate reports</span>
                  </Label>
                  <Switch
                    id="can_reports"
                    checked={formData.can_reports}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_reports: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_staff" className="flex flex-col space-y-1">
                    <span>Staff Management</span>
                    <span className="font-normal text-xs text-muted-foreground">Manage staff and roles</span>
                  </Label>
                  <Switch
                    id="can_staff"
                    checked={formData.can_staff}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_staff: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_settings" className="flex flex-col space-y-1">
                    <span>Settings</span>
                    <span className="font-normal text-xs text-muted-foreground">Access system settings</span>
                  </Label>
                  <Switch
                    id="can_settings"
                    checked={formData.can_settings}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_settings: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_distribution" className="flex flex-col space-y-1">
                    <span>Distribution</span>
                    <span className="font-normal text-xs text-muted-foreground">Manage deliveries, routes and fleet</span>
                  </Label>
                  <Switch
                    id="can_distribution"
                    checked={formData.can_distribution}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_distribution: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_pos_retail" className="flex flex-col space-y-1">
                    <span>Retail POS</span>
                    <span className="font-normal text-xs text-muted-foreground">Access retail-specific POS screens</span>
                  </Label>
                  <Switch
                    id="can_pos_retail"
                    checked={formData.can_pos_retail}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_pos_retail: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_pos_restaurant" className="flex flex-col space-y-1">
                    <span>Restaurant POS</span>
                    <span className="font-normal text-xs text-muted-foreground">Access restaurant-specific POS screens</span>
                  </Label>
                  <Switch
                    id="can_pos_restaurant"
                    checked={formData.can_pos_restaurant}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_pos_restaurant: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_pos_bar" className="flex flex-col space-y-1">
                    <span>Bar POS</span>
                    <span className="font-normal text-xs text-muted-foreground">Access bar-specific POS screens</span>
                  </Label>
                  <Switch
                    id="can_pos_bar"
                    checked={formData.can_pos_bar}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_pos_bar: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_storefront" className="flex flex-col space-y-1">
                    <span>Storefront</span>
                    <span className="font-normal text-xs text-muted-foreground">View and manage storefront features</span>
                  </Label>
                  <Switch
                    id="can_storefront"
                    checked={formData.can_storefront}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_storefront: checked })}
                  />
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="can_switch_outlet" className="flex flex-col space-y-1">
                    <span>Switch Outlet</span>
                    <span className="font-normal text-xs text-muted-foreground">Allow switching active outlet</span>
                  </Label>
                  <Switch
                    id="can_switch_outlet"
                    checked={formData.can_switch_outlet}
                    onCheckedChange={(checked) => setFormData({ ...formData, can_switch_outlet: checked })}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2 border-t pt-4">
              <Label htmlFor="is_active" className="flex flex-col space-y-1">
                <span>Active Status</span>
                <span className="font-normal text-xs text-muted-foreground">Enable or disable this role</span>
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
              {isLoading ? (role ? "Updating..." : "Creating...") : (role ? "Update Role" : "Create Role")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

