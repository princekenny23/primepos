"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
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
  Eye,
  Calendar,
  MoreVertical,
  Edit,
  Trash2
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { inventoryService } from "@/lib/services/inventoryService"
import { returnService, type Return } from "@/lib/services/returnService"
import { useBusinessStore } from "@/stores/businessStore"
import { useRealAPI } from "@/lib/utils/api-config"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button"
import { useI18n } from "@/contexts/i18n-context"
import { StockAdjustmentModal } from "@/components/modals/stock-adjustment-modal"
import { TransferStockModal } from "@/components/modals/transfer-stock-modal"
import { ReceiveStockModal } from "@/components/modals/receive-stock-modal"
import { NewReturnModal } from "@/components/modals/new-return-modal"
import { useToast } from "@/components/ui/use-toast"
import { productService } from "@/lib/services/productService"
import type { Product } from "@/lib/types"
import { purchaseReturnService } from "@/lib/services/purchaseReturnService"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function StockControlPage() {
  const router = useRouter()
  const { currentBusiness, currentOutlet, outlets } = useBusinessStore()
  const [activeTab, setActiveTab] = useState<string>("adjusts")
  const pageSize = 15
  const useReal = useRealAPI()
  const { t } = useI18n()
  const { toast } = useToast()

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
  }, [currentBusiness, outlets, useReal])

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
  }, [currentBusiness, outlets, useReal])

  const loadProducts = useCallback(async () => {
    try {
      const response = await productService.list({ is_active: true })
      setProducts(response.results || [])
    } catch (error) {
      console.error("Failed to load products:", error)
    }
  }, [])

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
  }, [loadAdjustments, loadTransfers, loadReceiving, loadReturns])

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

  // Modal states
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [detailsPayload, setDetailsPayload] = useState<{
    item: any
    type: string
    mode: "view" | "edit"
  } | null>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{
    item: any
    type: string
  } | null>(null)

  const [editForm, setEditForm] = useState<{
    reason: string
    quantity: string
    product_id: string
    outlet_id: string
    to_outlet_id: string
    supplier: string
    return_number: string
    status: string
    notes: string
    items: Array<{ id?: string; movement_id?: string; product_id: string; quantity: string; unit_price?: string }>
  }>({
    reason: "",
    quantity: "",
    product_id: "",
    outlet_id: "",
    to_outlet_id: "",
    supplier: "",
    return_number: "",
    status: "",
    notes: "",
    items: [],
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const isEditableType = (type?: string) =>
    type === "adjustment" || type === "transfer" || type === "receiving" || type === "return"

  const openDetails = (item: any, type: string, mode: "view" | "edit") => {
    setDetailsPayload({ item, type, mode })
    if (mode === "edit") {
      loadProducts()
      setEditForm({
        reason: item.reason || "",
        quantity: typeof item.quantity !== "undefined" ? String(item.quantity) : "",
        product_id: String(item.product_id || ""),
        outlet_id: String(item.from_outlet_id || item.outlet_id || item.outlet?.id || ""),
        to_outlet_id: String(item.to_outlet_id || ""),
        supplier: String(item.supplier || ""),
        return_number: String(item.return_number || ""),
        status: String(item.status || ""),
        notes: String(item.notes || ""),
        items: Array.isArray(item.items)
          ? item.items.map((i: any) => ({
              id: i.id,
              movement_id: i.movement_id || i.id,
              product_id: String(i.product_id || ""),
              quantity: String(i.quantity ?? ""),
              unit_price: i.unit_price,
            }))
          : [],
      })
    }
    setDetailsDialogOpen(true)
  }

  const handleView = (item: any, type: string) => {
    openDetails(item, type, "view")
  }

  const handleEdit = (item: any, type: string) => {
    openDetails(item, type, "edit")
  }

  const handleDelete = (item: any, type: string) => {
    setPendingDelete({ item, type })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const { item, type } = pendingDelete
    const id = String(item.id)

    if (type === "adjustment") {
      setAdjustments((prev) => prev.filter((a) => String(a.id) !== id))
    } else if (type === "transfer") {
      setTransfers((prev) => prev.filter((t) => String(t.id) !== id))
    } else if (type === "receiving") {
      setReceiving((prev) => prev.filter((r) => String(r.id) !== id))
    } else if (type === "return") {
      setReturns((prev) => prev.filter((r) => String(r.id) !== id))
    }

    setDeleteDialogOpen(false)
    setPendingDelete(null)
  }

  const getSupplierReturnId = (id: string) => {
    const parts = id.split("_")
    return parts.length > 1 ? parts[1] : id
  }

  const handleSupplierApprove = async (returnItem: Return) => {
    try {
      const supplierId = getSupplierReturnId(String(returnItem.id))
      await purchaseReturnService.approve(supplierId)
      setReturns((prev) =>
        prev.map((r) =>
          String(r.id) === String(returnItem.id) ? { ...r, status: "approved" } : r
        )
      )
      toast({ title: "Approved", description: "Supplier return approved." })
    } catch (error: any) {
      toast({
        title: "Approve failed",
        description: error?.message || "Could not approve supplier return.",
        variant: "destructive",
      })
    }
  }

  const handleSupplierComplete = async (returnItem: Return) => {
    try {
      const supplierId = getSupplierReturnId(String(returnItem.id))
      await purchaseReturnService.complete(supplierId)
      setReturns((prev) =>
        prev.map((r) =>
          String(r.id) === String(returnItem.id) ? { ...r, status: "returned" } : r
        )
      )
      toast({ title: "Completed", description: "Supplier return marked as returned." })
    } catch (error: any) {
      toast({
        title: "Complete failed",
        description: error?.message || "Could not complete supplier return.",
        variant: "destructive",
      })
    }
  }

  const handleSaveEdit = async () => {
    if (!detailsPayload) return
    const { item, type } = detailsPayload

    if (!isEditableType(type)) {
      toast({
        title: "Not editable",
        description: "Editing is only available for adjustments and transfers.",
        variant: "destructive",
      })
      return
    }

    if ((type === "adjustment" || type === "transfer") && !editForm.quantity) {
      toast({
        title: "Validation Error",
        description: "Quantity is required.",
        variant: "destructive",
      })
      return
    }

    setIsSavingEdit(true)
    try {
      const allowedReturnStatuses = [
        "draft",
        "pending",
        "approved",
        "returned",
        "cancelled",
      ] as const
      type ReturnStatus = (typeof allowedReturnStatuses)[number]
      const sanitizedStatus = allowedReturnStatuses.includes(editForm.status as ReturnStatus)
        ? (editForm.status as ReturnStatus)
        : undefined

      if (type === "adjustment") {
        const updatePayload: Record<string, any> = {
          reason: editForm.reason,
          quantity: Number(editForm.quantity),
        }
        if (editForm.product_id) updatePayload.product_id = editForm.product_id
        if (editForm.outlet_id) updatePayload.outlet = editForm.outlet_id

        await inventoryService.updateMovement(String(item.id), updatePayload)

        setAdjustments((prev) =>
          prev.map((a) =>
            String(a.id) === String(item.id)
              ? {
                  ...a,
                  reason: editForm.reason,
                  quantity: Number(editForm.quantity),
                  product_id: editForm.product_id,
                  outlet_id: editForm.outlet_id,
                }
              : a
          )
        )
      } else if (type === "transfer") {
        const updatePayload: Record<string, any> = {
          reason: editForm.reason,
          quantity: Number(editForm.quantity),
        }
        if (editForm.product_id) updatePayload.product_id = editForm.product_id
        if (editForm.outlet_id) updatePayload.outlet = editForm.outlet_id
        if (editForm.to_outlet_id) updatePayload.reference_id = editForm.to_outlet_id

        await inventoryService.updateMovement(String(item.id), updatePayload)

        setTransfers((prev) =>
          prev.map((t) =>
            String(t.id) === String(item.id)
              ? {
                  ...t,
                  reason: editForm.reason,
                  quantity: Number(editForm.quantity),
                  product_id: editForm.product_id,
                  from_outlet_id: editForm.outlet_id,
                  to_outlet_id: editForm.to_outlet_id,
                }
              : t
          )
        )
      } else if (type === "receiving") {
        const items = editForm.items || []
        await Promise.all(
          items.map((entry) =>
            entry.movement_id
              ? inventoryService.updateMovement(String(entry.movement_id), {
                  product_id: entry.product_id,
                  quantity: Number(entry.quantity),
                  reason: editForm.reason,
                  outlet: editForm.outlet_id || item.outlet_id,
                  reference_id: editForm.supplier || item.supplier,
                })
              : Promise.resolve()
          )
        )

        const totalQuantity = items.reduce(
          (sum, entry) => sum + Number(entry.quantity || 0),
          0
        )
        setReceiving((prev) =>
          prev.map((r) =>
            String(r.id) === String(item.id)
              ? {
                  ...r,
                  supplier: editForm.supplier,
                  outlet_id: editForm.outlet_id,
                  reason: editForm.reason,
                  items: items.map((i) => ({
                    movement_id: i.movement_id,
                    product_id: i.product_id,
                    quantity: i.quantity,
                  })),
                  total_items: items.length,
                  total_quantity: totalQuantity,
                }
              : r
          )
        )
      } else if (type === "return") {
        const rawId = String(item.id || "")
        const [returnType, returnId] = rawId.split("_")

        if (returnType === "supplier") {
          await purchaseReturnService.update(returnId, {
            reason: editForm.reason,
            notes: editForm.notes,
            status: sanitizedStatus,
            return_number: editForm.return_number,
            items_data: editForm.items.map((i) => ({
              product_id: Number(i.product_id),
              quantity: Number(i.quantity),
              unit_price: i.unit_price || "0",
              reason: editForm.reason,
            })),
          })
        } else {
          await Promise.all(
            editForm.items.map((entry) =>
              entry.id
                ? inventoryService.updateMovement(String(entry.id), {
                    product_id: entry.product_id,
                    quantity: Number(entry.quantity),
                    reason: editForm.reason,
                    reference_id: editForm.return_number || item.return_number,
                  })
                : Promise.resolve()
            )
          )
        }

        setReturns((prev) =>
          prev.map((r) =>
            String(r.id) === String(item.id)
              ? {
                  ...r,
                  reason: editForm.reason,
                  notes: editForm.notes,
                  status: sanitizedStatus ?? r.status,
                  return_number: editForm.return_number,
                  items: editForm.items.map((i) => ({
                    id: i.id,
                    product_id: i.product_id,
                    quantity: Number(i.quantity),
                  })),
                }
              : r
          )
        )
      }

      toast({ title: "Updated", description: "Changes saved successfully." })
      setDetailsDialogOpen(false)
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.message || "Could not save changes.",
        variant: "destructive",
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const renderDetailsContent = () => {
    if (!detailsPayload) return null

    const { item, type } = detailsPayload
    const formattedDate = item?.date || item?.created_at
      ? format(new Date(item.date || item.created_at), "MMM dd, yyyy")
      : "N/A"

    const rows: Array<{ label: string; value: ReactNode }> = []

    if (type === "adjustment") {
      rows.push(
        { label: "Product", value: item.product_name || "N/A" },
        { label: "Outlet", value: item.outlet_name || "N/A" },
        { label: "Quantity", value: item.quantity ?? 0 },
        { label: "Reason", value: item.reason || "-" },
        { label: "User", value: item.user_name || "System" },
        { label: "Date", value: formattedDate }
      )
    } else if (type === "transfer") {
      rows.push(
        { label: "Product", value: item.product_name || "N/A" },
        { label: "From Outlet", value: item.from_outlet_name || "N/A" },
        { label: "To Outlet", value: item.to_outlet_name || "N/A" },
        { label: "Quantity", value: item.quantity ?? 0 },
        { label: "Reason", value: item.reason || "-" },
        { label: "Date", value: formattedDate }
      )
    } else if (type === "receiving") {
      rows.push(
        { label: "Supplier", value: item.supplier || "Unknown Supplier" },
        { label: "Outlet", value: item.outlet_name || "N/A" },
        { label: "Items", value: item.total_items ?? 0 },
        { label: "Total Quantity", value: item.total_quantity ?? 0 },
        { label: "Reason", value: item.reason || "-" },
        { label: "Date", value: formattedDate }
      )
      if (Array.isArray(item.item_names) && item.item_names.length > 0) {
        rows.push({ label: "Item Names", value: item.item_names.join(", ") })
      }
    } else if (type === "return") {
      rows.push(
        { label: "Return #", value: item.return_number || "-" },
        { label: "Outlet", value: item.outlet?.name || "N/A" },
        { label: "Items", value: item.items?.length ?? 0 },
        { label: "Status", value: item.status || "Pending" },
        { label: "Reason", value: item.reason || "-" },
        { label: "Date", value: formattedDate }
      )
    }

    return (
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-muted-foreground">{row.label}</div>
            <div className="col-span-2 font-medium text-gray-900">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderEditContent = () => {
    if (!detailsPayload) return null
    const { type } = detailsPayload

    return (
      <div className="space-y-4">
        {(type === "adjustment" || type === "transfer") && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Quantity</label>
            <Input
              type="number"
              value={editForm.quantity}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, quantity: e.target.value }))
              }
            />
          </div>
        )}
        {(type === "adjustment" || type === "transfer") && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Product</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={editForm.product_id}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, product_id: e.target.value }))
              }
              aria-label="Product"
              title="Product"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {(type === "adjustment" || type === "transfer" || type === "receiving") && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Outlet</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={editForm.outlet_id}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, outlet_id: e.target.value }))
              }
              aria-label="Outlet"
              title="Outlet"
            >
              <option value="">Select outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {type === "transfer" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">To Outlet</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={editForm.to_outlet_id}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, to_outlet_id: e.target.value }))
              }
              aria-label="To outlet"
              title="To outlet"
            >
              <option value="">Select outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {type === "receiving" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Supplier</label>
            <Input
              value={editForm.supplier}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, supplier: e.target.value }))
              }
            />
          </div>
        )}
        {type === "return" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Return #</label>
              <Input
                value={editForm.return_number}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, return_number: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Status</label>
              <Input
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, status: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <Input
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Reason</label>
          <Input
            value={editForm.reason}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, reason: e.target.value }))
            }
          />
        </div>
        {(type === "receiving" || type === "return") && editForm.items.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Items</div>
            {editForm.items.map((itemEntry, index) => (
              <div key={itemEntry.id || itemEntry.movement_id || index} className="grid grid-cols-3 gap-3">
                <select
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={itemEntry.product_id}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      items: prev.items.map((it, idx) =>
                        idx === index ? { ...it, product_id: e.target.value } : it
                      ),
                    }))
                  }
                  aria-label="Item product"
                  title="Item product"
                >
                  <option value="">Select product</option>
                  {products.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={itemEntry.quantity}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      items: prev.items.map((it, idx) =>
                        idx === index ? { ...it, quantity: e.target.value } : it
                      ),
                    }))
                  }
                />
                <Input
                  placeholder="Unit price"
                  value={itemEntry.unit_price || ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      items: prev.items.map((it, idx) =>
                        idx === index ? { ...it, unit_price: e.target.value } : it
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

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
              <Button
                onClick={() => {
                  if (activeTab === "adjusts") {
                    setShowAdjustmentModal(true)
                  } else if (activeTab === "transferred") {
                    setShowTransferModal(true)
                  } else if (activeTab === "received") {
                    setShowReceiveModal(true)
                  } else if (activeTab === "returned") {
                    setShowReturnModal(true)
                  }
                }}
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
                    ) : filteredAdjustments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
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
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="border-gray-300">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(adjustment, "adjustment")}> 
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(adjustment, "adjustment")}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(adjustment, "adjustment")}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
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
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="border-gray-300">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(transfer, "transfer")}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(transfer, "transfer")}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(transfer, "transfer")}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
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
                    ) : filteredReceiving.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-600">
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
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="border-gray-300">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(rec, "receiving")}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(rec, "receiving")}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(rec, "receiving")}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
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
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="border-gray-300">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(returnItem, "return")}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(returnItem, "return")}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {returnItem.return_type === "supplier" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleSupplierApprove(returnItem)}
                                      disabled={returnItem.status !== "pending"}
                                    >
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleSupplierComplete(returnItem)}
                                      disabled={returnItem.status !== "approved"}
                                    >
                                      Mark Returned
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(returnItem, "return")}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
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

      <StockAdjustmentModal
        open={showAdjustmentModal}
        onOpenChange={setShowAdjustmentModal}
        onSuccess={() => {
          loadAdjustments()
          setShowAdjustmentModal(false)
        }}
      />

      <TransferStockModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        onSuccess={() => {
          loadTransfers()
          setShowTransferModal(false)
        }}
      />

      <ReceiveStockModal
        open={showReceiveModal}
        onOpenChange={setShowReceiveModal}
        onSuccess={() => {
          loadReceiving()
          setShowReceiveModal(false)
        }}
      />

      <NewReturnModal
        open={showReturnModal}
        onOpenChange={setShowReturnModal}
        onReturnCreated={() => {
          loadReturns()
          setShowReturnModal(false)
        }}
      />

      <Dialog
        open={detailsDialogOpen}
        onOpenChange={(open) => {
          setDetailsDialogOpen(open)
          if (!open) setDetailsPayload(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {detailsPayload?.mode === "edit" ? "Edit" : "View"}{" "}
              {detailsPayload?.type ?? "Item"}
            </DialogTitle>
            <DialogDescription>
              {detailsPayload?.mode === "edit"
                ? "Editing is not available yet. Review the item details below."
                : "Item details"}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/30 p-4">
            {detailsPayload?.mode === "edit" ? renderEditContent() : renderDetailsContent()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
            {detailsPayload?.mode === "edit" && isEditableType(detailsPayload?.type) && (
              <Button onClick={handleSaveEdit} disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected {pendingDelete?.type ?? "item"} from the
              list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

