"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Info } from "lucide-react"
import type { Product, ProductUnit } from "@/lib/types"

export interface CartItemData {
  id: string
  product: Product
  unit?: ProductUnit
  quantity: number
  price: number
  total: number
}

interface CartItemProps {
  item: CartItemData
  onUpdateQuantity: (quantity: number) => void
  onRemove: () => void
}

/**
 * Get conversion display text
 */
function getConversionDisplay(unit?: ProductUnit, quantity?: number): string | null {
  if (!unit || unit.conversion_factor === 1) return null

  const totalPieces = (quantity || 1) * unit.conversion_factor
  return `(${totalPieces} pieces)`
}

/**
 * Get item description for display
 */
function getItemDescription(product: Product): string {
  return product.name
}

export function CartItem({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  const conversionText = getConversionDisplay(item.unit, item.quantity)
  const unitLabel = item.unit ? (item.unit.conversion_factor > 1 ? item.unit.unit_name : "pcs") : "pcs"

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border">
      {/* Item details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {getItemDescription(item.product)}
        </p>

        {/* Unit info */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-gray-600">
            {unitLabel}
            {item.unit?.conversion_factor && item.unit.conversion_factor > 1 && (
              <span className="text-xs text-gray-500 ml-1">
                (1 {item.unit.unit_name} = {item.unit.conversion_factor} pcs)
              </span>
            )}
          </span>
        </div>

        {/* Price per unit */}
        <p className="text-sm text-gray-600 mt-1">
          MWK {Number(item.price || 0).toFixed(2)} per {unitLabel}
        </p>
      </div>

      {/* Quantity control */}
      <div className="flex items-center gap-1 border rounded-lg bg-white">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
          className="h-8 w-8 p-0 rounded-none"
        >
          −
        </Button>
        <Input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => {
            const val = parseInt(e.target.value)
            if (!isNaN(val) && val > 0) {
              onUpdateQuantity(val)
            }
          }}
          className="h-8 w-12 border-none text-center p-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onUpdateQuantity(item.quantity + 1)}
          className="h-8 w-8 p-0 rounded-none"
        >
          +
        </Button>
      </div>

      {/* Subtotal with conversion info */}
      <div className="text-right min-w-fit">
        <p className="font-semibold text-lg">
          MWK {Number(item.total || 0).toFixed(2)}
        </p>

        {/* Show piece conversion if applicable */}
        {conversionText && (
          <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {item.quantity} {unitLabel} = {item.quantity * (item.unit?.conversion_factor || 1)} pcs
          </p>
        )}
      </div>

      {/* Remove button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}

/**
 * Cart summary with unit conversion info
 */
interface CartSummaryProps {
  items: CartItemData[]
}

export function CartSummary({ items }: CartSummaryProps) {
  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPieces = items.reduce((sum, item) => {
    const piecesMultiplier = item.unit?.conversion_factor || 1
    return sum + item.quantity * piecesMultiplier
  }, 0)

  return (
    <div className="space-y-3 p-4 bg-white border rounded-lg">
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Total Units:</span>
          <span className="font-medium">{totalUnits}</span>
        </div>

        {/* Show piece count if different from unit count */}
        {totalPieces !== totalUnits && (
          <div className="flex justify-between pb-2 border-b">
            <span className="text-gray-600">Total Pieces:</span>
            <span className="font-medium text-blue-600">{totalPieces}</span>
          </div>
        )}

        <div className="flex justify-between text-lg font-bold pt-2">
          <span>Subtotal:</span>
          <span className="text-primary">MWK {Number(subtotal || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Conversion info tooltip */}
      {items.some(item => item.unit && item.unit.conversion_factor > 1) && (
        <div className="bg-blue-50 p-2 rounded text-xs text-blue-800">
          <p className="font-medium flex items-center gap-1 mb-1">
            <Info className="w-3 h-3" />
            Unit Conversions
          </p>
          <ul className="space-y-1 ml-4">
            {items
              .filter(item => item.unit && item.unit.conversion_factor > 1)
              .map((item, idx) => (
                <li key={idx}>
                  • {item.quantity} {item.unit?.unit_name} = {item.quantity * (item.unit?.conversion_factor || 1)} pcs
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
