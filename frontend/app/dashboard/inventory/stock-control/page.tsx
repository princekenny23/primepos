"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Sliders, 
  ArrowRightLeft, 
  Package, 
  RotateCcw,
  Plus,
  Eye
} from "lucide-react"
import { inventoryService } from "@/lib/services/inventoryService"
import { returnService, type Return } from "@/lib/services/returnService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button"
import { useI18n } from "@/contexts/i18n-context"
import { productService } from "@/lib/services/productService"
import { StockDisplayGrid } from "@/components/stock/stock-display"
import type { Product } from "@/lib/types"

export default function StockControlPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const [activeTab, setActiveTab] = useState<string>("adjusts")
  const useReal = useRealAPI()
  const { t } = useI18n()

  // Data states
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [receiving, setReceiving] = useState<any[]>([])
  const [returns, setReturns] = useState<Return[]>([])
  const [stockProducts, setStockProducts] = useState<Product[]>([])

  // Loading states
  const [isLoadingAdjustments, setIsLoadingAdjustments] = useState(true)
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true)
  const [isLoadingReceiving, setIsLoadingReceiving] = useState(true)
  const [isLoadingReturns, setIsLoadingReturns] = useState(true)
  const [isLoadingStock, setIsLoadingStock] = useState(true)
  const [stockError, setStockError] = useState<string | null>(null)

  // Load adjustments
  const loadAdjustments = useCallback(async () => {
    if (!currentBusiness) {
      setAdjustments([])
      setIsLoadingAdjustments(false)
      return
    }
    
    setIsLoadingAdjustments(true)
    try {
      if (useReal) {
        const movements = await inventoryService.getMovements({
          movement_type: "adjustment",
        })
        
        const mappedAdjustments = (movements.results || []).map((m: any) => ({
          id: String(m.id),
          product_name: m.product_name || (typeof m.product === 'string' ? m.product : m.product?.name) || "N/A",
          outlet_name: m.outlet_name || (typeof m.outlet === 'object' ? (m.outlet?.name || "N/A") : "N/A"),
          outlet_id: typeof m.outlet === 'object' ? m.outlet?.id : m.outlet,
          reason: m.reason || "",
          quantity: m.quantity || 0,
          user_name: m.user_name || (typeof m.user === 'string' ? m.user : m.user?.email) || "System",
          date: m.created_at || m.date || new Date().toISOString(),
        }))
        setAdjustments(mappedAdjustments)
      } else {
        setAdjustments([])
      }
    } catch (error) {
      console.error("Failed to load adjustments:", error)
      setAdjustments([])
    } finally {
      setIsLoadingAdjustments(false)
    }
  }, [currentBusiness, useReal])

  // Load transfers
  const loadTransfers = useCallback(async () => {
    if (!currentBusiness) {
      setTransfers([])
      setIsLoadingTransfers(false)
      return
    }
    
    setIsLoadingTransfers(true)
    try {
      if (useReal) {
        const transferOutMovements = await inventoryService.getMovements({
          movement_type: "transfer_out",
        })
        
        const transferMap = new Map()
        const transferOutResults = transferOutMovements.results || []
        
        transferOutResults.forEach((movement: any) => {
          const transferId = `${movement.id}_${movement.product?.id || movement.product}_${movement.created_at}`
          
          if (!transferMap.has(transferId)) {
            const fromOutletId = movement.outlet || (typeof movement.outlet === 'object' ? movement.outlet.id : movement.outlet)
            transferMap.set(transferId, {
              id: movement.id,
              product_name: movement.product_name || movement.product?.name || "N/A",
              from_outlet_name: movement.outlet_name || (typeof movement.outlet === 'object' ? movement.outlet.name : "N/A"),
              to_outlet_name: "N/A",
              quantity: movement.quantity,
              reason: movement.reason || "",
              date: movement.created_at,
            })
          }
        })
        
        const transferInMovements = await inventoryService.getMovements({
          movement_type: "transfer_in",
        })
        
        const transferInResults = transferInMovements.results || []
        transferInResults.forEach((movement: any) => {
          const matchingTransfer = Array.from(transferMap.values()).find((t: any) => 
            t.quantity === movement.quantity &&
            (movement.reference_id === String(t.id) || 
             new Date(t.date).toDateString() === new Date(movement.created_at).toDateString())
          )
          if (matchingTransfer) {
            matchingTransfer.to_outlet_name = movement.outlet_name || (typeof movement.outlet === 'object' ? movement.outlet.name : "N/A")
          }
        })
        
        setTransfers(Array.from(transferMap.values()))
      } else {
        setTransfers([])
      }
    } catch (error) {
      console.error("Failed to load transfers:", error)
      setTransfers([])
    } finally {
      setIsLoadingTransfers(false)
    }
  }, [currentBusiness, useReal])

  // Load receiving
  const loadReceiving = useCallback(async () => {
    if (!currentBusiness) {
      setReceiving([])
      setIsLoadingReceiving(false)
      return
    }
    
    setIsLoadingReceiving(true)
    try {
      if (useReal) {
        const purchaseMovements = await inventoryService.getMovements({
          movement_type: "purchase",
        })
        
        const receivingMap = new Map()
        const purchaseResults = purchaseMovements.results || []
        
        purchaseResults.forEach((movement: any) => {
          const supplier = movement.reference_id || "Unknown Supplier"
          const outletId = movement.outlet || (typeof movement.outlet === 'object' ? movement.outlet.id : null)
          const outletName = movement.outlet_name || (typeof movement.outlet === 'object' ? movement.outlet.name : null) || 
                            (outletId ? outlets.find(o => o.id === outletId)?.name : null) || "N/A"
          const dateKey = new Date(movement.created_at).toDateString()
          const key = `${supplier}_${outletId || 'no-outlet'}_${dateKey}`
          
          if (!receivingMap.has(key)) {
            receivingMap.set(key, {
              id: key,
              supplier: supplier,
              date: movement.created_at,
              outlet_name: outletName,
              reason: movement.reason || "",
              total_items: 0,
              total_quantity: 0,
            })
          }
          
          const receiving = receivingMap.get(key)
          receiving.total_items += 1
          receiving.total_quantity += movement.quantity || 0
        })
        
        setReceiving(Array.from(receivingMap.values()))
      } else {
        setReceiving([])
      }
    } catch (error) {
      console.error("Failed to load receiving:", error)
      setReceiving([])
    } finally {
      setIsLoadingReceiving(false)
    }
  }, [currentBusiness, outlets, useReal])

  const loadStockOverview = useCallback(async () => {
    if (!currentBusiness) {
      setStockProducts([])
      setIsLoadingStock(false)
      return
    }

    setIsLoadingStock(true)
    setStockError(null)
    try {
      const response = await productService.list({ is_active: true })
      const items = response.results || []
      setStockProducts(items.slice(0, 6))
    } catch (error) {
      console.error("Failed to load stock overview:", error)
      setStockProducts([])
      setStockError("Could not load stock overview")
    } finally {
      setIsLoadingStock(false)
    }
  }, [currentBusiness])

  // Load returns
  const loadReturns = useCallback(async () => {
    if (!currentBusiness || !currentOutlet) {
      setReturns([])
      setIsLoadingReturns(false)
      return
    }
    
    setIsLoadingReturns(true)
    try {
      const response = await returnService.list({
        outlet: String(currentOutlet.id),
      })
      setReturns(response.results || [])
    } catch (error) {
      console.error("Failed to load returns:", error)
      setReturns([])
    } finally {
      setIsLoadingReturns(false)
    }
  }, [currentBusiness, currentOutlet])

  // Load all data when component mounts or tab changes
  useEffect(() => {
    loadAdjustments()
    loadTransfers()
    loadReceiving()
    loadReturns()
    loadStockOverview()
  }, [loadAdjustments, loadTransfers, loadReceiving, loadReturns, loadStockOverview])

  const tabs: TabConfig[] = [
    {
      value: "adjusts",
      label: "Stock Adjusts",
      icon: Sliders,
      badgeCount: adjustments.length > 0 ? adjustments.length : undefined,
    },
    {
      value: "transferred",
      label: "Stock Transferred",
      icon: ArrowRightLeft,
      badgeCount: transfers.length > 0 ? transfers.length : undefined,
    },
    {
      value: "received",
      label: "Stock Received",
      icon: Package,
      badgeCount: receiving.length > 0 ? receiving.length : undefined,
    },
    {
      value: "returned",
      label: "Stock Returned",
      icon: RotateCcw,
      badgeCount: returns.length > 0 ? returns.length : undefined,
    },
  ]

  const getAddButtonRoute = (tab: string) => {
    switch (tab) {
      case "adjusts":
        return "/dashboard/inventory/stock-control/stock-adjustments"
      case "transferred":
        return "/dashboard/inventory/stock-control/transfers"
      case "received":
        return "/dashboard/inventory/stock-control/receiving"
      case "returned":
        return "/dashboard/inventory/stock-control/returns"
      default:
        return "#"
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title={t("inventory.menu.stock_control")}
        description={t("inventory.stock_control_description")}
        actions={<PageRefreshButton />}
      >
        <div className="mb-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Stock Overview</h3>
          {isLoadingStock ? (
            <div className="text-sm text-muted-foreground">Loading stock...</div>
          ) : stockError ? (
            <div className="text-sm text-destructive">{stockError}</div>
          ) : stockProducts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No products available.</div>
          ) : (
            <StockDisplayGrid products={stockProducts} />
          )}
        </div>

        <FilterableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          actionButton={
            <Button
              onClick={() => router.push(getAddButtonRoute(activeTab))}
              className="bg-blue-900 hover:bg-blue-800 text-white"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add {activeTab === "adjusts" ? "Adjustment" : activeTab === "transferred" ? "Transfer" : activeTab === "received" ? "Receiving" : "Return"}
            </Button>
          }
        >
          {/* Stock Adjusts Tab */}
          <TabsContent value="adjusts" className="space-y-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Adjustment History</h3>
                <p className="text-sm text-gray-600">
                  {adjustments.length} adjustment{adjustments.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <div className="rounded-md border border-gray-300 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-900 font-semibold">Date</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Product</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Reason</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Quantity</TableHead>
                      <TableHead className="text-gray-900 font-semibold">User</TableHead>
                      <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingAdjustments ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          Loading adjustments...
                        </TableCell>
                      </TableRow>
                    ) : adjustments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          No adjustments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      adjustments.map((adjustment) => (
                        <TableRow key={adjustment.id} className="border-gray-300">
                          <TableCell className="font-medium">
                            {adjustment.date
                              ? format(new Date(adjustment.date), "MMM dd, yyyy HH:mm")
                              : "N/A"}
                          </TableCell>
                          <TableCell>{adjustment.product_name}</TableCell>
                          <TableCell>{adjustment.outlet_name}</TableCell>
                          <TableCell>{adjustment.reason || "-"}</TableCell>
                          <TableCell>
                            <span className={adjustment.quantity > 0 ? "text-green-600" : "text-red-600"}>
                              {adjustment.quantity > 0 ? "+" : ""}{adjustment.quantity}
                            </span>
                          </TableCell>
                          <TableCell>{adjustment.user_name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="border-gray-300">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Stock Transferred Tab */}
          <TabsContent value="transferred" className="space-y-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Transfer History</h3>
                <p className="text-sm text-gray-600">
                  {transfers.length} transfer{transfers.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <div className="rounded-md border border-gray-300 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-900 font-semibold">Date</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Product</TableHead>
                      <TableHead className="text-gray-900 font-semibold">From Outlet</TableHead>
                      <TableHead className="text-gray-900 font-semibold">To Outlet</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Quantity</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Reason</TableHead>
                      <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTransfers ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          Loading transfers...
                        </TableCell>
                      </TableRow>
                    ) : transfers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          No transfers found
                        </TableCell>
                      </TableRow>
                    ) : (
                      transfers.map((transfer) => (
                        <TableRow key={transfer.id} className="border-gray-300">
                          <TableCell className="font-medium">
                            {transfer.date
                              ? format(new Date(transfer.date), "MMM dd, yyyy HH:mm")
                              : "N/A"}
                          </TableCell>
                          <TableCell>{transfer.product_name}</TableCell>
                          <TableCell>{transfer.from_outlet_name}</TableCell>
                          <TableCell>{transfer.to_outlet_name}</TableCell>
                          <TableCell>{transfer.quantity}</TableCell>
                          <TableCell>{transfer.reason || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="border-gray-300">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Stock Received Tab */}
          <TabsContent value="received" className="space-y-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Receiving History</h3>
                <p className="text-sm text-gray-600">
                  {receiving.length} receiving record{receiving.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <div className="rounded-md border border-gray-300 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-900 font-semibold">Date</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Supplier</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Items</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Total Quantity</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Reason</TableHead>
                      <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingReceiving ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          Loading receiving records...
                        </TableCell>
                      </TableRow>
                    ) : receiving.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          No receiving records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      receiving.map((rec) => (
                        <TableRow key={rec.id} className="border-gray-300">
                          <TableCell className="font-medium">
                            {rec.date
                              ? format(new Date(rec.date), "MMM dd, yyyy HH:mm")
                              : "N/A"}
                          </TableCell>
                          <TableCell>{rec.supplier}</TableCell>
                          <TableCell>{rec.outlet_name}</TableCell>
                          <TableCell>{rec.total_items}</TableCell>
                          <TableCell>{rec.total_quantity}</TableCell>
                          <TableCell>{rec.reason || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="border-gray-300">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* Stock Returned Tab */}
          <TabsContent value="returned" className="space-y-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Return History</h3>
                <p className="text-sm text-gray-600">
                  {returns.length} return{returns.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <div className="rounded-md border border-gray-300 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-gray-900 font-semibold">Date</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Return Type</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Reference</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Items</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                      <TableHead className="text-right text-gray-900 font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingReturns ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          Loading returns...
                        </TableCell>
                      </TableRow>
                    ) : returns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          No returns found
                        </TableCell>
                      </TableRow>
                    ) : (
                      returns.map((returnItem) => (
                        <TableRow key={returnItem.id} className="border-gray-300">
                          <TableCell className="font-medium">
                            {returnItem.created_at
                              ? format(new Date(returnItem.created_at), "MMM dd, yyyy HH:mm")
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {returnItem.return_type === "customer" ? "Customer" : 
                               returnItem.return_type === "supplier" ? "Supplier" : "Outlet"}
                            </Badge>
                          </TableCell>
                          <TableCell>{returnItem.return_number || "-"}</TableCell>
                          <TableCell>
                            {returnItem.outlet?.name || 
                             (returnItem.outlet_id ? outlets.find(o => o.id === returnItem.outlet_id)?.name : null) || 
                             "N/A"}
                          </TableCell>
                          <TableCell>{returnItem.items?.length || 0}</TableCell>
                          <TableCell>
                            <Badge variant={returnItem.status === "completed" ? "default" : "secondary"}>
                              {returnItem.status || "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="border-gray-300">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </FilterableTabs>
      </PageLayout>
    </DashboardLayout>
  )
}

