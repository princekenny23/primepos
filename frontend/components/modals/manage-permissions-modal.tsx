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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { adminService } from "@/lib/services/adminService"
import { outletService } from "@/lib/services/outletService"
import {
  TenantAppAccessPanel,
  type TenantAppAccessKey,
  type TenantAppAccessState,
} from "@/components/permissions/tenant-app-access-panel"

type OutletPermissions = TenantAppAccessState

type EditableOutlet = {
  id: string
  name: string
  address?: string
  isActive: boolean
  distributionActive: boolean
  settings: Record<string, any>
  modulePermissions: OutletPermissions
  isSaving: boolean
}

const defaultOutletModulePermissions: OutletPermissions = {
  allow_sales: true,
  allow_pos: true,
  allow_inventory: true,
  allow_office: true,
  allow_settings: true,
  allow_storefront: true,
  has_distribution: true,
}

const normalizeOutletModulePermissions = (source: any): OutletPermissions => ({
  allow_sales: source?.allow_sales ?? source?.sales ?? true,
  allow_pos: source?.allow_pos ?? source?.pos ?? true,
  allow_inventory: source?.allow_inventory ?? source?.inventory ?? true,
  allow_office: source?.allow_office ?? source?.office ?? true,
  allow_settings: source?.allow_settings ?? source?.settings ?? true,
  allow_storefront: source?.allow_storefront ?? source?.storefront ?? true,
  has_distribution: source?.has_distribution ?? source?.allow_distribution ?? source?.distribution ?? true,
})

interface TenantPermissions {
  has_distribution: boolean

  // Apps
  allow_sales: boolean
  allow_pos: boolean
  allow_inventory: boolean
  allow_office: boolean
  allow_settings: boolean
  allow_storefront: boolean

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

  // Storefront Features
  allow_storefront_sites: boolean
  allow_storefront_orders: boolean
  allow_storefront_reports: boolean
  allow_storefront_settings: boolean

  // Distribution Features
  allow_distribution_routes: boolean
  allow_distribution_drivers: boolean
  allow_distribution_orders: boolean
  allow_distribution_tracking: boolean
  allow_distribution_reports: boolean
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
  const [isSavingOutletPermissions, setIsSavingOutletPermissions] = useState(false)
  const [permissions, setPermissions] = useState<TenantPermissions>({
    has_distribution: false,

    // Apps - default all enabled
    allow_sales: true,
    allow_pos: true,
    allow_inventory: true,
    allow_office: true,
    allow_settings: true,
    allow_storefront: true,

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

    // Storefront Features
    allow_storefront_sites: true,
    allow_storefront_orders: true,
    allow_storefront_reports: true,
    allow_storefront_settings: true,

    // Distribution Features
    allow_distribution_routes: true,
    allow_distribution_drivers: true,
    allow_distribution_orders: true,
    allow_distribution_tracking: true,
    allow_distribution_reports: true,
  })
  const [outlets, setOutlets] = useState<EditableOutlet[]>([])
  const [selectedOutletId, setSelectedOutletId] = useState<string>("")
  const selectedOutlet = outlets.find((item) => item.id === selectedOutletId) || null

  useEffect(() => {
    if (open && tenant) {
      loadPermissions()
    }
  }, [open, tenant])

  const loadPermissions = async () => {
    setIsLoading(true)
    try {
      const [data, tenantDetails] = await Promise.all([
        adminService.getTenantPermissions(tenant.id),
        adminService.getTenant(tenant.id),
      ])

      if (data) {
        // Keep users and staff managed together in the UI.
        const usersAndStaffEnabled = (data.allow_office_users !== false) || (data.allow_office_staff !== false)
        setPermissions(prev => ({
          ...prev,
          ...data,
          allow_office_users: usersAndStaffEnabled,
          allow_office_staff: usersAndStaffEnabled,
          // Default distribution sub-features to true if not set by API
          allow_distribution_routes: data.allow_distribution_routes ?? true,
          allow_distribution_drivers: data.allow_distribution_drivers ?? true,
          allow_distribution_orders: data.allow_distribution_orders ?? true,
          allow_distribution_tracking: data.allow_distribution_tracking ?? true,
          allow_distribution_reports: data.allow_distribution_reports ?? true,
          allow_storefront: data.allow_storefront ?? true,
          allow_storefront_sites: data.allow_storefront_sites ?? true,
          allow_storefront_orders: data.allow_storefront_orders ?? true,
          allow_storefront_reports: data.allow_storefront_reports ?? true,
          allow_storefront_settings: data.allow_storefront_settings ?? true,
        }))
      }

      const tenantOutlets = Array.isArray(tenantDetails?.outlets) ? tenantDetails.outlets : []
      const mappedOutlets: EditableOutlet[] = tenantOutlets.map((outlet: any) => {
        const modulePermissionsRaw =
          outlet?.settings?.module_permissions ||
          outlet?.settings?.modulePermissions ||
          defaultOutletModulePermissions

        return {
          id: String(outlet.id),
          name: outlet.name || "Unnamed Outlet",
          address: outlet.address || "",
          isActive: outlet.is_active !== false,
          distributionActive: outlet.distribution_active !== false,
          settings: outlet.settings || {},
          modulePermissions: normalizeOutletModulePermissions(modulePermissionsRaw),
          isSaving: false,
        }
      })

      setOutlets(mappedOutlets)
      setSelectedOutletId((prev) => {
        if (prev && mappedOutlets.some((item) => item.id === prev)) return prev
        return mappedOutlets[0]?.id || ""
      })
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
      } else if (key === 'allow_storefront') {
        setPermissions(prev => ({
          ...prev,
          allow_storefront_sites: false,
          allow_storefront_orders: false,
          allow_storefront_reports: false,
          allow_storefront_settings: false,
        }))
      } else if (key === 'has_distribution') {
        setPermissions(prev => ({
          ...prev,
          allow_distribution_routes: false,
          allow_distribution_drivers: false,
          allow_distribution_orders: false,
          allow_distribution_tracking: false,
          allow_distribution_reports: false,
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

  const setOutletSaving = (outletId: string, isSavingFlag: boolean) => {
    setOutlets((prev) =>
      prev.map((outlet) =>
        outlet.id === outletId ? { ...outlet, isSaving: isSavingFlag } : outlet
      )
    )
  }

  const toggleOutletPermission = (outletId: string, key: TenantAppAccessKey, value: boolean) => {
    setOutlets((prev) =>
      prev.map((outlet) => {
        if (outlet.id !== outletId) return outlet

        const nextModulePermissions = {
          ...outlet.modulePermissions,
          [key]: value,
        }

        return {
          ...outlet,
          modulePermissions: nextModulePermissions,
          distributionActive: key === "has_distribution" ? value : outlet.distributionActive,
        }
      })
    )
  }

  const handleSaveOutletPermissions = async () => {
    if (!selectedOutlet) return

    setIsSavingOutletPermissions(true)
    setOutletSaving(selectedOutlet.id, true)

    try {
      const currentOutletSettings = (selectedOutlet.settings || {}) as Record<string, any>
      const updatePayload: any = {
        name: selectedOutlet.name,
        settings: {
          ...currentOutletSettings,
          module_permissions: {
            ...selectedOutlet.modulePermissions,
          },
        },
        distributionActive: selectedOutlet.distributionActive,
      }
      const updatedOutlet = await outletService.update(selectedOutlet.id, updatePayload)
      const updatedOutletAny = updatedOutlet as any

      const updatedOutletSettings = (updatedOutletAny.settings || {}) as Record<string, any>

      setOutlets((prev) =>
        prev.map((item) =>
          item.id === selectedOutlet.id
            ? {
                ...item,
                settings: updatedOutletAny.settings || item.settings,
                distributionActive:
                  updatedOutletAny.distributionActive !== undefined
                    ? Boolean(updatedOutletAny.distributionActive)
                    : item.distributionActive,
                modulePermissions: normalizeOutletModulePermissions(
                  updatedOutletSettings?.module_permissions ||
                    updatedOutletSettings?.modulePermissions ||
                    item.modulePermissions
                ),
              }
            : item
        )
      )

      if (typeof window !== "undefined") {
        const currentOutletId = window.localStorage.getItem("currentOutletId")
        if (currentOutletId && String(currentOutletId) === String(selectedOutlet.id)) {
          try {
            const rawBusinessState = window.localStorage.getItem("primepos-business")
            if (rawBusinessState) {
              const parsed = JSON.parse(rawBusinessState)
              if (parsed?.state?.currentOutlet && String(parsed.state.currentOutlet.id) === String(selectedOutlet.id)) {
                parsed.state.currentOutlet.settings = updatedOutlet.settings || parsed.state.currentOutlet.settings || {}
                parsed.state.currentOutlet.distributionActive =
                  updatedOutlet.distributionActive !== undefined
                    ? Boolean(updatedOutlet.distributionActive)
                    : parsed.state.currentOutlet.distributionActive
                window.localStorage.setItem("primepos-business", JSON.stringify(parsed))

                window.dispatchEvent(
                  new CustomEvent("outlet-changed", {
                    detail: {
                      outletId: String(selectedOutlet.id),
                      outletName: selectedOutlet.name,
                      outlet: parsed.state.currentOutlet,
                    },
                  })
                )
              }
            }
          } catch {
            // Non-fatal: outlet refresh event below still syncs app state.
          }
        }

        window.dispatchEvent(new CustomEvent("outlets-updated"))
      }

      toast({
        title: "Outlet Updated",
        description: `${selectedOutlet.name} permissions updated successfully.`,
      })
    } catch (error: any) {
      console.error("Failed to save outlet permissions:", error)
      toast({
        title: "Error",
        description: error?.message || `Failed to update ${selectedOutlet.name}.`,
        variant: "destructive",
      })
    } finally {
      setOutletSaving(selectedOutlet.id, false)
      setIsSavingOutletPermissions(false)
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
            Control which apps, features, and outlet-level access this tenant can use
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="apps" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="apps">Apps</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="outlets">Outlets</TabsTrigger>
            </TabsList>

            <TabsContent value="apps" className="space-y-4 mt-4">
              <TenantAppAccessPanel
                permissions={permissions}
                onToggle={handleToggle}
                disabled={isSaving}
                description="Control which top-level tenant apps are enabled. This is shared with Edit Tenant module access."
              />
            </TabsContent>

            <TabsContent value="features" className="space-y-4 mt-4">
              {!permissions.allow_sales && !permissions.allow_pos && !permissions.allow_inventory && !permissions.allow_office && !permissions.allow_settings && !permissions.allow_storefront && !permissions.has_distribution && (
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

              {/* Storefront Features */}
              {permissions.allow_storefront && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Storefront Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <PermissionSwitch
                      id="allow_storefront_sites"
                      label="Sites"
                      checked={permissions.allow_storefront_sites}
                      onChange={(checked) => handleToggle('allow_storefront_sites', checked)}
                      disabled={!permissions.allow_storefront}
                      description="Create and manage storefront sites"
                    />
                    <PermissionSwitch
                      id="allow_storefront_orders"
                      label="Online Orders"
                      checked={permissions.allow_storefront_orders}
                      onChange={(checked) => handleToggle('allow_storefront_orders', checked)}
                      disabled={!permissions.allow_storefront}
                      description="View and manage storefront orders"
                    />
                    <PermissionSwitch
                      id="allow_storefront_reports"
                      label="Storefront Reports"
                      checked={permissions.allow_storefront_reports}
                      onChange={(checked) => handleToggle('allow_storefront_reports', checked)}
                      disabled={!permissions.allow_storefront}
                      description="Performance and conversion analytics"
                    />
                    <PermissionSwitch
                      id="allow_storefront_settings"
                      label="Storefront Settings"
                      checked={permissions.allow_storefront_settings}
                      onChange={(checked) => handleToggle('allow_storefront_settings', checked)}
                      disabled={!permissions.allow_storefront}
                      description="Branding, catalog rules, and domains"
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
                      id="allow_distribution_orders"
                      label="Manage Delivery Orders"
                      checked={permissions.allow_distribution_orders}
                      onChange={(checked) => handleToggle('allow_distribution_orders', checked)}
                      disabled={!permissions.has_distribution}
                      description="Create, assign and manage delivery orders"
                    />
                    <PermissionSwitch
                      id="allow_distribution_routes"
                      label="Routes & Scheduling"
                      checked={permissions.allow_distribution_routes}
                      onChange={(checked) => handleToggle('allow_distribution_routes', checked)}
                      disabled={!permissions.has_distribution}
                      description="Plan and manage delivery routes"
                    />
                    <PermissionSwitch
                      id="allow_distribution_drivers"
                      label="Drivers & Fleet Management"
                      checked={permissions.allow_distribution_drivers}
                      onChange={(checked) => handleToggle('allow_distribution_drivers', checked)}
                      disabled={!permissions.has_distribution}
                      description="Manage drivers, vehicles and fleet"
                    />
                    <PermissionSwitch
                      id="allow_distribution_tracking"
                      label="Live Tracking"
                      checked={permissions.allow_distribution_tracking}
                      onChange={(checked) => handleToggle('allow_distribution_tracking', checked)}
                      disabled={!permissions.has_distribution}
                      description="Real-time delivery and driver tracking"
                    />
                    <PermissionSwitch
                      id="allow_distribution_reports"
                      label="Distribution Reports"
                      checked={permissions.allow_distribution_reports}
                      onChange={(checked) => handleToggle('allow_distribution_reports', checked)}
                      disabled={!permissions.has_distribution}
                      description="Delivery performance and analytics reports"
                    />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="outlets" className="space-y-4 mt-4">
              {outlets.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    No outlets found for this tenant.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Outlet Permission Scope</CardTitle>
                      <CardDescription>
                        Select an outlet and manage app access just for that outlet.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select value={selectedOutletId} onValueChange={setSelectedOutletId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select outlet" />
                        </SelectTrigger>
                        <SelectContent>
                          {outlets.map((outlet) => (
                            <SelectItem key={outlet.id} value={outlet.id}>
                              {outlet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>

                  {selectedOutlet && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">{selectedOutlet.name}</CardTitle>
                            <CardDescription>{selectedOutlet.address || "No address"}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={selectedOutlet.isActive ? "default" : "secondary"}>
                              {selectedOutlet.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <TenantAppAccessPanel
                          permissions={selectedOutlet.modulePermissions}
                          onToggle={(key, value) => toggleOutletPermission(selectedOutlet.id, key, value)}
                          disabled={selectedOutlet.isSaving || isSavingOutletPermissions}
                          title="Outlet App Access"
                          description="These module switches apply only to this outlet. Distribution is controlled by the Distribution toggle here."
                        />

                        <div className="flex justify-end">
                          <Button
                            onClick={handleSaveOutletPermissions}
                            disabled={selectedOutlet.isSaving || isSavingOutletPermissions}
                          >
                            {(selectedOutlet.isSaving || isSavingOutletPermissions) ? "Saving..." : "Save Outlet Permissions"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
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
