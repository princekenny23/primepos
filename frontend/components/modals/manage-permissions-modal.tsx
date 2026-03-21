"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, ShoppingCart, Home, Package, Settings, DollarSign, AlertCircle, Truck } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { adminService } from "@/lib/services/adminService"

interface TenantPermissions {
  has_distribution: boolean

  // Apps
  allow_sales: boolean
  allow_pos: boolean
  allow_inventory: boolean
  allow_office: boolean
  allow_settings: boolean

  // Sales Features
  allow_sales_create: boolean
  allow_sales_refund: boolean
  allow_sales_reports: boolean

  // POS Features
  allow_pos_restaurant: boolean
  allow_pos_bar: boolean
  allow_pos_retail: boolean
  allow_pos_discounts: boolean

  // Inventory Features
  allow_inventory_products: boolean
  allow_inventory_stock_take: boolean
  allow_inventory_transfers: boolean
  allow_inventory_adjustments: boolean
  allow_inventory_suppliers: boolean

  // Office Features
  allow_office_accounting: boolean
  allow_office_hr: boolean
  allow_office_users: boolean
  allow_office_staff: boolean
  allow_office_shift_management: boolean
  allow_office_reports: boolean
  allow_office_analytics: boolean

  // Settings Features
  allow_settings_users: boolean
  allow_settings_outlets: boolean
  allow_settings_integrations: boolean
  allow_settings_advanced: boolean
}

interface ManagePermissionsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenant: {
    id: string
    name: string
  }
}

export function ManagePermissionsModal({
  open,
  onOpenChange,
  tenant,
}: ManagePermissionsModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [permissions, setPermissions] = useState<TenantPermissions>({
    has_distribution: false,

    // Apps - default all enabled
    allow_sales: true,
    allow_pos: true,
    allow_inventory: true,
    allow_office: true,
    allow_settings: true,

    // Sales Features
    allow_sales_create: true,
    allow_sales_refund: true,
    allow_sales_reports: true,

    // POS Features
    allow_pos_restaurant: true,
    allow_pos_bar: true,
    allow_pos_retail: true,
    allow_pos_discounts: true,

    // Inventory Features
    allow_inventory_products: true,
    allow_inventory_stock_take: true,
    allow_inventory_transfers: true,
    allow_inventory_adjustments: true,
    allow_inventory_suppliers: true,

    // Office Features
    allow_office_accounting: true,
    allow_office_hr: true,
    allow_office_users: true,
    allow_office_staff: true,
    allow_office_shift_management: true,
    allow_office_reports: true,
    allow_office_analytics: true,

    // Settings Features
    allow_settings_users: true,
    allow_settings_outlets: true,
    allow_settings_integrations: true,
    allow_settings_advanced: true,
  })

  useEffect(() => {
    if (open && tenant) {
      loadPermissions()
    }
  }, [open, tenant])

  const loadPermissions = async () => {
    setIsLoading(true)
    try {
      const data = await adminService.getTenantPermissions(tenant.id)
      if (data) {
        // Keep users and staff managed together in the UI.
        const usersAndStaffEnabled = (data.allow_office_users !== false) || (data.allow_office_staff !== false)
        setPermissions({
          ...data,
          allow_office_users: usersAndStaffEnabled,
          allow_office_staff: usersAndStaffEnabled,
        })
      }
    } catch (error: any) {
      console.error("Failed to load permissions:", error)
      toast({
        title: "Error",
        description: "Failed to load permissions. Using defaults.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = (key: keyof TenantPermissions, value: boolean) => {
    setPermissions(prev => {
      if (key === 'allow_office_users') {
        return {
          ...prev,
          allow_office_users: value,
          allow_office_staff: value,
        }
      }

      return {
        ...prev,
        [key]: value
      }
    })

    // Auto-disable child features when parent app is disabled
    if (!value) {
      if (key === 'allow_sales') {
        setPermissions(prev => ({
          ...prev,
          allow_sales_create: false,
          allow_sales_refund: false,
          allow_sales_reports: false,
        }))
      } else if (key === 'allow_pos') {
        setPermissions(prev => ({
          ...prev,
          allow_pos_restaurant: false,
          allow_pos_bar: false,
          allow_pos_retail: false,
          allow_pos_discounts: false,
        }))
      } else if (key === 'allow_inventory') {
        setPermissions(prev => ({
          ...prev,
          allow_inventory_products: false,
          allow_inventory_stock_take: false,
          allow_inventory_transfers: false,
          allow_inventory_adjustments: false,
          allow_inventory_suppliers: false,
        }))
      } else if (key === 'allow_office') {
        setPermissions(prev => ({
          ...prev,
          allow_office_accounting: false,
          allow_office_hr: false,
          allow_office_users: false,
          allow_office_staff: false,
          allow_office_shift_management: false,
          allow_office_reports: false,
          allow_office_analytics: false,
        }))
      } else if (key === 'allow_settings') {
        setPermissions(prev => ({
          ...prev,
          allow_settings_users: false,
          allow_settings_outlets: false,
          allow_settings_integrations: false,
          allow_settings_advanced: false,
        }))
      }
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await adminService.updateTenantPermissions(tenant.id, permissions)
      toast({
        title: "Success",
        description: "Permissions updated successfully",
      })
      onOpenChange(false)
    } catch (error: any) {
      console.error("Failed to save permissions:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save permissions",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const PermissionSwitch = ({ 
    id, 
    label, 
    checked, 
    onChange, 
    disabled = false,
    description 
  }: { 
    id: string
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    description?: string
  }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="space-y-0.5">
        <Label htmlFor={id} className={disabled ? "text-muted-foreground" : ""}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled || isSaving}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Permissions - {tenant?.name}</DialogTitle>
          <DialogDescription>
            Control which apps and features this tenant can access
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="apps" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="apps">Apps</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
            </TabsList>

            <TabsContent value="apps" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-lg">Sales</CardTitle>
                      <CardDescription>Core sales management</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PermissionSwitch
                    id="allow_sales"
                    label="Enable Sales App"
                    checked={permissions.allow_sales}
                    onChange={(checked) => handleToggle('allow_sales', checked)}
                    description="Master switch for all sales functionality"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-lg">Point of Sale</CardTitle>
                      <CardDescription>POS terminals and transactions</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PermissionSwitch
                    id="allow_pos"
                    label="Enable POS App"
                    checked={permissions.allow_pos}
                    onChange={(checked) => handleToggle('allow_pos', checked)}
                    description="Master switch for all POS functionality"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-lg">Inventory</CardTitle>
                      <CardDescription>Stock and product management</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PermissionSwitch
                    id="allow_inventory"
                    label="Enable Inventory App"
                    checked={permissions.allow_inventory}
                    onChange={(checked) => handleToggle('allow_inventory', checked)}
                    description="Master switch for all inventory functionality"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-lg">Office</CardTitle>
                      <CardDescription>Back office operations</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PermissionSwitch
                    id="allow_office"
                    label="Enable Office App"
                    checked={permissions.allow_office}
                    onChange={(checked) => handleToggle('allow_office', checked)}
                    description="Master switch for accounting, HR, and reporting"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-lg">Settings</CardTitle>
                      <CardDescription>System configuration</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PermissionSwitch
                    id="allow_settings"
                    label="Enable Settings App"
                    checked={permissions.allow_settings}
                    onChange={(checked) => handleToggle('allow_settings', checked)}
                    description="Master switch for system settings"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    <div>
                      <CardTitle className="text-lg">Distribution</CardTitle>
                      <CardDescription>Fleet and delivery workflows</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <PermissionSwitch
                    id="has_distribution"
                    label="Enable Distribution Module"
                    checked={permissions.has_distribution}
                    onChange={(checked) => handleToggle('has_distribution', checked)}
                    description="Shows distribution menu and enables delivery operations"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="space-y-4 mt-4">
              {!permissions.allow_sales && !permissions.allow_pos && !permissions.allow_inventory && !permissions.allow_office && !permissions.allow_settings && !permissions.has_distribution && (
                <Card className="border-amber-500">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                      <p className="text-sm">Enable at least one app to manage features</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sales Features */}
              {permissions.allow_sales && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Sales Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <PermissionSwitch
                      id="allow_sales_create"
                      label="Create Sales"
                      checked={permissions.allow_sales_create}
                      onChange={(checked) => handleToggle('allow_sales_create', checked)}
                      disabled={!permissions.allow_sales}
                    />
                    <PermissionSwitch
                      id="allow_sales_refund"
                      label="Process Refunds"
                      checked={permissions.allow_sales_refund}
                      onChange={(checked) => handleToggle('allow_sales_refund', checked)}
                      disabled={!permissions.allow_sales}
                    />
                    <PermissionSwitch
                      id="allow_sales_reports"
                      label="View Sales Reports"
                      checked={permissions.allow_sales_reports}
                      onChange={(checked) => handleToggle('allow_sales_reports', checked)}
                      disabled={!permissions.allow_sales}
                    />
                  </CardContent>
                </Card>
              )}

              {/* POS Features */}
              {permissions.allow_pos && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">POS Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <PermissionSwitch
                      id="allow_pos_restaurant"
                      label="Restaurant POS"
                      checked={permissions.allow_pos_restaurant}
                      onChange={(checked) => handleToggle('allow_pos_restaurant', checked)}
                      disabled={!permissions.allow_pos}
                    />
                    <PermissionSwitch
                      id="allow_pos_bar"
                      label="Bar POS"
                      checked={permissions.allow_pos_bar}
                      onChange={(checked) => handleToggle('allow_pos_bar', checked)}
                      disabled={!permissions.allow_pos}
                    />
                    <PermissionSwitch
                      id="allow_pos_retail"
                      label="Retail POS"
                      checked={permissions.allow_pos_retail}
                      onChange={(checked) => handleToggle('allow_pos_retail', checked)}
                      disabled={!permissions.allow_pos}
                    />
                    <PermissionSwitch
                      id="allow_pos_discounts"
                      label="Apply Discounts"
                      checked={permissions.allow_pos_discounts}
                      onChange={(checked) => handleToggle('allow_pos_discounts', checked)}
                      disabled={!permissions.allow_pos}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Inventory Features */}
              {permissions.allow_inventory && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Inventory Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <PermissionSwitch
                      id="allow_inventory_products"
                      label="Manage Products"
                      checked={permissions.allow_inventory_products}
                      onChange={(checked) => handleToggle('allow_inventory_products', checked)}
                      disabled={!permissions.allow_inventory}
                    />
                    <PermissionSwitch
                      id="allow_inventory_stock_take"
                      label="Stock Take"
                      checked={permissions.allow_inventory_stock_take}
                      onChange={(checked) => handleToggle('allow_inventory_stock_take', checked)}
                      disabled={!permissions.allow_inventory}
                      description="Physical inventory counting"
                    />
                    <PermissionSwitch
                      id="allow_inventory_transfers"
                      label="Stock Transfers"
                      checked={permissions.allow_inventory_transfers}
                      onChange={(checked) => handleToggle('allow_inventory_transfers', checked)}
                      disabled={!permissions.allow_inventory}
                    />
                    <PermissionSwitch
                      id="allow_inventory_adjustments"
                      label="Stock Adjustments"
                      checked={permissions.allow_inventory_adjustments}
                      onChange={(checked) => handleToggle('allow_inventory_adjustments', checked)}
                      disabled={!permissions.allow_inventory}
                    />
                    <PermissionSwitch
                      id="allow_inventory_suppliers"
                      label="Manage Suppliers"
                      checked={permissions.allow_inventory_suppliers}
                      onChange={(checked) => handleToggle('allow_inventory_suppliers', checked)}
                      disabled={!permissions.allow_inventory}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Office Features */}
              {permissions.allow_office && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Office Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <PermissionSwitch
                      id="allow_office_accounting"
                      label="Expenses, Quotations & Payments"
                      checked={permissions.allow_office_accounting}
                      onChange={(checked) => handleToggle('allow_office_accounting', checked)}
                      disabled={!permissions.allow_office}
                    />
                    <PermissionSwitch
                      id="allow_office_users"
                      label="Users & Staff Management"
                      checked={permissions.allow_office_users}
                      onChange={(checked) => handleToggle('allow_office_users', checked)}
                      disabled={!permissions.allow_office}
                    />
                    <PermissionSwitch
                      id="allow_office_shift_management"
                      label="Shift Management"
                      checked={permissions.allow_office_shift_management}
                      onChange={(checked) => handleToggle('allow_office_shift_management', checked)}
                      disabled={!permissions.allow_office}
                    />
                    <PermissionSwitch
                      id="allow_office_reports"
                      label="Office Reports"
                      checked={permissions.allow_office_reports}
                      onChange={(checked) => handleToggle('allow_office_reports', checked)}
                      disabled={!permissions.allow_office}
                    />
                    <PermissionSwitch
                      id="allow_office_analytics"
                      label="Customer Management"
                      checked={permissions.allow_office_analytics}
                      onChange={(checked) => handleToggle('allow_office_analytics', checked)}
                      disabled={!permissions.allow_office}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Settings Features */}
              {permissions.allow_settings && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Settings Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <PermissionSwitch
                      id="allow_settings_outlets"
                      label="Outlets and Tills"
                      checked={permissions.allow_settings_outlets}
                      onChange={(checked) => handleToggle('allow_settings_outlets', checked)}
                      disabled={!permissions.allow_settings}
                    />
                    <PermissionSwitch
                      id="allow_settings_integrations"
                      label="Integrations"
                      checked={permissions.allow_settings_integrations}
                      onChange={(checked) => handleToggle('allow_settings_integrations', checked)}
                      disabled={!permissions.allow_settings}
                    />
                    <PermissionSwitch
                      id="allow_settings_advanced"
                      label="Business, Tax, Notifications & Activity Logs"
                      checked={permissions.allow_settings_advanced}
                      onChange={(checked) => handleToggle('allow_settings_advanced', checked)}
                      disabled={!permissions.allow_settings}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Distribution Features */}
              {permissions.has_distribution && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Distribution Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <PermissionSwitch
                      id="has_distribution"
                      label="Fleet & Delivery Operations"
                      checked={permissions.has_distribution}
                      onChange={(checked) => handleToggle('has_distribution', checked)}
                      description="Enables distribution dashboard, routes, and delivery workflows"
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
