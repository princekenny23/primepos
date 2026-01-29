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
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-2">
        {products.map((product) => (
          <Card
            key={product.id}
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => onAddToCart(product)}
          >
            <CardContent className="p-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <div className="w-full">
                  <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">MWK {(product.price || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Stock: {product.stock}</p>
                </div>
                <Button size="sm" className="w-full" onClick={(e) => {
                  e.stopPropagation()
                  onAddToCart(product)
                }}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}

