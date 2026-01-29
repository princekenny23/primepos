"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Minus, AlertCircle, Info } from "lucide-react"
import { useState, useEffect } from "react"
import type { Product, ProductUnit } from "@/lib/types"

interface ProductSelectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product
  onConfirm: (selection: {
    product: Product
    unit?: ProductUnit
    quantity: number
    totalPrice: number
  }) => void
}

export function ProductSelectionModal({
  open,
  onOpenChange,
  product,
  onConfirm,
}: ProductSelectionModalProps) {
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [customPrice, setCustomPrice] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return

    // Auto-select single unit
    if (product.selling_units && product.selling_units.length === 1) {
      setSelectedUnit(product.selling_units[0])
    } else {
      setSelectedUnit(null)
    }

    setQuantity(1)
    setCustomPrice(null)
  }, [open, product])
  // Calculate available quantity
  const getAvailableQuantity = () => {
    const baseQty = product.stock || 0

    if (selectedUnit && selectedUnit.conversion_factor > 1) {
      return Math.floor(baseQty / selectedUnit.conversion_factor)
    }

    return baseQty
  }

  // Get effective price
  const getEffectivePrice = () => {
    if (customPrice !== null) return Number(customPrice || 0)

    if (selectedUnit) {
      return Number(selectedUnit.retail_price || 0)
    }

    return Number(product.retail_price || product.price || 0)
  }

  // Get unit label
  const getUnitLabel = () => {
    if (selectedUnit) {
      if (selectedUnit.conversion_factor > 1) {
        return `1 ${selectedUnit.unit_name} (${selectedUnit.conversion_factor} pcs)`
      }
      return selectedUnit.unit_name
    }
    return "piece"
  }

  // Get conversion info
  const getConversionInfo = () => {
    if (!selectedUnit || selectedUnit.conversion_factor === 1) return null

    return {
      unit: selectedUnit.unit_name,
      factor: selectedUnit.conversion_factor,
      totalPieces: quantity * selectedUnit.conversion_factor,
    }
  }

  const availableQty = getAvailableQuantity()
  const unitPrice = getEffectivePrice()
  const totalPrice = unitPrice * quantity
  const conversion = getConversionInfo()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {product.name}
          </DialogTitle>
          <DialogDescription>
            Select unit and quantity to add to cart
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Unit selector */}
            {product.selling_units && product.selling_units.length > 1 && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Unit</Label>
                <div className="grid grid-cols-2 gap-2">
                  {product.selling_units.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUnit(u)
                        setCustomPrice(null)
                      }}
                      className={`p-3 rounded-lg border-2 transition-colors text-left ${
                        selectedUnit?.id === u.id
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-primary"
                      }`}
                    >
                      <p className="font-medium text-sm">{u.unit_name}</p>
                      {u.conversion_factor > 1 && (
                        <p className="text-xs text-gray-600">
                          1 {u.unit_name} = {u.conversion_factor} pcs
                        </p>
                      )}
                      <p className="text-sm font-semibold text-primary mt-1">
                        MWK {Number(u.retail_price || 0).toFixed(2)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity selector */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Quantity</Label>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <div className="flex items-center border rounded-lg">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="rounded-none"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max={availableQty}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value)
                        if (!isNaN(val)) {
                          setQuantity(Math.min(availableQty, Math.max(1, val)))
                        }
                      }}
                      className="border-none text-center text-lg font-semibold flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuantity(Math.min(availableQty, quantity + 1))}
                      className="rounded-none"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {availableQty} {getUnitLabel()}
                  </p>
                </div>
              </div>
            </div>

            {/* Price override */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Unit Price (Optional)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={`Default: MWK ${unitPrice.toFixed(2)}`}
                    value={customPrice ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                      setCustomPrice(val === "" ? null : parseFloat(val))
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for default price</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* PREVIEW TAB */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              {/* Item summary */}
              <div className="bg-white p-4 rounded border">
                <p className="text-sm text-gray-600">Item</p>
                <p className="text-lg font-semibold">{product.name}</p>
                {selectedUnit && (
                  <p className="text-sm text-gray-600">Unit: {selectedUnit.unit_name}</p>
                )}
              </div>

              {/* Pricing breakdown */}
              <div className="bg-white p-4 rounded border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Unit Price</span>
                  <span className="font-medium">MWK {unitPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Quantity</span>
                  <span className="font-medium">
                    {quantity} {getUnitLabel()}
                  </span>
                </div>
                {conversion && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600">Conversion</span>
                    <span className="font-medium">
                      = {conversion.totalPieces} pieces
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">
                    MWK {totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Stock warning */}
              {quantity > availableQty / 2 && (
                <div className="bg-orange-50 border border-orange-200 p-3 rounded flex gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">Limited Stock</p>
                    <p className="text-xs">Only {availableQty} units available</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* INFO TAB */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Basic info */}
              <div className="bg-blue-50 p-4 rounded border border-blue-200">
                <p className="text-sm font-semibold text-blue-900 mb-2">Product Details</p>
                <div className="space-y-2 text-sm text-blue-800">
                  {product.sku && (
                    <p>
                      <span className="font-medium">SKU:</span> {product.sku}
                    </p>
                  )}
                  {product.barcode && (
                    <p>
                      <span className="font-medium">Barcode:</span> {product.barcode}
                    </p>
                  )}
                  {product.cost && (
                    <p>
                      <span className="font-medium">Cost:</span> MWK{" "}
                      {Number(product.cost || 0).toFixed(2)}
                    </p>
                  )}
                  {product.lowStockThreshold && (
                    <p>
                      <span className="font-medium">Low Stock Alert:</span>{" "}
                      {product.lowStockThreshold} units
                    </p>
                  )}
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="bg-gray-50 p-4 rounded border">
                  <p className="text-sm font-semibold mb-2">Description</p>
                  <p className="text-sm text-gray-700">{product.description}</p>
                </div>
              )}

              {/* Tips */}
              <div className="bg-green-50 p-4 rounded border border-green-200 flex gap-2">
                <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">Tip</p>
                  <p className="text-xs mt-1">
                    {selectedUnit && selectedUnit.conversion_factor > 1
                      ? `Selling in ${selectedUnit.unit_name}s helps track bulk sales accurately`
                      : "Select multiple units at checkout for more flexibility"}
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm({
                product,
                unit: selectedUnit || undefined,
                quantity,
                totalPrice,
              })
              onOpenChange(false)
            }}
            className="flex-1"
          >
            Add to Cart - MWK {totalPrice.toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
