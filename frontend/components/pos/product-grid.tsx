"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Package } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Product {
  id: string
  name: string
  price: number
  barcode: string
  sku: string
  stock: number
}

interface ProductGridProps {
  products: Product[]
  onAddToCart: (product: Product) => void
}

export function ProductGrid({ products, onAddToCart }: ProductGridProps) {
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

  return (
    <ScrollArea className="flex-1">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-3 p-2">
        {products.map((product) => {
          const stockQty = Number(product.stock ?? 0)
          const lowStockThreshold = Number((product as any).low_stock_threshold ?? (product as any).lowStockThreshold ?? 0)
          const isLowStock = Boolean((product as any).is_low_stock || (lowStockThreshold > 0 && stockQty <= lowStockThreshold))

          return (
            <Card
              key={product.id}
              className="w-20 h-20 overflow-hidden cursor-pointer hover:border-primary transition-colors"
              onClick={() => onAddToCart(product)}
            >
              <CardContent className="h-full p-1 flex flex-col items-center text-center gap-1">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div className="w-full flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
                  <p className="font-medium text-xs line-clamp-2 overflow-hidden break-words">{product.name}</p>
                  <p className="text-xs text-muted-foreground truncate">MWK {(product.price || 0).toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Stock: {stockQty}
                    {isLowStock ? <span className="ml-1 font-semibold text-destructive">LOW</span> : null}
                  </p>
                </div>
                <Button size="sm" className="w-full flex-shrink-0" onClick={(e) => {
                  e.stopPropagation()
                  onAddToCart(product)
                }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </ScrollArea>
  )
}

