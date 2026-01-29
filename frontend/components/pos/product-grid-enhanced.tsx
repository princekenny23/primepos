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
import { Plus, Package, Info } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Product, ProductUnit } from "@/lib/types"

interface ProductGridProps {
  products: Product[]
  onAddToCart: (product: Product, unit?: ProductUnit, quantity?: number) => void
}

export function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null)
  const [quantity, setQuantity] = useState("1")
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

    setQuantity("1")
    
    // Show selector if has multiple units
    // Otherwise add directly to cart
    if (product.selling_units && product.selling_units.length > 1) {
      setShowSelector(true)
    } else {
      // No selector needed - add directly with auto-selected unit
      const qty = 1
      const unit = product.selling_units && product.selling_units.length === 1 ? product.selling_units[0] : undefined
      onAddToCart(product, unit, qty)
    }
  }

  const handleAddToCart = () => {
    if (!selectedProduct) return

    const qty = parseInt(quantity) || 1
    onAddToCart(selectedProduct, selectedUnit || undefined, qty)
    
    setShowSelector(false)
    setSelectedProduct(null)
    setSelectedUnit(null)
    setQuantity("1")
  }

  // Calculate available quantity per selected unit
  const getAvailableQuantity = () => {
    if (!selectedProduct) return 0
    
    if (selectedProduct.selling_units && selectedProduct.selling_units.length > 0 && selectedUnit) {
      const baseQty = selectedProduct.stock || 0
      return Math.floor(baseQty / selectedUnit.conversion_factor)
    }

    return selectedProduct.stock || 0
  }

  // Get display price based on selection
  const getDisplayPrice = () => {
    if (selectedUnit) {
      return Number(selectedUnit.retail_price || 0)
    }

    return Number(selectedProduct?.retail_price || selectedProduct?.price || 0)
  }

  // Get unit label
  const getUnitLabel = () => {
    if (selectedUnit) {
      if (selectedUnit.conversion_factor > 1) {
        return `1 ${selectedUnit.unit_name} (${selectedUnit.conversion_factor} pieces)`
      }
      return selectedUnit.unit_name
    }
    return "piece"
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
          {products.map((product) => {
            const hasUnits = (product.selling_units?.length || 0) > 0
            const stockStatus = product.is_low_stock ? "low" : "normal"
            const stockColor = stockStatus === "low" ? "text-orange-600" : "text-green-600"

            return (
              <Card
                key={product.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleProductClick(product)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center space-y-2">
                    {/* Product icon with stock indicator */}
                    <div className="relative w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-8 w-8 text-primary" />
                      {stockStatus === "low" && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-orange-500 rounded-full" />
                      )}
                    </div>

                    {/* Product info */}
                    <div className="w-full">
                      <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                      
                      {/* Unit info */}
                      {hasUnits && product.selling_units && (
                        <p className="text-xs text-gray-500 mt-1">
                          {product.selling_units.length} units
                        </p>
                      )}

                      {/* Price */}
                      <p className="text-sm font-semibold text-primary mt-1">
                        MWK {(product.retail_price || product.price || 0).toFixed(2)}
                      </p>

                      {/* Stock */}
                      <p className={`text-xs mt-1 ${stockColor}`}>
                        Stock: {product.stock}
                        {hasUnits && product.selling_units && product.selling_units.length > 0
                          ? ` (${product.selling_units[0].unit_name})`
                          : " pcs"}
                      </p>
                    </div>

                    {/* Add button */}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleProductClick(product)
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {hasUnits ? "Select" : "Add"}
                    </Button>
                  </div>
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
              Select variation and unit to add to cart
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

            {/* Quantity input */}
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity ({getUnitLabel()})</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    setQuantity(String(Math.max(1, parseInt(quantity) - 1)))
                  }
                >
                  −
                </Button>
                <Input
                  id="qty"
                  type="number"
                  min="1"
                  max={getAvailableQuantity()}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1 text-center"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    setQuantity(String(Math.min(getAvailableQuantity(), parseInt(quantity) + 1)))
                  }
                >
                  +
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Available: {getAvailableQuantity()} {getUnitLabel()}
              </p>
            </div>

            {/* Price info */}
            <div className="bg-gray-50 p-3 rounded">
              <div className="flex justify-between text-sm">
                <span>Unit Price:</span>
                <span className="font-medium">
                  MWK {getDisplayPrice().toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="font-medium">Subtotal:</span>
                <span className="font-semibold text-lg text-primary">
                  MWK {(getDisplayPrice() * parseInt(quantity)).toFixed(2)}
                </span>
              </div>
              {selectedUnit && selectedUnit.conversion_factor > 1 && (
                <p className="text-xs text-gray-600 mt-2">
                  = {parseInt(quantity) * selectedUnit.conversion_factor} pieces
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
