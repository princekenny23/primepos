"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Plus, Search, Package, Upload, Filter, MoreVertical, Folder, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useState, useEffect } from "react"
import { ProductModalTabs } from "@/components/modals/product-modal-tabs"
import { DataExchangeModal } from "@/components/modals/data-exchange-modal"
import { dataExchangeConfigs } from "@/lib/utils/data-exchange-config"
import { productService, categoryService, variationService } from "@/lib/services/productService"
import { useBusinessStore } from "@/stores/businessStore"
import { useTenant } from "@/contexts/tenant-context"
import { useToast } from "@/components/ui/use-toast"
import type { Product, Category } from "@/lib/types"

export default function ProductsItemsPage() {
  const { currentBusiness } = useBusinessStore()
  const { currentOutlet, currentTenant } = useTenant()
  const { toast } = useToast()
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [variationCounts, setVariationCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)

  const loadData = async () => {
    if (!currentBusiness) return
    
    setIsLoading(true)
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        productService.list({ is_active: true }),
        categoryService.list(),
      ])
      
      // Filter products by current business/tenant as a safety measure
      // Backend should filter automatically, but this ensures correctness
      const allProducts = productsResponse.results || []
      const currentTenantId = String(currentBusiness?.id || currentTenant?.id || "")
      
      if (!currentTenantId) {
        console.error("No tenant ID available for filtering products")
        setProducts([])
        setIsLoading(false)
        return
      }
      
      const filteredProducts = allProducts.filter(product => {
        const productTenantId = String(product.businessId || "")
        const matches = productTenantId === currentTenantId
        
        if (!matches && allProducts.length > 0) {
          console.warn("Product filtered out (wrong tenant):", {
            productId: product.id,
            productName: product.name,
            productTenantId,
            currentTenantId,
            productTenantIdType: typeof product.businessId,
            currentTenantIdType: typeof currentBusiness?.id
          })
        }
        
        return matches
      })
      
      console.log("Products loaded and filtered:", {
        totalReceived: allProducts.length,
        afterFiltering: filteredProducts.length,
        filteredOut: allProducts.length - filteredProducts.length,
        currentBusinessId: currentBusiness?.id,
        currentBusinessName: currentBusiness?.name,
        currentBusinessType: currentBusiness?.type,
        currentTenantId: currentTenant?.id,
        sampleProducts: allProducts.slice(0, 3).map(p => ({
          id: p.id,
          name: p.name,
          businessId: p.businessId,
          businessIdType: typeof p.businessId
        }))
      })
      
      setProducts(filteredProducts)
      setCategories(categoriesResponse || [])
      
      // Load variation counts for all products
      const counts: Record<string, number> = {}
      await Promise.all(
        filteredProducts.map(async (product) => {
          try {
            const variations = await variationService.list({ product: product.id })
            counts[product.id] = variations.length
          } catch (error) {
            counts[product.id] = 0
          }
        })
      )
      setVariationCounts(counts)
    } catch (error) {
      console.error("Failed to load products:", error)
      setProducts([])
      setCategories([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentBusiness, currentTenant])

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || 
                           (product.categoryId && categories.find(c => c.id === product.categoryId)?.name === categoryFilter)
    return matchesSearch && matchesCategory
  })

  const getProductStatus = (product: Product) => {
    // Convert stock to number if it's a string
    const stock = typeof product.stock === 'string' ? parseFloat(product.stock) : (product.stock || 0)
    const lowStockThreshold = typeof product.lowStockThreshold === 'string' 
      ? parseFloat(product.lowStockThreshold) 
      : (product.lowStockThreshold || 0)
    
    // Only show out of stock if stock is exactly 0
    if (stock === 0 || stock === null || stock === undefined) return "out-of-stock"
    
    // Show low stock if threshold is set and stock is at or below threshold
    if (lowStockThreshold > 0 && stock <= lowStockThreshold) return "low-stock"
    
    // Otherwise, it's in stock
    return "active"
  }

  const handleProductSaved = () => {
    // Reload products after save
    loadData()
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      return
    }

    setDeletingProductId(product.id)
    try {
      await productService.delete(product.id)
      toast({
        title: "Product Deleted",
        description: `${product.name} has been deleted successfully.`,
      })
      // Reload products after deletion
      loadData()
    } catch (error: any) {
      console.error("Failed to delete product:", error)
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete product. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingProductId(null)
    }
  }

  return (
    <DashboardLayout>
      <PageLayout
        title="Stock & Items"
        description="Manage your product catalog"
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/inventory/products/categories">
              <Button variant="outline">
                <Folder className="mr-2 h-4 w-4" />
                Categories
              </Button>
            </Link>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button onClick={() => {
              setSelectedProduct(null)
              setShowAddProduct(true)
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        }
      >

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name or SKU..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""} found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No products found</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSelectedProduct(null)
                    setShowAddProduct(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Product
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Variations</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const status = getProductStatus(product)
                    const categoryName = product.categoryId 
                      ? categories.find(c => c.id === product.categoryId)?.name || "Uncategorized"
                      : "Uncategorized"
                    
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
                        <TableCell>
                          <Badge variant="outline">
                            {variationCounts[product.id] !== undefined ? variationCounts[product.id] : "—"} variation{variationCounts[product.id] !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>MWK {product.cost ? product.cost.toFixed(2) : "0.00"}</TableCell>
                        <TableCell>MWK {product.price.toFixed(2)}</TableCell>
                        <TableCell>{product.stock}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            status === "active" 
                              ? "bg-green-100 text-green-800"
                              : status === "low-stock"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {status === "active" ? "In Stock" : 
                             status === "low-stock" ? "Low Stock" : "Out of Stock"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedProduct(product)
                                setShowAddProduct(true)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteProduct(product)}
                              disabled={deletingProductId === product.id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <ProductModalTabs
        open={showAddProduct}
        onOpenChange={(open) => {
          setShowAddProduct(open)
          if (!open) {
            setSelectedProduct(null)
            handleProductSaved()
          }
        }}
        product={selectedProduct}
      />
      <DataExchangeModal
        open={showImport}
        onOpenChange={setShowImport}
        type="import"
        config={dataExchangeConfigs.products}
        onSuccess={() => {
          loadData()
        }}
      />
      </PageLayout>
    </DashboardLayout>
  )
}

