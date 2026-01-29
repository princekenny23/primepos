'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  LayoutGrid,
  Utensils,
  ShoppingCart,
  Settings,
  Lock,
  Zap,
  Search,
} from 'lucide-react'

interface PosHeaderBarProps {
  activeView: 'products' | 'tables'
  onViewChange: (view: 'products' | 'tables') => void
  cartCount: number
  openOrdersCount?: number
  onNewOrder?: () => void
  onQuickSale?: () => void
  onOrderFinder?: () => void
  onManagerActions?: () => void
  onShowDiscount?: () => void
  isProcessing?: boolean
  posType?: 'bar' | 'restaurant' | 'retail'
}

/**
 * Unified POS header bar used across bar-pos, restaurant-pos, retail-pos
 * Provides view toggles, cart status, and quick action buttons
 */
export function PosHeaderBar({
  activeView,
  onViewChange,
  cartCount,
  openOrdersCount = 0,
  onNewOrder,
  onQuickSale,
  onOrderFinder,
  onManagerActions,
  onShowDiscount,
  isProcessing = false,
  posType = 'restaurant',
}: PosHeaderBarProps) {
  const viewIcon = activeView === 'products' ? LayoutGrid : Utensils

  return (
    <div className="border-b bg-card flex-shrink-0">
      <div className="px-3 py-2 flex items-center gap-3 overflow-x-auto">
        {/* View Toggle */}
        <Button
          variant={activeView === 'tables' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewChange('tables')}
        >
          <Utensils className="h-4 w-4 mr-1" />
          Tables
        </Button>

        <Button
          variant={activeView === 'products' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewChange('products')}
        >
          <LayoutGrid className="h-4 w-4 mr-1" />
          Products
        </Button>

        {/* Separator */}
        <Separator orientation="vertical" className="h-6" />

        {/* Cart Status */}
        <Badge variant="secondary" className="text-xs">
          <ShoppingCart className="h-3 w-3 mr-1" />
          Cart ({cartCount})
        </Badge>

        {/* Open Orders Badge */}
        {openOrdersCount > 0 && (
          <Badge variant="outline" className="text-xs">
            Orders ({openOrdersCount})
          </Badge>
        )}

        {/* Separator */}
        {(onNewOrder || onQuickSale || onOrderFinder) && (
          <Separator orientation="vertical" className="h-6" />
        )}

        {/* Action Buttons */}
        {onNewOrder && (
          <Button
            variant="outline"
            size="sm"
            onClick={onNewOrder}
            disabled={isProcessing}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Order
          </Button>
        )}

        {onQuickSale && (
          <Button
            variant="outline"
            size="sm"
            onClick={onQuickSale}
            disabled={isProcessing || cartCount === 0}
            title="Quick Sale"
          >
            <Zap className="h-4 w-4 mr-1" />
            Quick Sale
          </Button>
        )}

        {onOrderFinder && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOrderFinder}
            disabled={isProcessing}
            title="Find Order"
          >
            <Search className="h-4 w-4 mr-1" />
            Find Order
          </Button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Manager + Settings */}
        {onManagerActions && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManagerActions}
            disabled={isProcessing}
            title="Manager Actions"
          >
            <Lock className="h-4 w-4" />
          </Button>
        )}

        {onShowDiscount && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShowDiscount}
            disabled={isProcessing || cartCount === 0}
            title="Apply Discount"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// Import Plus icon
import { Plus } from 'lucide-react'
