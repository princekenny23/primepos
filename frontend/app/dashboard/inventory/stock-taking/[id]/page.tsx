"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, Save, ArrowLeft, CheckCircle2, Upload, Download, Menu } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { inventoryService } from "@/lib/services/inventoryService"
import { productService } from "@/lib/services/productService"
import { useToast } from "@/components/ui/use-toast"
import { exportToXLSX, type ExportColumn } from "@/lib/services/exportService"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { PageLoading } from "@/components/ui/page-loading"
import { APP_REFRESH_EVENT } from "@/lib/utils/page-refresh"

interface StockTakingItem {
  id: string
  product_id: string
  product_name: string
  sku: string
  barcode: string
  isActive: boolean
  quantityBefore: number
  expectedQty: number
  countedQty: number
  difference: number
  quantityAfter: number
  isCounted: boolean
  notes?: string
}

interface ImportRejectedItem {
  rowNumber: number
  productName: string
  sku: string
  barcode: string
  quantityBefore: number
  countedQuantity: number
  quantityAfter: number
  reason: string
  status: string
}

export default function StockTakingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const stockTakeId = params.id as string
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState<"all" | "remaining" | "counted">("all")
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<StockTakingItem | null>(null)
  const [editCountValue, setEditCountValue] = useState("")
  const [items, setItems] = useState<StockTakingItem[]>([])
  const [stockTake, setStockTake] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingCount, setIsSavingCount] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rejectedPage, setRejectedPage] = useState(1)
  const [importRejectedPage, setImportRejectedPage] = useState(1)
  const [searchPage, setSearchPage] = useState(1)
  const [stockViewTab, setStockViewTab] = useState("counted-stock")
  const [importRejectedItems, setImportRejectedItems] = useState<ImportRejectedItem[]>([])
  const [isLoadingImportRejected, setIsLoadingImportRejected] = useState(false)
  const itemsPerPage = 10
  const [isCompleting, setIsCompleting] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isExportingSession, setIsExportingSession] = useState(false)
  useEffect(() => {
    loadStockTakeData()
    const handleRefresh = () => { void loadStockTakeData() }
    window.addEventListener(APP_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(APP_REFRESH_EVENT, handleRefresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockTakeId])

  useEffect(() => {
    if (searchParams?.get("focus") === "remaining") {
      setSearchFilter("remaining")
      setSearchOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    setCurrentPage(1)
    setRejectedPage(1)
    setImportRejectedPage(1)
    setSearchPage(1)
  }, [items.length, importRejectedItems.length, searchTerm, searchFilter])

  useEffect(() => {
    const loadImportRejectedRows = async () => {
      setIsLoadingImportRejected(true)
      try {
        const history = await inventoryService.getStockTakeImportHistory(stockTakeId, {
          page: 1,
          pageSize: 1,
        })

        const latestBatch = history.results?.[0]
        if (!latestBatch?.batch_id) {
          setImportRejectedItems([])
          return
        }

        const firstPage = await inventoryService.getStockTakeImportRows(latestBatch.batch_id, {
          page: 1,
          pageSize: 1000,
        })

        const allRows = [...(firstPage.results || [])]
        const totalPages = Math.max(1, Number(firstPage.total_pages || 1))
        for (let page = 2; page <= totalPages; page += 1) {
          const pageResponse = await inventoryService.getStockTakeImportRows(latestBatch.batch_id, {
            page,
            pageSize: 1000,
          })
          allRows.push(...(pageResponse.results || []))
        }

        const rejected = allRows
          .filter((row) => row.status === "Rejected" || row.status === "Failed")
          .map((row) => ({
            rowNumber: row.row_number,
            productName: row.product_name || "-",
            sku: row.sku || "-",
            barcode: row.barcode || "-",
            quantityBefore: Number(row.quantity_before || 0),
            countedQuantity: Number(row.counted_quantity || 0),
            quantityAfter: Number(row.quantity_after || 0),
            reason: row.reason || row.suggested_resolution || "-",
            status: row.status,
          }))

        setImportRejectedItems(rejected)
      } catch (error) {
        console.error("Failed to load import rejected rows:", error)
        setImportRejectedItems([])
      } finally {
        setIsLoadingImportRejected(false)
      }
    }

    loadImportRejectedRows()
  }, [stockTakeId])

  const loadStockTakeData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setLoadError(null)
    try {
      const [stockTakeData, itemsData] = await Promise.all([
        inventoryService.getStockTake(stockTakeId),
        inventoryService.getStockTakeItems(stockTakeId),
      ])
      
      setStockTake(stockTakeData)
      
      const transformedItems: StockTakingItem[] = itemsData.map((item: any) => {
        // Ensure we parse the counted_quantity correctly
        const countedQty = typeof item.counted_quantity === 'number' 
          ? item.counted_quantity 
          : parseInt(String(item.counted_quantity || 0))
        const expectedQty = typeof item.expected_quantity === 'number'
          ? item.expected_quantity
          : parseInt(String(item.expected_quantity || 0))
        const difference = typeof item.difference === 'number'
          ? item.difference
          : parseInt(String(item.difference || 0))
        const isCounted =
          (typeof item.is_counted === "boolean" && item.is_counted) ||
          Boolean(item.counted_at) ||
          countedQty > 0
        
        const transformed = {
          id: String(item.id),
          product_id: String(item.product?.id || item.product_id || ""),
          product_name: item.product?.name || "Unknown Product",
          sku: item.product?.sku || "",
          barcode: item.product?.barcode || "",
          isActive: item.product?.is_active !== false,
          quantityBefore: expectedQty,
          expectedQty: expectedQty,
          countedQty: countedQty,
          difference: difference,
          quantityAfter: expectedQty + difference,
          isCounted: isCounted,
          notes: item.notes || "",
        }
        
        return transformed
      })
      
      const allItems = transformedItems
      setItems(allItems)
    } catch (error) {
      console.error("Failed to load stock take data:", error)
      const status = (error as any)?.status
      if (status === 404) {
        setLoadError("This stock take was not found for your current outlet or may have been deleted.")
      } else {
        setLoadError("Failed to load stock take data. Please try again.")
      }
      toast({
        title: "Error",
        description: status === 404
          ? "Stock take not found for the current outlet."
          : "Failed to load stock take data. Please try again.",
        variant: "destructive",
      })
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }

  // Filter items for search dropdown (with filter options)
  const searchableItems = useMemo(() => {
    return items.filter(item => {
      // Apply search term filter
      const matchesSearch = !searchTerm || (
        item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode.toLowerCase().includes(searchTerm.toLowerCase())
      )
      
      // Apply status filter
      const matchesFilter = 
        searchFilter === "all" ||
        (searchFilter === "counted" && item.isCounted) ||
        (searchFilter === "remaining" && !item.isCounted)
      
      return matchesSearch && matchesFilter
    })
  }, [items, searchTerm, searchFilter])

  const paginatedSearchableItems = useMemo(() => {
    const startIndex = (searchPage - 1) * itemsPerPage
    return searchableItems.slice(startIndex, startIndex + itemsPerPage)
  }, [searchableItems, searchPage, itemsPerPage])

  // Filter items for stock count table (only counted items with countedQty > 0)
  const countedItems = useMemo(() => {
    const filtered = items
      .filter(item => {
        return item.isCounted
      })
      .sort((a, b) => a.product_name.localeCompare(b.product_name))
    
    console.log("Counted items filter:", {
      totalItems: items.length,
      countedItems: filtered.length,
      itemsWithCountedQty: items.filter(i => i.countedQty > 0).length,
      sampleItems: filtered.slice(0, 3).map(i => ({
        id: i.id,
        name: i.product_name,
        countedQty: i.countedQty,
        isCounted: i.isCounted
      }))
    })
    
    return filtered
  }, [items])

  const paginatedCountedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return countedItems.slice(startIndex, startIndex + itemsPerPage)
  }, [countedItems, currentPage, itemsPerPage])

  const rejectedItems = useMemo(() => {
    return items
      .filter((item) => !item.isCounted)
      .sort((a, b) => a.product_name.localeCompare(b.product_name))
  }, [items])

  const paginatedRejectedItems = useMemo(() => {
    const startIndex = (rejectedPage - 1) * itemsPerPage
    return rejectedItems.slice(startIndex, startIndex + itemsPerPage)
  }, [rejectedItems, rejectedPage, itemsPerPage])

  const paginatedImportRejectedItems = useMemo(() => {
    const startIndex = (importRejectedPage - 1) * itemsPerPage
    return importRejectedItems.slice(startIndex, startIndex + itemsPerPage)
  }, [importRejectedItems, importRejectedPage, itemsPerPage])

  const totalCountedPages = Math.max(1, Math.ceil(countedItems.length / itemsPerPage))
  const totalRejectedPages = Math.max(1, Math.ceil(rejectedItems.length / itemsPerPage))
  const totalImportRejectedPages = Math.max(1, Math.ceil(importRejectedItems.length / itemsPerPage))
  const totalSearchPages = Math.max(1, Math.ceil(searchableItems.length / itemsPerPage))

  const stockTabs: TabConfig[] = useMemo(
    () => [
      {
        value: "counted-stock",
        label: "Stock Count",
        badgeCount: countedItems.length,
      },
      {
        value: "uncounted-stock",
        label: "Uncounted Items",
        badgeCount: rejectedItems.length,
        badgeVariant: "destructive",
      },
      {
        value: "import-rejected",
        label: "Import Rejected",
        badgeCount: importRejectedItems.length,
        badgeVariant: "destructive",
      },
    ],
    [countedItems.length, rejectedItems.length, importRejectedItems.length]
  )

  const handleCountChange = async (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0
    const item = items.find(i => i.id === itemId)
    if (!item) return false

    try {
      const response = await inventoryService.updateStockTakeItem(stockTakeId, itemId, {
        counted_quantity: numValue,
      })
      
      const countedQty = Number(response?.counted_quantity ?? numValue)
      const difference = Number(response?.difference ?? countedQty - item.expectedQty)
      setItems((previous) => previous.map((row) => row.id === itemId ? {
        ...row,
        countedQty,
        difference,
        quantityAfter: row.expectedQty + difference,
        isCounted: response?.is_counted === false ? false : true,
      } : row))
      
      toast({
        title: "Count Updated",
        description: `${item.product_name} count has been updated to ${numValue}.`,
      })
      return true
    } catch (error: any) {
      const errorMessage = error?.message || 
                          error?.data?.detail || 
                          error?.data?.message ||
                          "Failed to save count. Please try again."
      
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      })
      return false
    }
  }

  const handleItemClick = async (item: StockTakingItem) => {
    // If this is a placeholder item (not yet in database), create it first
    if (String(item.id).startsWith("placeholder-")) {
      try {
        // Create the stock take item in the database using the product ID
        const response = await inventoryService.createStockTakeItem(stockTakeId, {
          product_id: item.product_id,
          expected_quantity: item.expectedQty,
        })

        const newItem = response
        if (newItem) {
          const transformed = {
            id: String(newItem.id),
            product_id: String(newItem.product?.id || newItem.product_id || ""),
            product_name: newItem.product?.name || item.product_name || "Unknown Product",
            sku: newItem.product?.sku || item.sku || "",
            barcode: newItem.product?.barcode || item.barcode || "",
            isActive: newItem.product?.is_active !== false && item.isActive,
            quantityBefore: typeof newItem.expected_quantity === 'number'
              ? newItem.expected_quantity
              : parseInt(String(newItem.expected_quantity || 0)),
            expectedQty: typeof newItem.expected_quantity === 'number'
              ? newItem.expected_quantity
              : parseInt(String(newItem.expected_quantity || 0)),
            countedQty: typeof newItem.counted_quantity === 'number'
              ? newItem.counted_quantity
              : parseInt(String(newItem.counted_quantity || 0)),
            difference: typeof newItem.difference === 'number'
              ? newItem.difference
              : parseInt(String(newItem.difference || 0)),
            quantityAfter: (typeof newItem.expected_quantity === 'number' ? newItem.expected_quantity : parseInt(String(newItem.expected_quantity || 0))) + (typeof newItem.difference === 'number' ? newItem.difference : parseInt(String(newItem.difference || 0))),
            isCounted: Boolean(newItem.is_counted || newItem.counted_at),
            notes: newItem.notes || "",
          }
          setItems((previous) => previous.map((row) => row.id === item.id ? transformed : row))
          setSelectedItemForEdit(transformed)
          setEditCountValue(transformed.countedQty.toString())
        }
        setSearchOpen(false)
      } catch (error) {
        console.error("Failed to create stock take item:", error)
        toast({
          title: "Error",
          description: "Failed to add item to stock take. Please try again.",
          variant: "destructive",
        })
      }
    } else {
      setSelectedItemForEdit(item)
      setEditCountValue(item.countedQty.toString())
      setSearchOpen(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedItemForEdit) return
    setIsSavingCount(true)
    const numValue = parseInt(editCountValue) || 0
    try {
      const saved = await handleCountChange(selectedItemForEdit.id, numValue.toString())
      if (saved) {
        setSelectedItemForEdit(null)
        setEditCountValue("")
      }
    } finally {
      setIsSavingCount(false)
    }
  }

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      // Save all items that have been counted
      const savePromises = items
        .filter(item => item.isCounted)
        .map(item => 
          inventoryService.updateStockTakeItem(stockTakeId, item.id, {
            counted_quantity: item.countedQty,
          })
        )
      
      await Promise.all(savePromises)
      
      toast({
        title: "Progress Saved",
        description: "All counts have been saved successfully.",
      })
      
      // Reload to ensure sync
      loadStockTakeData()
    } catch (error) {
      console.error("Failed to save progress:", error)
      toast({
        title: "Save Failed",
        description: "Failed to save progress. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      await inventoryService.completeStockTake(stockTakeId)
      
      toast({
        title: "Stock Take Completed",
        description: "Stock take has been completed and adjustments have been applied.",
      })
      
      // Reload data
      loadStockTakeData()
      
      // Optionally navigate back to list
      setTimeout(() => {
        router.push("/dashboard/inventory/stock-taking")
      }, 2000)
    } catch (error: any) {
      console.error("Failed to complete stock take:", error)
      toast({
        title: "Completion Failed",
        description: error.message || "Failed to complete stock take. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCompleting(false)
    }
  }

  const handleExportSessionStock = async () => {
    setIsExportingSession(true)
    try {
      const outletId = String(
        stockTake?.outlet?.id ||
        stockTake?.outlet_id ||
        (typeof stockTake?.outlet === "string" || typeof stockTake?.outlet === "number"
          ? stockTake.outlet
          : "")
      )
      const exportRows: Array<{
        product_name: string
        sku: string
        barcode: string
        quantity_before: number
        count: string
        quantity_after: string
      }> = []

      if (!outletId) {
        throw new Error("Unable to determine the outlet for this stock take session.")
      }

      let page = 1
      let hasNext = true
      while (hasNext) {
        const response = await productService.list({
          outlet: outletId,
          is_active: true,
          page,
          limit: 100,
        })

        const pageItems = Array.isArray(response.results) ? response.results : []
        pageItems.forEach((product) => {
          exportRows.push({
            product_name: product.name || "",
            sku: product.sku || "",
            barcode: product.barcode || "",
            quantity_before: Number(product.sellable_stock || product.stock || 0),
            count: "",
            quantity_after: "",
          })
        })

        hasNext = Boolean(response.next)
        page += 1
      }

      if (exportRows.length === 0) {
        throw new Error("No active products found for this outlet.")
      }

      const columns: ExportColumn[] = [
        { key: "product_name", label: "Product Name", width: 32 },
        { key: "sku", label: "SKU", width: 20 },
        { key: "barcode", label: "Barcode", width: 22 },
        { key: "quantity_before", label: "Quantity Before", format: "number", width: 18 },
        { key: "count", label: "Count", width: 18 },
        { key: "quantity_after", label: "Quantity After", width: 18 },
      ]

      await exportToXLSX({
        data: exportRows,
        fileName: `stock-take-export-${stockTakeId}-${new Date().toISOString().split('T')[0]}`,
        sheetName: "Stock Take Counts",
        columns,
        includeHeaders: true,
        freezeHeader: true,
      })

      toast({
        title: "Export Successful",
        description: `Exported ${exportRows.length} active product record(s) for this stock take session.`,
      })
    } catch (error: any) {
      console.error("Failed to export session stock:", error)
      toast({
        title: "Export Failed",
        description: error?.message || "Failed to export stock take session.",
        variant: "destructive",
      })
    } finally {
      setIsExportingSession(false)
    }
  }

  // Calculate progress using actual inventory count
  const totalItems = items.length
  const countedItemsCount = items.filter(item => item.isCounted).length
  const progress = totalItems > 0 ? Math.round((countedItemsCount / totalItems) * 100) : 0
  const isCompleted = stockTake?.status === 'completed'
  const hasUncountedItems = items.some(item => !item.isCounted)

  if (isLoading) {
    return (
      <DashboardLayout>
        <PageLoading label="Counting stock…" />
      </DashboardLayout>
    )
  }

  if (loadError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">{loadError}</p>
          <Button onClick={() => router.push("/dashboard/inventory/stock-taking")}>Back to Stock Takes</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Stock Taking Session"
        description={`${stockTake?.outlet_name || stockTake?.outlet?.name || "Outlet"} - ${stockTake?.operating_date || ""}${stockTake?.description ? ` - ${stockTake.description}` : ""}`}
        actions={
          <div className="flex gap-2 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/inventory/stock-taking")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {!isCompleted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open stock take actions">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(`/dashboard/inventory/stock-taking/${stockTakeId}/import`)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Counts
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleExportSessionStock}
                    disabled={isExportingSession || items.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isExportingSession ? "Exporting..." : "Export Session"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSaveAll} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Progress"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setCompleteDialogOpen(true)}
                    disabled={isCompleting || countedItemsCount === 0}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isCompleting ? "Completing..." : "Complete Stock Take"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isCompleted && (
              <Badge className="bg-green-600">Completed</Badge>
            )}
          </div>
        }
      >
        <div className="space-y-6">

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Stock Taking Progress</Label>
                <span className="text-sm font-medium text-muted-foreground">
                  {countedItemsCount} / {totalItems} items ({progress}%)
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          </CardContent>
        </Card>


        {searchFilter === "remaining" && hasUncountedItems && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-800">
                {items.filter((item) => !item.isCounted).length} item(s) are still uncounted. Use the search box below to enter the remaining counts manually.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Search Bar with Dropdown */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Add Items</CardTitle>
            <CardDescription>
              Search for items to count. Click on an item to adjust its count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items by name or barcode..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setSearchOpen(true)
                      }}
                      onFocus={() => setSearchOpen(true)}
                    />
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[var(--radix-popover-trigger-width)] p-0" 
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {/* Filter Buttons */}
                  <div className="flex gap-1 p-2 border-b">
                    <Button
                      variant={searchFilter === "all" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setSearchFilter("all")}
                    >
                      All ({items.length})
                    </Button>
                    <Button
                      variant={searchFilter === "remaining" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setSearchFilter("remaining")}
                    >
                      Remaining ({items.filter(i => !i.isCounted).length})
                    </Button>
                    <Button
                      variant={searchFilter === "counted" ? "default" : "ghost"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setSearchFilter("counted")}
                    >
                      Counted ({items.filter(i => i.isCounted).length})
                    </Button>
                  </div>
                  
                  {/* Scrollable Items List */}
                  <div className="max-h-60 overflow-y-auto overflow-x-hidden">
                    {paginatedSearchableItems.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No items found
                      </div>
                    ) : (
                      <div className="divide-y">
                        {paginatedSearchableItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className="p-3 cursor-pointer hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-medium truncate">{item.product_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Barcode: {item.barcode || "N/A"} | Expected: {item.expectedQty}
                                  {item.isCounted && (
                                    <span className="text-green-600"> | Counted: {item.countedQty}</span>
                                  )}
                                </span>
                              </div>
                              <div className="ml-2 flex-shrink-0">
                                {item.isCounted ? (
                                  <Badge className="bg-green-600">Counted</Badge>
                                ) : (
                                  <Badge variant="outline">Not Counted</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {searchableItems.length > itemsPerPage && (
                    <div className="flex items-center justify-between border-t p-2 text-sm text-muted-foreground">
                      <span>Page {searchPage} of {totalSearchPages}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSearchPage((prev) => Math.max(1, prev - 1))}
                          disabled={searchPage === 1}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSearchPage((prev) => Math.min(totalSearchPages, prev + 1))}
                          disabled={searchPage === totalSearchPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <FilterableTabs
          tabs={stockTabs}
          activeTab={stockViewTab}
          onTabChange={setStockViewTab}
          tabsListClassName="grid w-full grid-cols-3"
        >
          <TabsContent value="counted-stock" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Stock Count</CardTitle>
                <CardDescription>
                  Items that have been counted ({countedItems.length} items)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {countedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No items counted yet. Use the search bar above to find and count items.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Barcode</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Quantity Before</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Quantity After</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCountedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.barcode || "N/A"}</TableCell>
                          <TableCell className="font-mono text-sm">{item.sku || "N/A"}</TableCell>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-right">{item.quantityBefore}</TableCell>
                          <TableCell className="text-right">{item.countedQty}</TableCell>
                          <TableCell className="text-right">{item.quantityAfter}</TableCell>
                          <TableCell className={cn(
                            "text-right font-semibold",
                            item.difference === 0
                              ? "text-muted-foreground"
                              : item.difference > 0
                              ? "text-green-600"
                              : "text-red-600"
                          )}>
                            {item.difference >= 0 ? "+" : ""}{item.difference}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-600">Counted</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleItemClick(item)}
                              disabled={isCompleted}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {countedItems.length > itemsPerPage && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                    <span>Page {currentPage} of {totalCountedPages}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(totalCountedPages, prev + 1))}
                        disabled={currentPage === totalCountedPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uncounted-stock" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Uncounted Items</CardTitle>
                <CardDescription>
                  Session items that are not counted yet ({rejectedItems.length} items)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rejectedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No uncounted items. All session items are counted.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Barcode</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Quantity Before</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Quantity After</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRejectedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.barcode || "N/A"}</TableCell>
                          <TableCell className="font-mono text-sm">{item.sku || "N/A"}</TableCell>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-right">{item.quantityBefore}</TableCell>
                          <TableCell className="text-right">{item.countedQty}</TableCell>
                          <TableCell className="text-right">{item.quantityAfter}</TableCell>
                          <TableCell>
                            <Badge variant="outline">Uncounted</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8"
                              onClick={() => handleItemClick(item)}
                              disabled={isCompleted}
                            >
                              Count Now
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {rejectedItems.length > itemsPerPage && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                    <span>Page {rejectedPage} of {totalRejectedPages}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectedPage((prev) => Math.max(1, prev - 1))}
                        disabled={rejectedPage === 1}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectedPage((prev) => Math.min(totalRejectedPages, prev + 1))}
                        disabled={rejectedPage === totalRejectedPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import-rejected" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Import Rejected</CardTitle>
                <CardDescription>
                  Rejected rows from the latest stock count import ({importRejectedItems.length} rows)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingImportRejected ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Loading rejected import rows...</p>
                  </div>
                ) : importRejectedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No rejected rows found in the latest import batch.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="w-28">SKU</TableHead>
                        <TableHead className="w-36">Barcode</TableHead>
                        <TableHead className="text-right w-28">Quantity Before</TableHead>
                        <TableHead className="text-right w-24">Count</TableHead>
                        <TableHead className="text-right w-28">Quantity After</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedImportRejectedItems.map((row) => (
                        <TableRow key={`${row.rowNumber}-${row.productName}-${row.status}`}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell className="font-medium">{row.productName}</TableCell>
                          <TableCell>{row.sku}</TableCell>
                          <TableCell>{row.barcode}</TableCell>
                          <TableCell className="text-right">{row.quantityBefore}</TableCell>
                          <TableCell className="text-right">{row.countedQuantity}</TableCell>
                          <TableCell className="text-right">{row.quantityAfter}</TableCell>
                          <TableCell className="text-sm text-orange-700">{row.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {importRejectedItems.length > itemsPerPage && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
                    <span>Page {importRejectedPage} of {totalImportRejectedPages}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportRejectedPage((prev) => Math.max(1, prev - 1))}
                        disabled={importRejectedPage === 1}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setImportRejectedPage((prev) => Math.min(totalImportRejectedPages, prev + 1))}
                        disabled={importRejectedPage === totalImportRejectedPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </FilterableTabs>
      </div>

      {/* Edit Count Dialog */}
      <Dialog open={!!selectedItemForEdit} onOpenChange={(open) => !open && setSelectedItemForEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Count {selectedItemForEdit?.product_name || "Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="count">Counted</Label>
              <Input
                id="count"
                type="number"
                min="0"
                value={editCountValue}
                onChange={(e) => setEditCountValue(e.target.value)}
                placeholder="Counted"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItemForEdit(null)} disabled={isSavingCount}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSavingCount || !editCountValue.trim()}>
              {isSavingCount ? "Saving count…" : "Save Count"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Stock Take Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete stock take?</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply all adjustments to stock levels and close this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Complete Stock Take
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </PageLayout>
    </DashboardLayout>
  )
}
