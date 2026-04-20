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
import { Shield, FileText } from "lucide-react"
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

const LEGACY_FLAG_BY_CODE: Record<string, keyof Role> = {
  "dashboard.view": "can_dashboard",
  "sales.view": "can_sales",
  "sales.create": "can_sales",
  "inventory.view": "can_inventory",
  "inventory.manage": "can_inventory",
  "products.manage": "can_products",
  "customers.manage": "can_customers",
  "reports.view": "can_reports",
  "staff.manage": "can_staff",
  "settings.manage": "can_settings",
  "distribution.manage": "can_distribution",
  "storefront.manage": "can_storefront",
  "pos.retail": "can_pos_retail",
  "pos.restaurant": "can_pos_restaurant",
  "pos.bar": "can_pos_bar",
  "outlet.switch": "can_switch_outlet",
  "users.create": "can_staff",
  "users.update": "can_staff",
  "users.delete": "can_staff",
  "roles.assign": "can_staff",
  "roles.manage": "can_settings",
}

const PERMISSION_GROUPS = [
  {
    title: "Core",
    items: [
      { code: "dashboard.view", label: "Dashboard", description: "View dashboard and high-level metrics" },
      { code: "reports.view", label: "Reports", description: "View business and operational reports" },
    ],
  },
  {
    title: "Sales & POS",
    items: [
      { code: "sales.view", label: "Sales View", description: "View sales records and transactions" },
      { code: "sales.create", label: "Sales Create", description: "Create and process sales" },
      { code: "customers.manage", label: "Customers", description: "Manage customer profiles and balances" },
      { code: "pos.retail", label: "Retail POS", description: "Access retail POS interface" },
      { code: "pos.restaurant", label: "Restaurant POS", description: "Access restaurant POS interface" },
      { code: "pos.bar", label: "Bar POS", description: "Access bar POS interface" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { code: "inventory.view", label: "Inventory View", description: "View stock and movements" },
      { code: "inventory.manage", label: "Inventory Manage", description: "Adjust and transfer inventory" },
      { code: "products.manage", label: "Products", description: "Manage product catalog" },
    ],
  },
  {
    title: "Office & Admin",
    items: [
      { code: "staff.manage", label: "Staff", description: "Manage staff assignments" },
      { code: "users.create", label: "Users Create", description: "Create office user accounts" },
      { code: "users.update", label: "Users Update", description: "Edit office user accounts" },
      { code: "users.delete", label: "Users Delete", description: "Delete office user accounts" },
      { code: "roles.assign", label: "Role Assign", description: "Assign roles to users and staff" },
      { code: "roles.manage", label: "Role Manage", description: "Create and edit role definitions" },
      { code: "settings.manage", label: "Settings", description: "Access system settings" },
      { code: "outlet.switch", label: "Switch Outlet", description: "Switch between outlets" },
    ],
  },
  {
    title: "Extensions",
    items: [
      { code: "distribution.manage", label: "Distribution", description: "Manage delivery routes and dispatch" },
      { code: "storefront.manage", label: "Storefront", description: "Manage storefront features" },
    ],
  },
]

const derivePermissionCodesFromLegacyRole = (role?: Role | null): string[] => {
  if (!role) return []

  const codes = new Set<string>()
  Object.entries(LEGACY_FLAG_BY_CODE).forEach(([code, legacyFlag]) => {
    if ((role as any)[legacyFlag]) {
      codes.add(code)
    }
  })
  return Array.from(codes)
}

export function AddEditRoleModal({ open, onOpenChange, role, onSuccess }: AddEditRoleModalProps) {
  const { toast } = useToast()
  const { currentBusiness } = useBusinessStore()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permission_codes: [] as string[],
    is_active: true,
  })

  useEffect(() => {
    if (open) {
      if (role) {
        // Edit mode
        setFormData({
          name: role.name || "",
          description: role.description || "",
          permission_codes: role.effective_permission_codes && role.effective_permission_codes.length
            ? [...role.effective_permission_codes]
            : derivePermissionCodesFromLegacyRole(role),
          is_active: role.is_active !== undefined ? role.is_active : true,
        })
      } else {
        // Add mode
        setFormData({
          name: "",
          description: "",
          permission_codes: ["dashboard.view"],
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
      const selectedCodes = new Set(formData.permission_codes)
      const legacyBooleans = {
        can_sales: false,
        can_inventory: false,
        can_products: false,
        can_customers: false,
        can_reports: false,
        can_staff: false,
        can_settings: false,
        can_dashboard: false,
        can_distribution: false,
        can_storefront: false,
        can_pos_retail: false,
        can_pos_restaurant: false,
        can_pos_bar: false,
        can_switch_outlet: false,
      }

      Object.entries(LEGACY_FLAG_BY_CODE).forEach(([code, legacyFlag]) => {
        if (selectedCodes.has(code) && legacyFlag in legacyBooleans) {
          ;(legacyBooleans as any)[legacyFlag] = true
        }
      })

      const roleData: Partial<Role> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        permission_codes: Array.from(selectedCodes),
        ...legacyBooleans,
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
              <div className="space-y-6">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">{group.title}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {group.items.map((permission) => {
                        const checked = formData.permission_codes.includes(permission.code)
                        return (
                          <div key={permission.code} className="flex items-center justify-between space-x-2 rounded-md border p-3">
                            <Label htmlFor={`perm-${permission.code}`} className="flex flex-col space-y-1">
                              <span>{permission.label}</span>
                              <span className="font-normal text-xs text-muted-foreground">{permission.description}</span>
                            </Label>
                            <Switch
                              id={`perm-${permission.code}`}
                              checked={checked}
                              onCheckedChange={(isChecked) => {
                                setFormData((prev) => {
                                  const nextCodes = new Set(prev.permission_codes)
                                  if (isChecked) {
                                    nextCodes.add(permission.code)
                                  } else {
                                    nextCodes.delete(permission.code)
                                  }
                                  return {
                                    ...prev,
                                    permission_codes: Array.from(nextCodes),
                                  }
                                })
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
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

