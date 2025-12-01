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
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shield } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"

interface AddRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: any
}

// Permission categories
const permissionCategories = [
  {
    category: "Sales",
    permissions: [
      { id: "sales.view", label: "View Sales" },
      { id: "sales.create", label: "Create Sales" },
      { id: "sales.edit", label: "Edit Sales" },
      { id: "sales.delete", label: "Delete Sales" },
      { id: "sales.refund", label: "Process Refunds" },
    ]
  },
  {
    category: "Inventory",
    permissions: [
      { id: "inventory.view", label: "View Inventory" },
      { id: "inventory.edit", label: "Edit Inventory" },
      { id: "inventory.adjust", label: "Stock Adjustments" },
      { id: "inventory.transfer", label: "Stock Transfers" },
      { id: "inventory.receive", label: "Receive Stock" },
    ]
  },
  {
    category: "Products",
    permissions: [
      { id: "products.view", label: "View Products" },
      { id: "products.create", label: "Create Products" },
      { id: "products.edit", label: "Edit Products" },
      { id: "products.delete", label: "Delete Products" },
    ]
  },
  {
    category: "Customers",
    permissions: [
      { id: "customers.view", label: "View Customers" },
      { id: "customers.create", label: "Create Customers" },
      { id: "customers.edit", label: "Edit Customers" },
      { id: "customers.delete", label: "Delete Customers" },
    ]
  },
  {
    category: "Reports",
    permissions: [
      { id: "reports.view", label: "View Reports" },
      { id: "reports.export", label: "Export Reports" },
      { id: "reports.financial", label: "Financial Reports" },
    ]
  },
  {
    category: "Staff",
    permissions: [
      { id: "staff.view", label: "View Staff" },
      { id: "staff.create", label: "Create Staff" },
      { id: "staff.edit", label: "Edit Staff" },
      { id: "staff.delete", label: "Delete Staff" },
    ]
  },
  {
    category: "Settings",
    permissions: [
      { id: "settings.view", label: "View Settings" },
      { id: "settings.edit", label: "Edit Settings" },
      { id: "settings.outlets", label: "Manage Outlets" },
    ]
  },
]

export function AddRoleModal({ open, onOpenChange, role }: AddRoleModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [roleName, setRoleName] = useState(role?.name || "")
  const [description, setDescription] = useState(role?.description || "")
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(role?.permissions || [])
  )

  const handlePermissionToggle = (permissionId: string) => {
    const newPermissions = new Set(selectedPermissions)
    if (newPermissions.has(permissionId)) {
      newPermissions.delete(permissionId)
    } else {
      newPermissions.add(permissionId)
    }
    setSelectedPermissions(newPermissions)
  }

  const handleCategoryToggle = (category: typeof permissionCategories[0]) => {
    const categoryPermissions = category.permissions.map(p => p.id)
    const allSelected = categoryPermissions.every(id => selectedPermissions.has(id))
    
    const newPermissions = new Set(selectedPermissions)
    if (allSelected) {
      categoryPermissions.forEach(id => newPermissions.delete(id))
    } else {
      categoryPermissions.forEach(id => newPermissions.add(id))
    }
    setSelectedPermissions(newPermissions)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!roleName.trim()) {
      toast({
        title: "Role Name Required",
        description: "Please enter a role name.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    // In production, this would call API
    setTimeout(() => {
      setIsLoading(false)
      toast({
        title: role ? "Role Updated" : "Role Created",
        description: `Role has been ${role ? "updated" : "created"} successfully.`,
      })
      setRoleName("")
      setDescription("")
      setSelectedPermissions(new Set())
      onOpenChange(false)
    }, 1000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {role ? "Edit Role" : "Add New Role"}
          </DialogTitle>
          <DialogDescription>
            {role ? "Update role information and permissions" : "Create a new role with custom permissions"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name *</Label>
                <Input
                  id="role-name"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this role"
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label>Permissions *</Label>
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-6">
                  {permissionCategories.map((category) => {
                    const categoryPermissions = category.permissions.map(p => p.id)
                    const allSelected = categoryPermissions.every(id => selectedPermissions.has(id))
                    const someSelected = categoryPermissions.some(id => selectedPermissions.has(id))

                    return (
                      <div key={category.category} className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${category.category}`}
                            checked={allSelected}
                            onCheckedChange={() => handleCategoryToggle(category)}
                          />
                          <Label
                            htmlFor={`category-${category.category}`}
                            className="font-semibold cursor-pointer"
                          >
                            {category.category}
                            {someSelected && !allSelected && (
                              <span className="ml-2 text-xs text-muted-foreground">(Partial)</span>
                            )}
                          </Label>
                        </div>
                        <div className="ml-6 space-y-2">
                          {category.permissions.map((permission) => (
                            <div key={permission.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={permission.id}
                                checked={selectedPermissions.has(permission.id)}
                                onCheckedChange={() => handlePermissionToggle(permission.id)}
                              />
                              <Label
                                htmlFor={permission.id}
                                className="text-sm cursor-pointer"
                              >
                                {permission.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">
                {selectedPermissions.size} permission{selectedPermissions.size !== 1 ? "s" : ""} selected
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || selectedPermissions.size === 0}>
              {isLoading ? "Saving..." : role ? "Update Role" : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

