"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { 
  AlertTriangle,
  ShoppingCart,
  RefreshCw,
  Package
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/use-toast"
import { productService } from "@/lib/services/productService"
import { purchaseOrderService, type PurchaseOrder } from "@/lib/services/purchaseOrderService"
import { useTenant } from "@/contexts/tenant-context"
import { useBusinessStore } from "@/stores/businessStore"
import { useI18n } from "@/contexts/i18n-context"

export default function LowStockPage() {
  const { toast } = useToast()
  const { currentOutlet } = useTenant()
  const { currentOutlet: businessOutlet } = useBusinessStore()
  const { t } = useI18n()
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [isLoadingLowStock, setIsLoadingLowStock] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [orderingItemId, setOrderingItemId] = useState<string | null>(null)

  const outlet = currentOutlet || businessOutlet

  const loadLowStockItems = async () => {
    if (!outlet) return
    
    setIsLoadingLowStock(true)
    try {
      const items = await productService.getLowStock(outlet.id)
      // Filter and transform items to show low stock details
      const lowStock = items
        .filter((p: any) => {
          const sellableStock = Number(p.sellable_stock ?? 0)

          // Check product-level low stock
          const productLow = p.lowStockThreshold && sellableStock <= p.lowStockThreshold
          
          // Check variation-level low stock
          const variationLow = p.variations?.some((v: any) => 
            v.track_inventory && 
            v.low_stock_threshold > 0 && 
            (v.total_stock || v.stock || 0) <= v.low_stock_threshold
          )
          
          // Also check is_low_stock flag from backend
          return p.is_low_stock || productLow || variationLow
        })
        .map((p: any) => {
          // Find the variation with lowest stock if any
          const lowVariation = p.variations?.find((v: any) => 
            v.track_inventory && 
            v.low_stock_threshold > 0 && 
            (v.total_stock || v.stock || 0) <= v.low_stock_threshold
          )
          
          return {
            id: p.id,
            name: p.name,
            sku: p.sku || lowVariation?.sku || "N/A",
            currentStock: lowVariation
              ? (lowVariation.total_stock || lowVariation.stock || 0)
              : Number(p.sellable_stock ?? 0),
            minStock: lowVariation ? (lowVariation.low_stock_threshold || 0) : (p.lowStockThreshold || 0),
            category: p.category?.name || "General",
            cost: p.cost || p.cost_price || 0,
            variation: lowVariation,
            product: p,
          }
        })
      setLowStockItems(lowStock)
    } catch (error) {
      console.error("Failed to load low stock items:", error)
      toast({
        title: "Error",
        description: "Failed to load low stock items",
        variant: "destructive",
      })
    } finally {
      setIsLoadingLowStock(false)
    }
  }

  useEffect(() => {
    loadLowStockItems()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadLowStockItems()
    }, 30000)
    
    // Listen for outlet changes
    const handleOutletChange = () => {
      loadLowStockItems()
    }
    window.addEventListener("outlet-changed", handleOutletChange)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener("outlet-changed", handleOutletChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadLowStockItems()
    setIsRefreshing(false)
    toast({
      title: "Refreshed",
      description: "Low stock items updated",
    })
  }

  const handleOrderItem = async (item: any) => {
    if (!outlet) {
      toast({
        title: "Error",
        description: "Please select an outlet",
        variant: "destructive",
      })
      return
    }

    setOrderingItemId(item.id)
    try {
      // Calculate reorder quantity (suggest 2x the threshold or minimum 10)
      const reorderQuantity = Math.max(item.minStock * 2, 10)
      const unitPrice = item.cost > 0 ? item.cost.toString() : "0.00"

      // Create a purchase order with this item
      const purchaseOrderData: Partial<PurchaseOrder> = {
        supplier_id: null, // No supplier initially (supplier-optional system)
        outlet_id: Number(outlet.id),
        order_date: new Date().toISOString().split('T')[0],
        status: "pending_supplier", // Status for items without supplier
        subtotal: (reorderQuantity * parseFloat(unitPrice)).toFixed(2),
        tax: "0.00",
        discount: "0.00",
        total: (reorderQuantity * parseFloat(unitPrice)).toFixed(2),
        items_data: [{
          product_id: Number(item.id),
          quantity: reorderQuantity,
          unit_price: unitPrice,
          notes: `Auto-ordered from low stock alert. Current stock: ${item.currentStock}, Threshold: ${item.minStock}`,
        }],
      }

      const createdPO = await purchaseOrderService.create(purchaseOrderData)
      
      toast({
        title: "Success",
        description: `Purchase order created for ${item.name}. You can assign a supplier later.`,
      })

      // Refresh low stock items
      await loadLowStockItems()
    } catch (error: any) {
      console.error("Failed to create purchase order:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order",
        variant: "destructive",
      })
    } finally {
      setOrderingItemId(null)
    }
  }

  if (!outlet) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select an outlet to view low stock items</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("inventory.low_stock.title")}
        description={t("inventory.low_stock.description")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoadingLowStock}
            className="bg-white border-white text-[#1e3a8a] hover:bg-blue-50 hover:border-blue-50"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      >
        {/* Low Stock Alerts Section */}
        <div>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900">Low Stock Items</h3>
            {lowStockItems.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {lowStockItems.length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Items that need to be reordered. Click &quot;Order Item&quot; to create a purchase order.
          </p>
          {isLoadingLowStock ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading low stock items...</p>
            </div>
          ) : lowStockItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50 text-gray-400" />
              <p className="text-gray-600">No low stock items at the moment</p>
              <p className="text-sm mt-2 text-gray-500">All items are above their minimum stock thresholds</p>
            </div>
          ) : (
            <div className="rounded-md border border-gray-300 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-900 font-semibold">Product</TableHead>
                    <TableHead className="text-gray-900 font-semibold">SKU</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Current Stock</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Min. Stock</TableHead>
                    <TableHead className="text-gray-900 font-semibold">Category</TableHead>
                    <TableHead className="text-right text-gray-900 font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.map((item) => (
                    <TableRow key={item.id} className="border-gray-300">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{item.sku}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          {item.currentStock}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.minStock}</Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">{item.category}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOrderItem(item)}
                          disabled={orderingItemId === item.id}
                          className="border-gray-300"
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {orderingItemId === item.id ? "Ordering..." : "Order Item"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </PageLayout>
    </DashboardLayout>
  )
}

