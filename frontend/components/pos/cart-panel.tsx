"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Plus, Minus, X, Percent, Trash2, User, UserPlus } from "lucide-react"
import { CustomerSelectModal } from "@/components/modals/customer-select-modal"
import type { Customer } from "@/lib/services/customerService"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  discount: number
  total: number
}

interface CartPanelProps {
  cart: CartItem[]
  onUpdateQuantity: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onApplyDiscount: (id: string) => void
  onClearCart: () => void
  customer?: Customer | null
  onCustomerChange?: (customer: Customer | null) => void
}

export function CartPanel({ 
  cart, 
  onUpdateQuantity, 
  onRemove, 
  onApplyDiscount, 
  onClearCart,
  customer,
  onCustomerChange 
}: CartPanelProps) {
  const [showCustomerModal, setShowCustomerModal] = useState(false)

  const handleCustomerSelect = (selectedCustomer: Customer) => {
    if (onCustomerChange) {
      onCustomerChange(selectedCustomer)
    }
  }

  const handleRemoveCustomer = () => {
    if (onCustomerChange) {
      onCustomerChange(null)
    }
  }

  if (cart.length === 0) {
    return (
      <>
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Cart</span>
              <span className="text-sm font-normal text-muted-foreground">0 items</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {onCustomerChange && (
                <div className="flex items-center gap-2">
                  {customer ? (
                    <div className="flex items-center gap-2 flex-1 p-2 bg-muted rounded-lg">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium flex-1 truncate">{customer.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleRemoveCustomer}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowCustomerModal(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Customer
                    </Button>
                  )}
                </div>
              )}
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <div className="text-center">
                  <p>Cart is empty</p>
                  <p className="text-xs mt-1">Add products to get started</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {onCustomerChange && (
          <CustomerSelectModal
            open={showCustomerModal}
            onOpenChange={setShowCustomerModal}
            onSelect={handleCustomerSelect}
            selectedCustomer={customer || undefined}
          />
        )}
      </>
    )
  }

  return (
    <>
      <Card className="h-full flex flex-col min-h-[600px]">
        <CardHeader className="flex-shrink-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <span>Cart</span>
                <span className="text-sm font-normal text-muted-foreground">({cart.length} items)</span>
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={onClearCart}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {onCustomerChange && (
              <div className="flex items-center gap-2">
                {customer ? (
                  <div className="flex items-center gap-2 flex-1 p-2 bg-muted rounded-lg">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium flex-1 truncate">{customer.name}</span>
                    {customer.loyalty_points !== undefined && customer.loyalty_points > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {customer.loyalty_points} pts
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleRemoveCustomer}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowCustomerModal(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Customer
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-2 pr-4">
            {cart.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      MWK {Number(item.price || 0).toFixed(2)} each
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => onRemove(item.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdateQuantity(item.id, -1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="flex-1 text-center font-medium">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdateQuantity(item.id, 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {item.discount > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Discount:</span>
                        <span className="text-green-600">-MWK {Number(item.discount || 0).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onApplyDiscount(item.id)}
                  >
                    <Percent className="h-3 w-3 mr-1" />
                    Discount
                  </Button>
                  <span className="font-semibold">MWK {Number(item.total || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
    {onCustomerChange && (
      <CustomerSelectModal
        open={showCustomerModal}
        onOpenChange={setShowCustomerModal}
        onSelect={handleCustomerSelect}
        selectedCustomer={customer || undefined}
      />
    )}
    </>
  )
}

