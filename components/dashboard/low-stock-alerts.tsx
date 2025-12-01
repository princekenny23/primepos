"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Package } from "lucide-react"
import Link from "next/link"

interface LowStockItem {
  id: string
  name: string
  sku: string
  currentStock: number
  minStock: number
  category: string
}

interface LowStockAlertsProps {
  items: LowStockItem[]
}

export function LowStockAlerts({ items }: LowStockAlertsProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Low Stock Alerts</CardTitle>
          <CardDescription>Products running low on inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>All products are well stocked</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Low Stock Alerts
        </CardTitle>
        <CardDescription>
          {items.length} product{items.length !== 1 ? "s" : ""} need restocking
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <Alert key={item.id} variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{item.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {item.currentStock} / {item.minStock} min
                </span>
              </AlertTitle>
              <AlertDescription>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs">SKU: {item.sku} • {item.category}</span>
                  <Link href={`/dashboard/inventory?product=${item.id}`}>
                    <Button variant="outline" size="sm">Restock</Button>
                  </Link>
                </div>
              </AlertDescription>
            </Alert>
          ))}
          {items.length > 5 && (
            <Link href="/dashboard/inventory?filter=low-stock" className="block">
              <Button variant="outline" className="w-full">
                View All {items.length} Low Stock Items
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

