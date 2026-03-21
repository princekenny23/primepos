"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Package } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import type { Product, ProductUnit } from "@/lib/types"

interface ProductGridProps {
  products: Product[]
  onAddToCart: (product: Product, unit?: ProductUnit, quantity?: number) => void
}

export function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null)
  const [showSelector, setShowSelector] = useState(false)

  if (products.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No products found</p>
        </div>
      </div>
    )
  }

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product)
    
    // Auto-select if only one unit or no units
    if (!product.selling_units || product.selling_units.length === 0) {
      setSelectedUnit(null)
    } else if (product.selling_units.length === 1) {
      setSelectedUnit(product.selling_units[0])
    } else {
      setSelectedUnit(null)
    }


    // Show selector if has multiple units
    // Otherwise add directly to cart
    if (product.selling_units && product.selling_units.length > 1) {
      setShowSelector(true)
    } else {
      // No selector needed - add directly with auto-selected unit
      const unit = product.selling_units && product.selling_units.length === 1 ? product.selling_units[0] : undefined
      onAddToCart(product, unit, 1)
    }
  }

  const handleAddToCart = () => {
    if (!selectedProduct) return

    onAddToCart(selectedProduct, selectedUnit || undefined, 1)
    
    setShowSelector(false)
    setSelectedProduct(null)
    setSelectedUnit(null)
  }

  // Get display price based on selection
  const getDisplayPrice = () => {
    if (selectedUnit) {
      return Number(selectedUnit.retail_price || 0)
    }

    return Number(selectedProduct?.retail_price || selectedProduct?.price || 0)
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-3">
          {products.map((product) => {
            return (
              <Card
                key={product.id}
                className="w-20 h-20 overflow-hidden cursor-pointer hover:shadow-md transition-shadow border border-muted"
                onClick={() => handleProductClick(product)}
              >
                <CardContent className="h-full p-1 flex flex-col justify-between">
                  <p className="text-xs font-medium leading-tight line-clamp-2 overflow-hidden break-words">
                    {product.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-auto">
                    Stock: {product.stock ?? 0}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </ScrollArea>

      {/* Unit/Variation selector dialog */}
      <Dialog open={showSelector} onOpenChange={setShowSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
            <DialogDescription>
              Select unit to add to cart
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Unit selector */}
            {selectedProduct?.selling_units && selectedProduct.selling_units.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={selectedUnit?.id ? String(selectedUnit.id) : ""}
                  onValueChange={(val) => {
                    const unit = selectedProduct.selling_units?.find(
                      (u) => String(u.id) === val
                    )
                    if (unit) setSelectedUnit(unit)
                  }}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProduct.selling_units.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.conversion_factor > 1
                          ? `${u.unit_name} (${u.conversion_factor} pcs) - MWK ${Number(u.retail_price || 0).toFixed(2)}`
                          : `${u.unit_name} - MWK ${Number(u.retail_price || 0).toFixed(2)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Price info */}
            <div className="bg-gray-50 p-3 rounded">
              <div className="flex justify-between text-sm">
                <span>Unit Price:</span>
                <span className="font-medium">
                  MWK {getDisplayPrice().toFixed(2)}
                </span>
              </div>
              {selectedUnit && selectedUnit.conversion_factor > 1 && (
                <p className="text-xs text-gray-600 mt-2">
                  = {selectedUnit.conversion_factor} pieces
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSelector(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddToCart}>
              Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
