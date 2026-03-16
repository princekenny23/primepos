"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, CalendarClock, Package } from "lucide-react"
import Link from "next/link"
import type { ExpiryAlertItem, LowStockAlertItem } from "@/lib/utils/inventory-alerts"

interface LowStockAlertsProps {
  items: LowStockAlertItem[]
  expiryItems?: ExpiryAlertItem[]
}

function formatExpiryStatus(item: ExpiryAlertItem) {
  if (item.status === "expired") {
    return `Expired ${item.days} day${item.days === 1 ? "" : "s"} ago`
  }

  if (item.status === "expires-today") {
    return "Expires today"
  }

  return `Expires in ${item.days} day${item.days === 1 ? "" : "s"}`
}

export function LowStockAlerts({ items, expiryItems = [] }: LowStockAlertsProps) {
  const hasAlerts = items.length > 0 || expiryItems.length > 0

  if (!hasAlerts) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle>Inventory Alerts</CardTitle>
          <CardDescription>Low stock and expiry issues that need attention</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No low stock or expiry alerts right now</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Inventory Alerts
        </CardTitle>
        <CardDescription>
          {items.length} low stock and {expiryItems.length} expiry alert{items.length + expiryItems.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2.5 max-h-[20rem] overflow-y-auto pr-1">
          {items.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Low Stock</span>
                <span>{items.length}</span>
              </div>
              {items.slice(0, expiryItems.length > 0 ? 3 : 4).map((item) => (
                <Alert key={item.id} variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {item.currentStock} / {item.minStock} min
                    </span>
                  </AlertTitle>
                  <AlertDescription>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <span className="text-xs">SKU: {item.sku} • {item.category}</span>
                      <Link href={`/dashboard/inventory?product=${item.id}`}>
                        <Button variant="outline" size="sm">Restock</Button>
                      </Link>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
          {expiryItems.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Expiries</span>
                <span>{expiryItems.length}</span>
              </div>
              {expiryItems.slice(0, items.length > 0 ? 3 : 4).map((item) => (
                <Alert key={`expiry-${item.id}`} variant="warning">
                  <CalendarClock className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between gap-2">
                    <span>{item.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatExpiryStatus(item)}
                    </span>
                  </AlertTitle>
                  <AlertDescription>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <span className="text-xs">
                        SKU: {item.sku} • {item.category} • {new Date(item.expiryDate).toLocaleDateString()}
                      </span>
                      <Link href="/dashboard/inventory/expiry">
                        <Button variant="outline" size="sm">Review</Button>
                      </Link>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
          {(items.length > 3 || expiryItems.length > 3) && (
            <Link href="/dashboard/inventory/expiry" className="block">
              <Button variant="outline" size="sm" className="w-full">
                View All Inventory Alerts
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

