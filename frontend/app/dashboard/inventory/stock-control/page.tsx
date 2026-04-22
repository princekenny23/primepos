"use client"

import { useState, useEffect, useCallback } from "react"
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
  Calendar,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { inventoryService } from "@/lib/services/inventoryService"
import { returnService, type Return } from "@/lib/services/returnService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button"
import { useI18n } from "@/contexts/i18n-context"
import { productService } from "@/lib/services/productService"
import type { Product } from "@/lib/types"
import Link from "next/link"

export default function StockControlPage() {
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const currentOutletId = currentOutlet?.id ? String(currentOutlet.id) : undefined
  const [activeTab, setActiveTab] = useState<string>("adjusts")
  const pageSize = 10
  const useReal = useRealAPI()
  const { t } = useI18n()

  // Data states
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [transfers, setTransfers] = useState<any[]>([])
  const [receiving, setReceiving] = useState<any[]>([])
  const [returns, setReturns] = useState<Return[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Loading states
  const [isLoadingAdjustments, setIsLoadingAdjustments] = useState(true)
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true)
  const [isLoadingReceiving, setIsLoadingReceiving] = useState(true)
  const [isLoadingReturns, setIsLoadingReturns] = useState(true)

  const [adjustmentsPage, setAdjustmentsPage] = useState(1)
  const [transfersPage, setTransfersPage] = useState(1)
  const [receivingPage, setReceivingPage] = useState(1)
  const [returnsPage, setReturnsPage] = useState(1)

  // Date range filter states
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Load adjustments
  const loadAdjustments = useCallback(async () => {
    if (!currentBusiness) {
      setIsLoadingAdjustments(false)
      return
    }
    
    setIsLoadingAdjustments(true)
    try {
      if (useReal) {
        const movements = await inventoryService.getMovements({
          movement_type: "adjustment",
          outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
        })
        
        const mappedAdjustments = (movements.results || []).map((m: any) => ({
          id: String(m.id),
          product_id: String(typeof m.product === 'object' ? (m.product?.id || "") : (m.product || "")),
          product_name: m.product_name || (typeof m.product === 'string' ? m.product : m.product?.name) || "N/A",
          outlet_name: m.outlet_name || (typeof m.outlet === 'object' ? (m.outlet?.name || "N/A") : "N/A"),
          outlet_id: typeof m.outlet === 'object' ? m.outlet?.id : m.outlet,
          reason: m.reason || "",
          quantity: m.quantity || 0,
          user_name: m.user_name || (typeof m.user === 'string' ? m.user : m.user?.email) || "System",
          date: m.created_at || m.date || new Date().toISOString(),
        }))
        setAdjustments(mappedAdjustments)
      }
    } catch (error) {
      console.error("Failed to load adjustments:", error)
    } finally {
      setIsLoadingAdjustments(false)
    }
  }, [currentBusiness, currentOutlet?.id, useReal])

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
          outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
        })
        
        const transferMap = new Map()
        const transferOutResults = (transferOutMovements.results || []).filter((movement: any) => {
          const reason = (movement.reason || "").toLowerCase()
          return !reason.includes("outlet return")
        })
        
        transferOutResults.forEach((movement: any) => {
          const transferId = `${movement.id}_${movement.product?.id || movement.product}_${movement.created_at}`
          
          if (!transferMap.has(transferId)) {
            // Extract from outlet name
            let fromOutletName = "N/A"
            if (movement.outlet_name) {
              fromOutletName = movement.outlet_name
            } else if (typeof movement.outlet === 'object' && movement.outlet?.name) {
              fromOutletName = movement.outlet.name
            } else if (movement.outlet) {
              const outletId = typeof movement.outlet === 'object' ? movement.outlet.id : movement.outlet
              const foundOutlet = outlets.find(o => o.id === outletId)
              if (foundOutlet) fromOutletName = foundOutlet.name
            }
            
            const toOutletId = movement.reference_id || null
            const toOutletName = toOutletId
              ? outlets.find(o => String(o.id) === String(toOutletId))?.name || "N/A"
              : "N/A"

            transferMap.set(transferId, {
              id: movement.id,
              product_name: movement.product_name || movement.product?.name || "N/A",
              from_outlet_name: fromOutletName,
              from_outlet_id: typeof movement.outlet === 'object' ? movement.outlet?.id : movement.outlet,
              to_outlet_name: toOutletName,
              to_outlet_id: toOutletId,
              quantity: movement.quantity,
              reason: movement.reason || "",
              user_name: movement.user_name || movement.user?.name || movement.user?.email || "System",
              date: movement.created_at,
              product_id: movement.product?.id || movement.product,
            })
          }
        })
        
        const transferInMovements = await inventoryService.getMovements({
          movement_type: "transfer_in",
          outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
        })
        
        const transferInResults = (transferInMovements.results || []).filter((movement: any) => {
          const reason = (movement.reason || "").toLowerCase()
          return !reason.includes("outlet return")
        })
        
        transferInResults.forEach((movement: any) => {
          // Try to match transfer_in with transfer_out by reference_id first, then by product and date
          const matchingTransfer = Array.from(transferMap.values()).find((t: any) => {
            // Match by destination outlet id + product + quantity + date
            const movementOutletId = movement.outlet?.id || movement.outlet
            const sameOutlet = t.to_outlet_id && String(t.to_outlet_id) === String(movementOutletId)
            // Fallback: match by product, quantity and same date
            const movementProductId = movement.product?.id || movement.product
            const sameProduct = (t.product_id === movementProductId) || 
                               (t.product_name === movement.product_name) ||
                               (t.product_name === (movement.product?.name))
            const sameQuantity = t.quantity === movement.quantity
            const sameDate = new Date(t.date).toDateString() === new Date(movement.created_at).toDateString()
            return sameOutlet && sameProduct && sameQuantity && sameDate
          })
          
          if (matchingTransfer) {
            // Get destination outlet name from the transfer_in movement
            let toOutletName = "N/A"
            if (movement.outlet_name) {
              toOutletName = movement.outlet_name
            } else if (typeof movement.outlet === 'object' && movement.outlet?.name) {
              toOutletName = movement.outlet.name
            } else if (movement.outlet) {
              const outletId = typeof movement.outlet === 'object' ? movement.outlet.id : movement.outlet
              const foundOutlet = outlets.find(o => o.id === outletId)
              if (foundOutlet) {
                toOutletName = foundOutlet.name
              }
            }
            
            matchingTransfer.to_outlet_name = toOutletName
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
  }, [currentBusiness, currentOutlet?.id, outlets, useReal])

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
          outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
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
              item_names: new Set<string>(),
              items: [],
              outlet_id: outletId,
              user_name: movement.user_name || movement.user?.name || movement.user?.email || "System",
            })
          }
          
          const receiving = receivingMap.get(key)
          const productName = movement.product_name || movement.product?.name
          if (productName) {
            receiving.item_names.add(productName)
          }
          receiving.items.push({
            movement_id: movement.id,
            product_id: String(movement.product?.id || movement.product || ""),
            product_name: productName || "N/A",
            quantity: String(movement.quantity || 0),
          })
          receiving.total_items += 1
          receiving.total_quantity += movement.quantity || 0
          if (!receiving.reason && movement.reason) {
            receiving.reason = movement.reason
          }
        })

        const receivingList = Array.from(receivingMap.values()).map((rec: any) => {
          const itemNames = Array.from(rec.item_names)
          return {
            ...rec,
            item_names: itemNames,
            item_preview: itemNames.slice(0, 2).join(", "),
            item_more_count: itemNames.length > 2 ? itemNames.length - 2 : 0,
          }
        })

        setReceiving(receivingList)
      } else {
        setReceiving([])
      }
    } catch (error) {
      console.error("Failed to load receiving:", error)
      setReceiving([])
    } finally {
      setIsLoadingReceiving(false)
    }
  }, [currentBusiness, currentOutlet?.id, outlets, useReal])

  const loadProducts = useCallback(async () => {
    try {
      const response = await productService.list({
        is_active: true,
        outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
      })
      setProducts(response.results || [])
    } catch (error) {
      console.error("Failed to load products:", error)
    }
  }, [currentOutlet?.id])

  // Load returns
  const loadReturns = useCallback(async () => {
    if (!currentBusiness || !currentOutletId) {
      setReturns([])
      setIsLoadingReturns(false)
      return
    }
    
    setIsLoadingReturns(true)
    try {
      const response = await returnService.list({
        outlet: currentOutletId,
      })
      setReturns(response.results || [])
    } catch (error) {
      console.error("Failed to load returns:", error)
      setReturns([])
    } finally {
      setIsLoadingReturns(false)
    }
  }, [currentBusiness, currentOutletId])

  // Load all data when component mounts or tab changes
  useEffect(() => {
    loadAdjustments()
    loadTransfers()
    loadReceiving()
    loadReturns()
    loadProducts()
  }, [loadAdjustments, loadTransfers, loadReceiving, loadReturns, loadProducts])

  const getResolvedProductName = (item: any) => {
    const currentName = products.find((p) => String(p.id) === String(item.product_id))?.name
    return currentName || item.product_name || "N/A"
  }

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
        return "/dashboard/inventory/stock-control/adjust-stock"
      case "transferred":
        return "/dashboard/inventory/stock-control/transfer-stock"
      case "received":
        return "/dashboard/inventory/stock-control/receive-stock"
      case "returned":
        return "/dashboard/inventory/stock-control/return-stock"
      default:
        return "#"
    }
  }

  // Filter data by date range
  const filterByDateRange = (items: any[]) => {
    if (!startDate && !endDate) return items

    return items.filter((item) => {
      const itemDate = new Date(item.date)
      if (startDate) {
        const start = new Date(startDate)
        if (itemDate < start) return false
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        if (itemDate > end) return false
      }
      return true
    })
  }

  // Apply filters to all data
  const filteredAdjustments = filterByDateRange(adjustments)
  const filteredTransfers = filterByDateRange(transfers)
  const filteredReceiving = filterByDateRange(receiving)
  const filteredReturns = filterByDateRange(returns)

  const totalAdjustmentsPages = Math.max(1, Math.ceil(filteredAdjustments.length / pageSize))
  const totalTransfersPages = Math.max(1, Math.ceil(filteredTransfers.length / pageSize))
  const totalReceivingPages = Math.max(1, Math.ceil(filteredReceiving.length / pageSize))
  const totalReturnsPages = Math.max(1, Math.ceil(filteredReturns.length / pageSize))

  const paginatedAdjustments = filteredAdjustments.slice(
    (adjustmentsPage - 1) * pageSize,
    adjustmentsPage * pageSize
  )
  const paginatedTransfers = filteredTransfers.slice(
    (transfersPage - 1) * pageSize,
    transfersPage * pageSize
  )
  const paginatedReceiving = filteredReceiving.slice(
    (receivingPage - 1) * pageSize,
    receivingPage * pageSize
  )
  const paginatedReturns = filteredReturns.slice(
    (returnsPage - 1) * pageSize,
    returnsPage * pageSize
  )

  useEffect(() => {
    setAdjustmentsPage(1)
    setTransfersPage(1)
    setReceivingPage(1)
    setReturnsPage(1)
  }, [startDate, endDate, activeTab])

  useEffect(() => {
    setAdjustmentsPage((prev) => Math.min(prev, totalAdjustmentsPages))
  }, [totalAdjustmentsPages])

  useEffect(() => {
    setTransfersPage((prev) => Math.min(prev, totalTransfersPages))
  }, [totalTransfersPages])

  useEffect(() => {
    setReceivingPage((prev) => Math.min(prev, totalReceivingPages))
  }, [totalReceivingPages])

  useEffect(() => {
    setReturnsPage((prev) => Math.min(prev, totalReturnsPages))
  }, [totalReturnsPages])

  const renderPagination = (
    totalItems: number,
    currentPage: number,
    totalPages: number,
    onPageChange: (page: number) => void
  ) => {
    if (totalItems <= pageSize) return null

    const startIndex = (currentPage - 1) * pageSize + 1
    const endIndex = Math.min(currentPage * pageSize, totalItems)

    return (
      <div className="flex flex-col gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Showing {startIndex}-{endIndex} of {totalItems}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
          </div>
        </div>
      </div>
    )
  }

  // Date range picker state
  const [showDatePicker, setShowDatePicker] = useState(false)

  return (
    <DashboardLayout>
      <PageLayout
        title={t("inventory.menu.stock_control")}
        description={t("inventory.stock_control_description")}
        actions={null}
      >
        <FilterableTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          actionButtonPlacement="below"
          actionButton={
            <div className="flex flex-wrap items-center gap-2">
              <Link href={getAddButtonRoute(activeTab)}>
              <Button
                className="bg-blue-900 hover:bg-blue-800 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                {activeTab === "adjusts"
                  ? "Adjust Stock"
                  : activeTab === "transferred"
                  ? "Transfer Stock"
                  : activeTab === "received"
                  ? "Receive Stock"
                  : "Return Stock"}
              </Button>
              </Link>
              <div className="relative">
                <Button
                  size="sm"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="bg-blue-900 hover:bg-blue-800 text-white gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  {startDate || endDate ? `${startDate} to ${endDate}` : "Date Range"}
                </Button>

                {showDatePicker && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 min-w-max">
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700">From:</label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700">To:</label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        {(startDate || endDate) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setStartDate('')
                              setEndDate('')
                            }}
                            className="text-xs flex-1"
                          >
                            Clear
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => setShowDatePicker(false)}
                          className="text-xs flex-1"
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          }
        >
          {/* Stock Adjusts Tab */}
          <TabsContent value="adjusts" className="space-y-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Adjustment History</h3>
                <p className="text-sm text-gray-600">
                  {filteredAdjustments.length} of {adjustments.length} adjustment{adjustments.length !== 1 ? "s" : ""} found
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingAdjustments ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-600">
                          Loading adjustments...
                        </TableCell>
                      </TableRow>
                    ) : filteredAdjustments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-600">
                          {adjustments.length === 0 ? "No adjustments found" : "No adjustments in selected date range"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedAdjustments.map((adjustment) => (
                        <TableRow key={adjustment.id} className="border-gray-300">
                          <TableCell className="font-medium">
                            {adjustment.date
                              ? format(new Date(adjustment.date), "MMM dd, yyyy HH:mm")
                              : "N/A"}
                          </TableCell>
                          <TableCell>{getResolvedProductName(adjustment)}</TableCell>
                          <TableCell>{adjustment.outlet_name}</TableCell>
                          <TableCell>{adjustment.reason || "-"}</TableCell>
                          <TableCell>
                            <span className={adjustment.quantity > 0 ? "text-green-600" : "text-red-600"}>
                              {adjustment.quantity > 0 ? "+" : ""}{adjustment.quantity}
                            </span>
                          </TableCell>
                          <TableCell>{adjustment.user_name}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {renderPagination(
                  filteredAdjustments.length,
                  adjustmentsPage,
                  totalAdjustmentsPages,
                  setAdjustmentsPage
                )}
              </div>
            </div>
          </TabsContent>

          {/* Stock Transferred Tab */}
          <TabsContent value="transferred" className="space-y-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Transfer History</h3>
                <p className="text-sm text-gray-600">
                  {filteredTransfers.length} of {transfers.length} transfer{transfers.length !== 1 ? "s" : ""} found
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
                      <TableHead className="text-gray-900 font-semibold">User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingTransfers ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          Loading transfers...
                        </TableCell>
                      </TableRow>
                    ) : filteredTransfers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          {transfers.length === 0 ? "No transfers found" : "No transfers in selected date range"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTransfers.map((transfer) => (
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
                          <TableCell>{transfer.user_name || "System"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {renderPagination(
                  filteredTransfers.length,
                  transfersPage,
                  totalTransfersPages,
                  setTransfersPage
                )}
              </div>
            </div>
          </TabsContent>

          {/* Stock Received Tab */}
          <TabsContent value="received" className="space-y-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Receiving History</h3>
                <p className="text-sm text-gray-600">
                  {filteredReceiving.length} of {receiving.length} receiving record{receiving.length !== 1 ? "s" : ""} found
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
                      <TableHead className="text-gray-900 font-semibold">Item Names</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Total Quantity</TableHead>
                      <TableHead className="text-gray-900 font-semibold">Reason</TableHead>
                      <TableHead className="text-gray-900 font-semibold">User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingReceiving ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-600">
                          Loading receiving records...
                        </TableCell>
                      </TableRow>
                    ) : filteredReceiving.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-600">
                          {receiving.length === 0 ? "No receiving records found" : "No receiving records in selected date range"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedReceiving.map((rec) => (
                        <TableRow key={rec.id} className="border-gray-300">
                          <TableCell className="font-medium">
                            {rec.date
                              ? format(new Date(rec.date), "MMM dd, yyyy HH:mm")
                              : "N/A"}
                          </TableCell>
                          <TableCell>{rec.supplier}</TableCell>
                          <TableCell>{rec.outlet_name}</TableCell>
                          <TableCell>{rec.total_items}</TableCell>
                          <TableCell>
                            {rec.item_preview || "-"}
                            {rec.item_more_count > 0 && (
                              <span className="text-xs text-muted-foreground"> +{rec.item_more_count} more</span>
                            )}
                          </TableCell>
                          <TableCell>{rec.total_quantity}</TableCell>
                          <TableCell>{rec.reason || "-"}</TableCell>
                          <TableCell>{rec.user_name || "System"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {renderPagination(
                  filteredReceiving.length,
                  receivingPage,
                  totalReceivingPages,
                  setReceivingPage
                )}
              </div>
            </div>
          </TabsContent>

          {/* Stock Returned Tab */}
          <TabsContent value="returned" className="space-y-6">
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Return History</h3>
                <p className="text-sm text-gray-600">
                  {filteredReturns.length} of {returns.length} return{returns.length !== 1 ? "s" : ""} found
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
                      <TableHead className="text-gray-900 font-semibold">Reason</TableHead>
                      <TableHead className="text-gray-900 font-semibold">User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingReturns ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          Loading returns...
                        </TableCell>
                      </TableRow>
                    ) : filteredReturns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
                          {returns.length === 0 ? "No returns found" : "No returns in selected date range"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedReturns.map((returnItem) => (
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
                            {returnItem.outlet_name || returnItem.outlet?.name || 
                             (returnItem.outlet_id && typeof returnItem.outlet_id === 'string' ? 
                               outlets.find(o => String(o.id) === returnItem.outlet_id)?.name : 
                               outlets.find(o => o.id === returnItem.outlet_id)?.name
                             ) || 
                             "N/A"}
                          </TableCell>
                          <TableCell>{returnItem.items?.length || 0}</TableCell>
                          <TableCell>{returnItem.reason || "-"}</TableCell>
                          <TableCell>{returnItem.user_name || "System"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {renderPagination(
                  filteredReturns.length,
                  returnsPage,
                  totalReturnsPages,
                  setReturnsPage
                )}
              </div>
            </div>
          </TabsContent>
        </FilterableTabs>
      </PageLayout>

    </DashboardLayout>
  )
}

