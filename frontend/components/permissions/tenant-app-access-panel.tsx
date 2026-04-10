"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export type TenantAppAccessKey =
  | "allow_sales"
  | "allow_pos"
  | "allow_inventory"
  | "allow_office"
  | "allow_settings"
  | "allow_storefront"
  | "has_distribution"

export interface TenantAppAccessState {
  allow_sales: boolean
  allow_pos: boolean
  allow_inventory: boolean
  allow_office: boolean
  allow_settings: boolean
  allow_storefront: boolean
  has_distribution: boolean
}

interface TenantAppAccessPanelProps {
  permissions: TenantAppAccessState
  onToggle: (key: TenantAppAccessKey, value: boolean) => void
  disabled?: boolean
  title?: string
  description?: string
}

const appRows: Array<{ key: TenantAppAccessKey; label: string }> = [
  { key: "allow_sales", label: "Sales" },
  { key: "allow_pos", label: "POS" },
  { key: "allow_inventory", label: "Inventory" },
  { key: "allow_office", label: "Office" },
  { key: "allow_settings", label: "Settings" },
  { key: "allow_storefront", label: "Storefront" },
  { key: "has_distribution", label: "Distribution Module" },
]

export function TenantAppAccessPanel({
  permissions,
  onToggle,
  disabled = false,
  title = "Tenant App Access",
  description,
}: TenantAppAccessPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {appRows.map((row) => (
            <div
              key={row.key}
              className={row.key === "has_distribution" ? "flex items-center justify-between rounded-md border p-2 sm:col-span-2" : "flex items-center justify-between rounded-md border p-2"}
            >
              <Label>{row.label}</Label>
              <Switch
                checked={permissions[row.key]}
                onCheckedChange={(checked) => onToggle(row.key, checked)}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
