"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Receipt } from "lucide-react"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  discount: number
  total: number
}

interface ReceiptPreviewProps {
  cart: CartItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
}

export function ReceiptPreview({ cart, subtotal, discount, tax, total }: ReceiptPreviewProps) {
  return (
    <Card className="flex-1 min-h-0 flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Receipt className="h-4 w-4" />
          Receipt Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="space-y-3 text-sm">
            <div className="text-center border-b pb-2">
              <p className="font-bold">PRIMEPOS</p>
              <p className="text-xs text-muted-foreground">Receipt</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date().toLocaleString()}
              </p>
            </div>

            <div className="space-y-1 border-b pb-2">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-xs">
                  <div className="flex-1">
                    <p>{item.name}</p>
                    <p className="text-muted-foreground">
                      {item.quantity} x ${item.price.toFixed(2)}
                      {item.discount > 0 && (
                        <span className="text-green-600 ml-1">
                          (-${item.discount.toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="font-medium">${item.total.toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs border-b pb-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>TOTAL</span>
              <span>${total.toFixed(2)}</span>
            </div>

            <div className="text-center text-xs text-muted-foreground pt-4 border-t">
              <p>Thank you for your purchase!</p>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

