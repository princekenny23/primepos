"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, Package } from "lucide-react"
import { useState, useEffect, useMemo, useCallback } from "react"
import { productService } from "@/lib/services/productService"
import { useToast } from "@/components/ui/use-toast"
import { useBusinessStore } from "@/stores/businessStore"
import { formatCurrency } from "@/lib/utils/currency"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import type { Product } from "@/lib/types"

interface SelectProductModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (product: Product) => void
  outletId?: string
}

export function SelectProductModal({
  open,
  onOpenChange,
  onSelect,
  outletId,
}: SelectProductModalProps) {
  const { currentBusiness } = useBusinessStore()
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [hasMore, setHasMore] = useState(false)

  const loadProducts = useCallback(async (p: number, search = "") => {
    setIsLoading(true)
    try {
      const filters: any = { is_active: true, page: p, limit: pageSize }
      if (search) filters.search = search
      if (outletId) filters.outlet = outletId
      const response = await productService.list(filters)
      setProducts(response.results || [])
      // determine if there are more pages
      if (response.next) {
        setHasMore(true)
      } else if (typeof response.count === "number") {
        setHasMore(p * pageSize < (response.count || 0))
      } else {
        setHasMore((response.results || []).length === pageSize)
      }
    } catch (error) {
      console.error("Failed to load products:", error)
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, outletId])

  useEffect(() => {
    if (open) {
      loadProducts(page, searchTerm)
    } else {
      setSearchTerm("")
      setPage(1)
    }
  }, [open, loadProducts, page, searchTerm])

  // When using server-side search, we simply use the loaded products
  const filteredProducts = useMemo(() => products, [products])

  const handleSelectProduct = (product: Product) => {
    onSelect(product)
    onOpenChange(false)
    setSearchTerm("")
  }

  const handlePrev = () => {
    if (page > 1) setPage(p => p - 1)
  }

  const handleNext = () => {
    if (hasMore) setPage(p => p + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Product</DialogTitle>
          <DialogDescription>
            Search and select a product to add to the quotation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or barcode..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Products List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No products found</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="w-full text-left p-4 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{product.name}</p>
                            {product.is_low_stock && (
                              <Badge variant="destructive" className="text-xs">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {product.sku && (
                              <span>SKU: {product.sku}</span>
                            )}
                            <span>Stock: {product.stock || 0}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(product.retail_price || product.price || 0, currentBusiness)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex items-center justify-between mt-2">
                <div className="text-sm text-muted-foreground">Page {page}</div>
                <div className="space-x-2">
                  <Button size="sm" variant="ghost" onClick={handlePrev} disabled={page === 1}>
                    Prev
                  </Button>
                  <Button size="sm" onClick={handleNext} disabled={!hasMore}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

