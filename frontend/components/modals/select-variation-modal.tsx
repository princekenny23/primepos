"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Package, Check } from "lucide-react"
import { useState, useEffect } from "react"
import { variationService, type ItemVariation } from "@/lib/services/productService"
import { useTenant } from "@/contexts/tenant-context"

interface SelectVariationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId?: string | number | null
  productName: string
  variations?: ItemVariation[]
  onSelect: (variation: ItemVariation) => void
  saleType?: "retail" | "wholesale"
}

export function SelectVariationModal({
  open,
  onOpenChange,
  productId,
  productName,
  variations: providedVariations,
  onSelect,
  saleType = "retail",
}: SelectVariationModalProps) {
  const { currentOutlet } = useTenant()
  const [variations, setVariations] = useState<ItemVariation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedVariation, setSelectedVariation] = useState<ItemVariation | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedVariation(null)
      return
    }

    // If variations are provided, use them directly
    if (providedVariations && providedVariations.length > 0) {
      setIsLoading(false)
      setVariations(providedVariations)
      setSelectedVariation(providedVariations.length === 1 ? providedVariations[0] : null)
      return
    }

    // Otherwise fetch by productId when available
    if (productId) {
      loadVariations()
    } else {
      setVariations([])
      setSelectedVariation(null)
    }
  }, [open, productId, providedVariations])

  const loadVariations = async () => {
    setIsLoading(true)
    try {
      const filters: any = { product: productId, is_active: true }
      if (currentOutlet?.id) {
        filters.outlet = currentOutlet.id
      }
      const data = await variationService.list(filters)
      setVariations(data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)))
      
      // Auto-select first variation if only one
      if (data.length === 1) {
        setSelectedVariation(data[0])
      }
    } catch (error: any) {
      console.error("Failed to load variations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirm = () => {
    if (selectedVariation) {
      onSelect(selectedVariation)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Variation</DialogTitle>
          <DialogDescription>
            Choose a variation for {productName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading variations...
          </div>
        ) : variations.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No active variations available</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {variations.map((variation) => {
                const isSelected = selectedVariation?.id === variation.id
                const stock = variation.total_stock !== undefined ? variation.total_stock : null
                const isOutOfStock = variation.track_inventory && stock !== null && stock <= 0
                
                return (
                  <div
                    key={variation.id}
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-all
                      ${isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"}
                      ${isOutOfStock ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                    onClick={() => !isOutOfStock && setSelectedVariation(variation)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{variation.name}</span>
                          {isSelected && (
                            <Badge variant="default" className="ml-2">
                              <Check className="h-3 w-3 mr-1" />
                              Selected
                            </Badge>
                          )}
                          {variation.track_inventory && stock !== null && (
                            <Badge 
                              variant={stock <= variation.low_stock_threshold ? "outline" : "secondary"}
                              className={stock <= variation.low_stock_threshold ? "text-orange-600 border-orange-600" : ""}
                            >
                              Stock: {stock} {variation.unit}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <div>Price: MWK {variation.price.toFixed(2)}</div>
                          {variation.sku && <div>SKU: {variation.sku}</div>}
                        </div>
                      </div>
                    </div>
                    {isOutOfStock && (
                      <div className="mt-2 text-xs text-destructive">
                        Out of stock
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedVariation || isLoading}
          >
            Add to Cart
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

