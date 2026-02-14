"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageLayout } from "@/components/layouts/page-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FilterableTabs, TabsContent, type TabConfig } from "@/components/ui/filterable-tabs"
import { Plus, Search, Upload, Filter, Folder, Trash2, RefreshCw, AlertTriangle, Package, AlertCircle, Clock, Download, Edit, Menu, ShoppingCart } from "lucide-react"
import { OrderProductModal } from "@/components/modals/order-product-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useState, useEffect, useCallback, useMemo } from "react"
import { ProductModalTabs } from "@/components/modals/product-modal-tabs"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { productService, categoryService } from "@/lib/services/productService"
import { useBarcodeScanner } from "@/lib/hooks/useBarcodeScanner"
import { useBusinessStore } from "@/stores/businessStore"
import { useToast } from "@/components/ui/use-toast"
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
import { useI18n } from "@/contexts/i18n-context"
import { useTenant } from "@/contexts/tenant-context"

export default function ProductsPage() {
  const { t } = useI18n()
  const { outlets } = useTenant()
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [initialBarcode, setInitialBarcode] = useState<string | undefined>(undefined)

  useBarcodeScanner({
    onScan: async (code) => {
      const term = String(code || "").trim()
      if (!term) return

      try {
        const { products: matchedProducts } = await productService.lookup(term)
        if (matchedProducts && matchedProducts.length > 0) {
          setInitialBarcode(undefined)
          setSelectedProduct(matchedProducts[0])
          setShowAddProduct(true)
          return
        }

        setSelectedProduct(null)
        setInitialBarcode(term)
        setShowAddProduct(true)
      } catch (error: any) {
        console.error("Barcode lookup failed:", error)
        toast({
          title: "Scan Error",
          description: error?.message || "Failed to lookup barcode",
          variant: "destructive",
        })
      }
    },
  })

  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [productToDelete, setProductToDelete] = useState<any>(null)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [productToOrder, setProductToOrder] = useState<any>(null)
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { toast } = useToast()
  
  // Determine business type for conditional rendering
  const businessType = currentBusiness?.type || ""
  const isWholesaleRetail = businessType === "wholesale and retail"
  const isBar = businessType === "bar"
  const isRestaurant = businessType === "restaurant"
  
  // Helper function to parse business-specific fields from description
  const parseBusinessFields = (product: any) => {
    const desc = product.description || ""
    const fields: any = {}
    
    if (isBar) {
      // Parse volume_ml: "Volume: 750ml"
      const volumeMatch = desc.match(/Volume:\s*(\d+)ml/i)
      if (volumeMatch) {
        fields.volume_ml = parseInt(volumeMatch[1])
      }
      
      // Parse alcohol_percentage: "Alcohol: 40%"
      const alcoholMatch = desc.match(/Alcohol:\s*([\d.]+)%/i)
      if (alcoholMatch) {
        fields.alcohol_percentage = parseFloat(alcoholMatch[1])
      }
    }
    
    if (isRestaurant) {
      // Parse preparation_time: "Prep time: 15 min"
      const prepMatch = desc.match(/Prep time:\s*(\d+)\s*min/i)
      if (prepMatch) {
        fields.preparation_time = parseInt(prepMatch[1])
      }
      
      // Check if it's a menu item (not explicitly marked as "Not a menu item")
      fields.is_menu_item = !desc.includes("Not a menu item")
    }
    
    return fields
  }

  const loadData = useCallback(async (isAutoRefresh = false) => {
    if (!currentBusiness) return
    
    if (isAutoRefresh) {
      setIsAutoRefreshing(true)
    } else {
      setIsLoading(true)
    }
    try {
      const categoriesPromise = categoryService.list()
      const allProducts: any[] = []
      let page = 1
      let next: string | undefined = undefined

      do {
        const response = await productService.list({
          is_active: true,
          page,
          outlet: currentOutlet?.id ? String(currentOutlet.id) : undefined,
        })
        allProducts.push(...(response.results || []))
        next = response.next
        page += 1
      } while (next)

      const categoriesResponse = await categoriesPromise
      setProducts(allProducts)
      setCategories(Array.isArray(categoriesResponse) ? categoriesResponse : categoriesResponse || [])
    } catch (error) {
      console.error("Failed to load products:", error)
      if (!isAutoRefresh) {
        toast({
          title: "Error",
          description: "Failed to load products. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      setIsLoading(false)
      setIsAutoRefreshing(false)
    }
  }, [currentBusiness, currentOutlet, toast])

  useEffect(() => {
    loadData(false)
    
    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      loadData(true)
    }, 30000)
    
    // Refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden && currentBusiness) {
        loadData(false)
      }
    }
    
    // Refresh when window gains focus
    const handleFocus = () => {
      if (currentBusiness) {
        loadData(false)
      }
    }
    
    // Listen for custom events from inventory operations
    const handleInventoryUpdate = () => {
      if (currentBusiness) {
        loadData(false)
      }
    }
    
    // Listen for outlet changes
    const handleOutletChange = () => {
      if (currentBusiness) {
        loadData(false)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('inventory-updated', handleInventoryUpdate)
    window.addEventListener('outlet-changed', handleOutletChange)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('inventory-updated', handleInventoryUpdate)
      window.removeEventListener('outlet-changed', handleOutletChange)
    }
  }, [loadData, currentBusiness])

  const getProductStatus = (product: any) => {
    // Check if backend already marked it as low stock
    if (product.is_low_stock) {
      // Check if it's actually out of stock
      const stock = typeof product.stock === 'string' ? parseFloat(product.stock) : (product.stock || 0)
      if (stock === 0) return "out-of-stock"
      return "low-stock"
    }
    
    // Check product-level stock
    const stock = typeof product.stock === 'string' ? parseFloat(product.stock) : (product.stock || 0)
    const lowStockThreshold = typeof product.lowStockThreshold === 'string' 
      ? parseFloat(product.lowStockThreshold) 
      : (product.lowStockThreshold || 0)
    
    // Check variation-level low stock
    if (product.variations && Array.isArray(product.variations)) {
      const hasLowVariation = product.variations.some((v: any) => {
        if (!v.track_inventory) return false
        const varStock = v.total_stock || v.stock || 0
        const varThreshold = v.low_stock_threshold || 0
        if (varThreshold > 0 && varStock <= varThreshold) {
          return true
        }
        return false
      })
      
      if (hasLowVariation) {
        // Check if any variation is out of stock
        const hasOutOfStock = product.variations.some((v: any) => {
          if (!v.track_inventory) return false
          const varStock = v.total_stock || v.stock || 0
          return varStock === 0
        })
        if (hasOutOfStock && stock === 0) return "out-of-stock"
        return "low-stock"
      }
    }
    
    // Only show out of stock if stock is exactly 0
    if (stock === 0 || stock === null || stock === undefined) return "out-of-stock"
    
    // Show low stock if threshold is set and stock is at or below threshold
    if (lowStockThreshold > 0 && stock <= lowStockThreshold) return "low-stock"
    
    // Otherwise, it's in stock
    return "active"
  }

  // Helper function to get expiry status
  const getExpiryStatus = (expiryDate: string | null | undefined) => {
    if (!expiryDate) return { status: "none", label: "No Expiry", color: "bg-gray-100 text-gray-800", days: null }
    
    const expiry = new Date(expiryDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilExpiry < 0) {
      return { status: "expired", label: "Expired", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", days: Math.abs(daysUntilExpiry) }
    } else if (daysUntilExpiry === 0) {
      return { status: "expires-today", label: "Expires Today", color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200", days: 0 }
    } else if (daysUntilExpiry <= 7) {
      return { status: "expiring-soon", label: `Expires in ${daysUntilExpiry} days`, color: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200", days: daysUntilExpiry }
    } else if (daysUntilExpiry <= 30) {
      return { status: "expiring-month", label: `Expires in ${daysUntilExpiry} days`, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200", days: daysUntilExpiry }
    } else {
      return { status: "valid", label: `Expires in ${daysUntilExpiry} days`, color: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200", days: daysUntilExpiry }
    }
  }

  // Filter products based on search and category
  const baseFilteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesCategory = categoryFilter === "all" || 
                             (product.categoryId && categories.find(c => c.id === product.categoryId)?.name === categoryFilter) ||
                             (product.category?.name && product.category.name === categoryFilter)
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, categoryFilter, categories])

  // Filter by tab selection
  const filteredProducts = useMemo(() => {
    if (activeTab === "all") {
      return baseFilteredProducts
    } else if (activeTab === "low-stock") {
      return baseFilteredProducts.filter(product => {
        const status = getProductStatus(product)
        return status === "low-stock" || status === "out-of-stock"
      })
    } else if (activeTab === "expiries") {
      return baseFilteredProducts.filter(product => {
        if (!product.track_expiration && !product.expiry_date) return false
        const expiryStatus = getExpiryStatus(product.expiry_date)
        return expiryStatus.status === "expired" || 
               expiryStatus.status === "expires-today" || 
               expiryStatus.status === "expiring-soon" ||
               expiryStatus.status === "expiring-month"
      })
    }
    return baseFilteredProducts
  }, [baseFilteredProducts, activeTab])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredProducts.slice(startIndex, startIndex + pageSize)
  }, [filteredProducts, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchTerm, categoryFilter])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const renderPagination = () => {
    if (filteredProducts.length <= pageSize) return null

    const startIndex = (currentPage - 1) * pageSize + 1
    const endIndex = Math.min(currentPage * pageSize, filteredProducts.length)

    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-600">
          Showing {startIndex}-{endIndex} of {filteredProducts.length}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    )
  }

  // Calculate stats for tabs
  const stats = useMemo(() => {
    const allCount = baseFilteredProducts.length
    const lowStockCount = baseFilteredProducts.filter(p => {
      const status = getProductStatus(p)
      return status === "low-stock" || status === "out-of-stock"
    }).length
    const expiriesCount = baseFilteredProducts.filter(p => {
      if (!p.track_expiration && !p.expiry_date) return false
      const expiryStatus = getExpiryStatus(p.expiry_date)
      return expiryStatus.status === "expired" || 
             expiryStatus.status === "expires-today" || 
             expiryStatus.status === "expiring-soon" ||
             expiryStatus.status === "expiring-month"
    }).length
    
    return { allCount, lowStockCount, expiriesCount }
  }, [baseFilteredProducts])

  // Tab configuration
  const tabsConfig: TabConfig[] = useMemo(() => [
    {
      value: "all",
      label: "All Products",
      icon: Package,
      badgeCount: stats.allCount > 0 ? stats.allCount : undefined,
      badgeVariant: "secondary",
    },
    {
      value: "low-stock",
      label: "Low Stocks",
      icon: AlertCircle,
      badgeCount: stats.lowStockCount > 0 ? stats.lowStockCount : undefined,
      badgeVariant: "destructive",
    },
    {
      value: "expiries",
      label: "Expiries",
      icon: Clock,
      badgeCount: stats.expiriesCount > 0 ? stats.expiriesCount : undefined,
      badgeVariant: "destructive",
    },
  ], [stats])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadData()
      toast({
        title: "Refreshed",
        description: "Products list has been refreshed.",
      })
    } catch (error) {
      console.error("Failed to refresh products:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleProductSaved = async () => {
    // Reload products after save with a small delay to ensure backend has processed
    // This ensures all changes (stock, prices, etc.) are immediately visible
    await new Promise(resolve => setTimeout(resolve, 150))
    await loadData()
  }

  const handleDeleteClick = (product: any) => {
    setProductToDelete(product)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return

    setDeletingProductId(productToDelete.id)
    try {
      await productService.delete(productToDelete.id)
      toast({
        title: "Product Deleted",
        description: `${productToDelete.name} has been deleted successfully.`,
      })
      // Reload products after deletion
      await handleProductSaved()
    } catch (error: any) {
      console.error("Failed to delete product:", error)
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete product. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingProductId(null)
      setShowDeleteDialog(false)
      setProductToDelete(null)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Products"
        description={`Manage your product catalog${isAutoRefreshing ? ' (Updating...)' : ''}` }
        noPadding={true}
      >
        {/* Tabs Navigation */}
        <div className="px-6 pt-4 border-b border-gray-300">
          <FilterableTabs
            tabs={tabsConfig}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          >

            {/* Button Toolbar */}
            <div className="px-6 py-3 border-b border-gray-300 flex gap-3 justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-blue-900 hover:bg-blue-800 text-white">
                    <Upload className="mr-2 h-4 w-4" />
                    Import / Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setShowImport(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Products
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowExport(true)} disabled={products.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Products
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/dashboard/inventory/products/categories">
                <Button className="bg-blue-900 hover:bg-blue-800 text-white">
                  <Folder className="mr-2 h-4 w-4" />
                  Categories
                </Button>
              </Link>
              <Button 
                onClick={() => {
                  setSelectedProduct(null)
                  setShowAddProduct(true)
                }}
                className="bg-blue-900 hover:bg-blue-800 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 border-b border-gray-300">
              <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                placeholder={t("common.search_products_placeholder")}
                className="pl-10 bg-white border-gray-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && baseFilteredProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {baseFilteredProducts.slice(0, 5).map((product) => (
                  <div
                    key={product.id}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    onClick={() => {
                    setSearchTerm(product.name)
                    }}
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-gray-500">{product.sku || "No SKU"}</div>
                  </div>
                  ))}
                </div>
                )}
              </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px] bg-white border-gray-300">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder={t("common.all_categories")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id || cat} value={cat.name || cat}>{cat.name || cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* All Products Tab */}
            <TabsContent value="all" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">All Products</h3>
                  <p className="text-sm text-gray-600">
                    {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
                  </p>
                </div>
                <div>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">Loading products...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {searchTerm || categoryFilter !== "all" 
                        ? "No products found matching your filters" 
                        : "No products found"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-gray-900 font-semibold">Product</TableHead>
                          <TableHead className="text-gray-900 font-semibold">SKU</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Category</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Cost</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Retail Price</TableHead>
                          {isWholesaleRetail && <TableHead className="text-gray-900 font-semibold">Wholesale Price</TableHead>}
                          {isBar && <TableHead className="text-gray-900 font-semibold">Volume (ml)</TableHead>}
                          {isBar && <TableHead className="text-gray-900 font-semibold">Alcohol %</TableHead>}
                          {isRestaurant && <TableHead>Prep Time</TableHead>}
                          {isRestaurant && <TableHead>Menu Item</TableHead>}
                          <TableHead>Stock</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedProducts.map((product) => {
                  const status = getProductStatus(product)
                  const categoryName = product.category?.name || (product.categoryId ? categories.find(c => c.id === product.categoryId)?.name : "N/A")
                  const businessFields = parseBusinessFields(product)
                  
                  // Get outlet name from product or lookup in outlets context
                  const outletName = product.outlet?.name || product.outlet_name || 
                    (product.outlet_id ? outlets?.find(o => String(o.id) === String(product.outlet_id))?.name : null) ||
                    (product.outlet ? outlets?.find(o => String(o.id) === String(product.outlet))?.name : null) ||
                    "N/A"
                  
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Link 
                          href={`/dashboard/inventory/products/${product.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell>{product.sku || "N/A"}</TableCell>
                      <TableCell>{categoryName}</TableCell>
                      <TableCell>{outletName}</TableCell>
                      <TableCell>{currentBusiness?.currencySymbol || "MWK"} {product.cost ? product.cost.toFixed(2) : "0.00"}</TableCell>
                      <TableCell>
                        {currentBusiness?.currencySymbol || "MWK"} {(product.retail_price || product.price || 0).toFixed(2)}
                      </TableCell>
                      {isWholesaleRetail && (
                        <TableCell>
                          {product.wholesale_enabled || product.wholesaleEnabled ? (
                            <span>
                              {currentBusiness?.currencySymbol || "MWK"} {(product.wholesale_price || product.wholesalePrice || 0).toFixed(2)}
                              {product.minimum_wholesale_quantity > 1 && (
                                <span className="text-xs text-muted-foreground block">
                                  (Min: {product.minimum_wholesale_quantity})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {isBar && (
                        <TableCell>
                          {businessFields.volume_ml ? `${businessFields.volume_ml}ml` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                      {isBar && (
                        <TableCell>
                          {businessFields.alcohol_percentage !== undefined ? `${businessFields.alcohol_percentage}%` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                      {isRestaurant && (
                        <TableCell>
                          {businessFields.preparation_time ? `${businessFields.preparation_time} min` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                      )}
                      {isRestaurant && (
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            businessFields.is_menu_item 
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {businessFields.is_menu_item ? "Yes" : "No"}
                          </span>
                        </TableCell>
                      )}
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Menu className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProduct(product)
                                setShowAddProduct(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Product
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(product)}
                              disabled={deletingProductId === product.id}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Product
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                        </TableRow>
                      )
                    })}
                      </TableBody>
                    </Table>
                    {renderPagination()}
                  </div>
                )}
                </div>
              </div>
            </TabsContent>

            {/* Low Stocks Tab */}
            <TabsContent value="low-stock" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Low Stock Products
                  </h3>
                  <p className="text-sm text-gray-600">
                    {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} with low or out of stock
                  </p>
                </div>
                <div>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-gray-600">Loading products...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-gray-900 font-semibold">Product</TableHead>
                          <TableHead className="text-gray-900 font-semibold">SKU</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Category</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Current Stock</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Low Stock Threshold</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No low stock products found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedProducts.map((product) => {
                        const status = getProductStatus(product)
                        const categoryName = product.category?.name || (product.categoryId ? categories.find(c => c.id === product.categoryId)?.name : "N/A")
                        const stock = typeof product.stock === 'string' ? parseFloat(product.stock) : (product.stock || 0)
                        const threshold = typeof product.lowStockThreshold === 'string' 
                          ? parseFloat(product.lowStockThreshold) 
                          : (product.lowStockThreshold || 0)
                        
                        // Get outlet name from product or lookup in outlets context
                        const outletName = product.outlet?.name || product.outlet_name || 
                          (product.outlet_id ? outlets?.find(o => String(o.id) === String(product.outlet_id))?.name : null) ||
                          (product.outlet ? outlets?.find(o => String(o.id) === String(product.outlet))?.name : null) ||
                          "N/A"
                        
                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              <Link 
                                href={`/dashboard/inventory/products/${product.id}`}
                                className="font-medium hover:text-primary"
                              >
                                {product.name}
                              </Link>
                            </TableCell>
                            <TableCell>{product.sku || "N/A"}</TableCell>
                            <TableCell>{categoryName}</TableCell>
                            <TableCell>{outletName}</TableCell>
                            <TableCell className={status === "out-of-stock" ? "text-red-600 font-semibold" : "text-orange-600 font-semibold"}>
                              {stock}
                            </TableCell>
                            <TableCell>{threshold || "—"}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                status === "low-stock"
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                              }`}>
                                {status === "low-stock" ? "Low Stock" : "Out of Stock"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="border-gray-300">
                                    <Menu className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setProductToOrder(product)
                                      setShowOrderModal(true)
                                    }}
                                  >
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Order
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                      </TableBody>
                    </Table>
                    {renderPagination()}
                  </div>
                )}
                </div>
              </div>
            </TabsContent>

            {/* Expiries Tab */}
            <TabsContent value="expiries" className="mt-0">
              <div className="px-6 py-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    Expiring Products
                  </h3>
                  <p className="text-sm text-gray-600">
                    {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} expiring soon or expired
                  </p>
                </div>
                <div>
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-gray-600">Loading products...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-md border border-gray-300 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-gray-900 font-semibold">Product</TableHead>
                          <TableHead className="text-gray-900 font-semibold">SKU</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Category</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Outlet</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Manufacturing Date</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Expiry Date</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Days Left</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                          <TableHead className="text-gray-900 font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8 text-gray-600">
                              No expiring products found
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedProducts.map((product) => {
                            const categoryName = product.category?.name || (product.categoryId ? categories.find(c => c.id === product.categoryId)?.name : "N/A")
                            const expiryStatus = getExpiryStatus(product.expiry_date)
                            
                            return (
                              <TableRow key={product.id} className="border-gray-300">
                            <TableCell>
                              <Link 
                                href={`/dashboard/inventory/products/${product.id}`}
                                className="font-medium hover:text-primary"
                              >
                                {product.name}
                              </Link>
                            </TableCell>
                            <TableCell>{product.sku || "N/A"}</TableCell>
                            <TableCell>{categoryName}</TableCell>
                            <TableCell>{product.outlet?.name || product.outlet_name || "N/A"}</TableCell>
                            <TableCell>
                              {product.manufacturing_date 
                                ? new Date(product.manufacturing_date).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {product.expiry_date 
                                ? new Date(product.expiry_date).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell className={
                              expiryStatus.status === "expired" || expiryStatus.status === "expires-today"
                                ? "text-red-600 font-semibold"
                                : expiryStatus.status === "expiring-soon"
                                ? "text-orange-600 font-semibold"
                                : ""
                            }>
                              {expiryStatus.days !== null 
                                ? expiryStatus.status === "expired" 
                                  ? `Expired ${expiryStatus.days} days ago`
                                  : `${expiryStatus.days} days`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${expiryStatus.color}`}>
                                {expiryStatus.label}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="border-gray-300">
                                    <Menu className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedProduct(product)
                                      setShowAddProduct(true)
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Product
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                      </TableBody>
                    </Table>
                    {renderPagination()}
                  </div>
                )}
                </div>
              </div>
            </TabsContent>
          </FilterableTabs>
        </div>
      </PageLayout>

      {/* Modals */}
      <ProductModalTabs
        open={showAddProduct}
        onOpenChange={(open) => {
          setShowAddProduct(open)
          if (!open) {
            setSelectedProduct(null)
            setInitialBarcode(undefined)
            // Always refresh when modal closes to ensure latest data is shown
            // This catches cases where stock might have changed externally
            handleProductSaved()
          }
        }}
        product={selectedProduct}
        initialBarcode={initialBarcode}
        onProductSaved={async () => {
          // Refresh immediately after save to show updated data (stock, prices, etc.)
          await handleProductSaved()
        }}
      />
      <DataExchangeModal
        open={showImport}
        onOpenChange={setShowImport}
        type="import"
        config={dataExchangeConfigs.products}
        outlets={outlets}
        categories={categories}
        onSuccess={() => {
          handleProductSaved()
        }}
      />

      <DataExchangeModal
        open={showExport}
        onOpenChange={setShowExport}
        type="export"
        config={dataExchangeConfigs.products}
        outlets={outlets}
        categories={categories}
      />

      {/* Order Product Modal */}
      <OrderProductModal
        open={showOrderModal}
        onOpenChange={(open) => {
          setShowOrderModal(open)
          if (!open) {
            setProductToOrder(null)
          }
        }}
        product={productToOrder}
        onSuccess={() => {
          // Refresh products after successful order
          handleProductSaved()
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Product
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&quot;{productToDelete?.name}&quot;</strong>? 
              <br />
              <span className="text-destructive font-medium">This action cannot be undone.</span>
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                All associated data including sales history, inventory records, and variations will be affected.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProductId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingProductId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProductId !== null ? "Deleting..." : "Delete Product"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
