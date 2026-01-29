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
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ClipboardCheck, Search, Save, ArrowLeft, CheckCircle2, Zap, X } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { useBarcodeScanner } from "@/lib/hooks/useBarcodeScanner"
import { productService } from "@/lib/services/productService"
import { ProductModalTabs } from "@/components/modals/product-modal-tabs"
import { useRouter, useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { inventoryService } from "@/lib/services/inventoryService"
import { useToast } from "@/components/ui/use-toast"

interface StockTakingItem {
  id: string
  product_id: string
  product_name: string
  barcode: string
  expectedQty: number
  countedQty: number
  difference: number
  isCounted: boolean
  notes?: string
}

export default function StockTakingDetailPage() {
  const router = useRouter()
  const params = useParams()
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
  const [isCompleting, setIsCompleting] = useState(false)
  const [isAutoCompleting, setIsAutoCompleting] = useState(false)

  // Modal / scanner states
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [initialBarcode, setInitialBarcode] = useState<string | undefined>(undefined)

  // Barcode scanner - increment counts or open create modal
  useBarcodeScanner({
    onScan: async (code) => {
      try {
        console.log("Scanned barcode:", code)
        const { products, variations } = await productService.lookup(code)
        const product = (products && products.length > 0) ? products[0] : undefined
        const variation = (variations && variations.length > 0) ? variations[0] : undefined

        let matchedItem: StockTakingItem | undefined

        if (variation) {
          const prodId = typeof variation.product === 'object' ? String((variation.product as any).id) : String(variation.product)
          matchedItem = items.find(i => i.product_id === prodId || i.barcode === code)
        } else if (product) {
          matchedItem = items.find(i => i.product_id === product.id || i.barcode === product.barcode || i.barcode === code)
        }

        if (matchedItem) {
          const newCount = (matchedItem.countedQty || 0) + 1
          await handleCountChange(matchedItem.id, String(newCount))
          toast({ title: "Scanned", description: `${matchedItem.product_name} incremented to ${newCount}` })
        } else {
          // No match in stock take - open add product modal with barcode prefilled
          setInitialBarcode(code)
          setShowAddProduct(true)
        }
      } catch (error) {
        console.error("Barcode lookup failed:", error)
        toast({ title: "Scan Error", description: "Failed to lookup barcode.", variant: "destructive" })
      }
    }
  })
  useEffect(() => {
    loadStockTakeData()
  }, [stockTakeId])

  const loadStockTakeData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const [stockTakeData, itemsData] = await Promise.all([
        inventoryService.getStockTake(stockTakeId),
        inventoryService.getStockTakeItems(stockTakeId),
      ])
      
      setStockTake(stockTakeData)
      
      console.log("Raw items data from API:", itemsData)
      
      const transformedItems: StockTakingItem[] = itemsData.map((item: any) => {
        // Ensure we parse the counted_quantity correctly
        const countedQty = typeof item.counted_quantity === 'number' 
          ? item.counted_quantity 
          : parseInt(String(item.counted_quantity || 0))
        const isCounted = countedQty > 0
        
        const transformed = {
          id: String(item.id),
          product_id: String(item.product?.id || item.product_id || ""),
          product_name: item.product?.name || "Unknown Product",
          barcode: item.product?.barcode || "",
          expectedQty: typeof item.expected_quantity === 'number'
            ? item.expected_quantity
            : parseInt(String(item.expected_quantity || 0)),
          countedQty: countedQty,
          difference: typeof item.difference === 'number'
            ? item.difference
            : parseInt(String(item.difference || 0)),
          isCounted: isCounted,
          notes: item.notes || "",
        }
        
        // Log if we find an item with countedQty > 0
        if (countedQty > 0) {
          console.log("Found counted item:", {
            id: transformed.id,
            name: transformed.product_name,
            countedQty: transformed.countedQty,
            isCounted: transformed.isCounted,
            rawCountedQuantity: item.counted_quantity,
            rawItem: item
          })
        }
        
        return transformed
      })
      
      const countedItemsList = transformedItems.filter(i => i.countedQty > 0)
      console.log("Loaded stock take items:", {
        total: transformedItems.length,
        counted: countedItemsList.length,
        itemsWithCountedQty: transformedItems.filter(i => i.countedQty > 0).length,
        countedItems: countedItemsList.map(i => ({
          id: i.id,
          name: i.product_name,
          countedQty: i.countedQty,
          isCounted: i.isCounted
        }))
      })
      
      setItems(transformedItems)
    } catch (error) {
      console.error("Failed to load stock take data:", error)
      toast({
        title: "Error",
        description: "Failed to load stock take data. Please try again.",
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

  // Filter items for stock count table (only counted items with countedQty > 0)
  const countedItems = useMemo(() => {
    const filtered = items
      .filter(item => {
        // Item is counted if countedQty > 0
        const isCounted = (item.countedQty || 0) > 0
        return isCounted
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

  const handleCountChange = async (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0
    const item = items.find(i => i.id === itemId)
    if (!item) return

    console.log("Updating item count:", { 
      itemId, 
      numValue, 
      itemName: item.product_name, 
      currentCountedQty: item.countedQty,
      stockTakeId 
    })

    // Save to backend first
    try {
      console.log("Calling updateStockTakeItem with:", {
        stockTakeId,
        itemId,
        data: { counted_quantity: numValue }
      })
      
      const response = await inventoryService.updateStockTakeItem(stockTakeId, itemId, {
        counted_quantity: numValue,
      })
      
      console.log("Backend response after update:", response)
      
      // Small delay to ensure backend has processed
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Reload data to ensure sync with backend (don't show loading spinner)
      await loadStockTakeData(false)
      
      console.log("Data reloaded after update, items state:", items.length)
      
      toast({
        title: "Count Updated",
        description: `${item.product_name} count has been updated to ${numValue}.`,
      })
    } catch (error: any) {
      console.error("Failed to update item count - Full error:", error)
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        data: error?.data,
        stack: error?.stack,
      })
      
      const errorMessage = error?.message || 
                          error?.data?.detail || 
                          error?.data?.message ||
                          "Failed to save count. Please try again."
      
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      })
      // Reload to get correct state
      await loadStockTakeData(false)
    }
  }

  const handleItemClick = (item: StockTakingItem) => {
    setSelectedItemForEdit(item)
    setEditCountValue(item.countedQty.toString())
    setSearchOpen(false)
  }

  const handleSaveEdit = async () => {
    if (!selectedItemForEdit) return
    
    const numValue = parseInt(editCountValue) || 0
    await handleCountChange(selectedItemForEdit.id, numValue.toString())
    setSelectedItemForEdit(null)
    setEditCountValue("")
  }

  const handleAutoComplete = async () => {
    if (!confirm("This will set all uncounted items to their expected quantity. This action cannot be undone. Continue?")) {
      return
    }

    setIsAutoCompleting(true)
    try {
      const uncountedItems = items.filter(item => !item.isCounted)
      
      // Update all uncounted items to expected quantity
      const updatePromises = uncountedItems.map(item =>
        inventoryService.updateStockTakeItem(stockTakeId, item.id, {
          counted_quantity: item.expectedQty,
        })
      )
      
      await Promise.all(updatePromises)
      
      toast({
        title: "Auto-Complete Successful",
        description: `Set ${uncountedItems.length} items to their expected quantities.`,
      })
      
      // Reload data
      loadStockTakeData()
    } catch (error) {
      console.error("Failed to auto-complete:", error)
      toast({
        title: "Auto-Complete Failed",
        description: "Failed to auto-complete items. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAutoCompleting(false)
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
    if (!confirm("Are you sure you want to complete this stock take? This will apply all adjustments to stock levels.")) {
      return
    }

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

  // Calculate progress
  const totalItems = items.length
  const countedItemsCount = items.filter(item => item.isCounted).length
  const progress = totalItems > 0 ? Math.round((countedItemsCount / totalItems) * 100) : 0
  const isCompleted = stockTake?.status === 'completed'
  const hasUncountedItems = items.some(item => !item.isCounted)

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading stock take...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Stock Taking Session"
        description={`${stockTake?.outlet?.name || "Outlet"} - ${stockTake?.operating_date || ""}${stockTake?.description ? ` - ${stockTake.description}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard/inventory/stock-taking")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {!isCompleted && (
              <>
                {hasUncountedItems && (
                  <Button 
                    onClick={handleAutoComplete} 
                    disabled={isAutoCompleting}
                    variant="outline"
                    className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-300"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    {isAutoCompleting ? "Auto-Completing..." : "Auto-Complete"}
                  </Button>
                )}
                <Button onClick={handleSaveAll} disabled={isSaving} variant="outline">
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Progress"}
                </Button>
                <Button onClick={handleComplete} disabled={isCompleting || countedItemsCount === 0}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isCompleting ? "Completing..." : "Complete Stock Take"}
                </Button>
              </>
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

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground">
                Items to count
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Counted Items</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{countedItemsCount}</div>
              <p className="text-xs text-muted-foreground">
                Items completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining Items</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{totalItems - countedItemsCount}</div>
              <p className="text-xs text-muted-foreground">
                Items not counted
              </p>
            </CardContent>
          </Card>
        </div>

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
                  <div className="max-h-[500px] overflow-y-auto overflow-x-hidden">
                    {searchableItems.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No items found
                      </div>
                    ) : (
                      <div className="divide-y">
                        {searchableItems.map((item) => (
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
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Stock Count Table - Only Counted Items */}
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
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.barcode || "N/A"}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-right">{item.expectedQty}</TableCell>
                      <TableCell className="text-right">{item.countedQty}</TableCell>
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
          </CardContent>
        </Card>
      </div>

      {/* Edit Count Dialog */}
      <Dialog open={!!selectedItemForEdit} onOpenChange={(open) => !open && setSelectedItemForEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Count</DialogTitle>
            <DialogDescription>
              Update the physical count for {selectedItemForEdit?.product_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <p className="font-medium">{selectedItemForEdit?.product_name}</p>
            </div>
            <div className="space-y-2">
              <Label>Barcode</Label>
              <p className="text-sm text-muted-foreground">{selectedItemForEdit?.barcode || "N/A"}</p>
            </div>
            <div className="space-y-2">
              <Label>Expected Quantity</Label>
              <p className="font-medium">{selectedItemForEdit?.expectedQty}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="count">Counted Quantity *</Label>
              <Input
                id="count"
                type="number"
                min="0"
                value={editCountValue}
                onChange={(e) => setEditCountValue(e.target.value)}
                placeholder="Enter physical count"
                autoFocus
              />
            </div>
            {selectedItemForEdit && (
              <div className="space-y-2">
                <Label>Difference</Label>
                <p className={cn(
                  "font-semibold",
                  (parseInt(editCountValue) || 0) - selectedItemForEdit.expectedQty === 0
                    ? "text-muted-foreground"
                    : (parseInt(editCountValue) || 0) - selectedItemForEdit.expectedQty > 0
                    ? "text-green-600"
                    : "text-red-600"
                )}>
                  {(parseInt(editCountValue) || 0) - selectedItemForEdit.expectedQty >= 0 ? "+" : ""}
                  {(parseInt(editCountValue) || 0) - selectedItemForEdit.expectedQty}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItemForEdit(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Count
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Product Modal for scanned barcodes */}
      <ProductModalTabs
        open={showAddProduct}
        onOpenChange={(open) => {
          setShowAddProduct(open)
          if (!open) {
            setInitialBarcode(undefined)
            // Reload stock take data in case user created a product that should be counted
            loadStockTakeData()
          }
        }}
        product={undefined}
        initialBarcode={initialBarcode}
        onProductSaved={() => loadStockTakeData()}
      />

      </PageLayout>
    </DashboardLayout>
  )
}
