"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { usePOSStore } from "@/stores/posStore"
import { useBusinessStore } from "@/stores/businessStore"
import { productService } from "@/lib/services/productService"
import { formatCurrency } from "@/lib/utils/currency"
import { PaymentPopup } from "@/components/pos/payment-popup"
// Receipt preview removed from POS terminal
import { printReceipt } from "@/lib/print"
// printReceiptAuto removed; using receipt preview modal
import { CustomerSelectModal } from "@/components/modals/customer-select-modal"
import { useShift } from "@/contexts/shift-context"
import { saleService } from "@/lib/services/saleService"
import { useToast } from "@/components/ui/use-toast"
import type { Customer } from "@/lib/services/customerService"
import type { Product } from "@/lib/types"
import { Package, Plus, Minus, ShoppingCart, X, User, Tag, RotateCcw, Lock, Ban } from "lucide-react"

interface ProductUnit {
  id: string | number
  unit_name: string
  conversion_factor: number
  retail_price: number
  wholesale_price?: number
  stock_in_unit?: number
}

export function SingleProductPOS() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { cart, addToCart, updateCartItem, removeFromCart, clearCart } = usePOSStore()
  const { activeShift } = useShift()
  const { toast } = useToast()
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSelect, setShowCustomerSelect] = useState(false)
  const [showPaymentMethod, setShowPaymentMethod] = useState(false)
  // Receipt preview removed from POS terminal
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)

  // Load products on mount
  useEffect(() => {
    const loadProducts = async () => {
      if (!currentBusiness) {
        setIsLoadingProducts(false)
        return
      }
      
      setIsLoadingProducts(true)
      try {
          const productsData = await productService.list({ is_active: true })
        const productsList = productsData.results || productsData
        setProducts(productsList)
        
        // Auto-select first product if available
        if (productsList.length > 0 && !selectedProduct) {
          setSelectedProduct(productsList[0])
          // Auto-select first unit if available
          const sellingUnits = (productsList[0] as any).units || (productsList[0] as any).selling_units || []
          if (sellingUnits.length > 0) {
            setSelectedUnit(sellingUnits[0])
          }
        }
      } catch (error: any) {
        console.error("Failed to load products:", error)
        toast({
          title: "Error",
          description: "Failed to load products. Please refresh the page.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingProducts(false)
      }
    }
    
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness])

  // Get available units for selected product
  const availableUnits = useMemo(() => {
    if (!selectedProduct) return []
    const sellingUnits = (selectedProduct as any).units || (selectedProduct as any).selling_units || []
    return sellingUnits.filter((u: any) => u.is_active !== false)
  }, [selectedProduct])

  // Get current price based on selected unit
  const currentPrice = useMemo(() => {
    if (!selectedProduct) return 0
    if (selectedUnit) {
      return parseFloat(String(selectedUnit.retail_price))
    }
    return selectedProduct.price || 0
  }, [selectedProduct, selectedUnit])

  // Calculate total
  const total = useMemo(() => {
    return currentPrice * quantity
  }, [currentPrice, quantity])

  // Get stock in selected unit
  const stockInUnit = useMemo(() => {
    if (!selectedProduct) return 0
    if (selectedUnit && selectedUnit.stock_in_unit !== undefined) {
      return selectedUnit.stock_in_unit
    }
    return selectedProduct.stock || 0
  }, [selectedProduct, selectedUnit])

  const handleAddToCart = () => {
    if (!selectedProduct) {
      toast({
        title: "Error",
        description: "Please select a product first.",
        variant: "destructive",
      })
      return
    }

    if (quantity <= 0) {
      toast({
        title: "Error",
        description: "Quantity must be greater than 0.",
        variant: "destructive",
      })
      return
    }

    const displayName = selectedUnit
      ? `${selectedProduct.name} (${selectedUnit.unit_name})`
      : selectedProduct.name

    addToCart({
      id: `cart_${Date.now()}_${Math.random()}`,
      productId: selectedProduct.id,
      name: displayName,
      price: currentPrice,
      quantity: quantity,
      saleType: "retail",
    })

    // Reset quantity after adding
    setQuantity(1)
    toast({
      title: "Added to cart",
      description: `${quantity} x ${displayName} added to cart`,
    })
  }

  const handleQuantityChange = (change: number) => {
    setQuantity((prev) => Math.max(1, prev + change))
  }

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Cart is empty. Add items to cart first.",
        variant: "destructive",
      })
      return
    }
    setShowPaymentMethod(true)
  }

  const handlePayment = async (paymentMethod: string, amount: number) => {
    if (!currentBusiness || !currentOutlet || !activeShift) {
      toast({
        title: "Error",
        description: "Missing required information. Please ensure you have an active shift.",
        variant: "destructive",
      })
      return
    }

    setIsProcessingPayment(true)
    try {
      const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
      
      const paymentTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

      const saleData = {
        outlet: String(currentOutlet.id),
        shift: String(activeShift.id),
        customer: selectedCustomer?.id ? String(selectedCustomer.id) : undefined,
        items_data: cart.map((item) => ({
          product_id: String(item.productId),
          quantity: item.quantity,
          price: item.price,
        })),
        subtotal: paymentTotal,
        total: paymentTotal,
        payment_method: paymentMethod as any,
        discount: 0,
        tax: 0,
      }

      const sale = await saleService.create(saleData as any)

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sale-completed"))
      }

      // Prepare receipt data
      const receiptCartItems = cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        discount: 0,
        total: item.price * item.quantity,
      }))

      clearCart()
      setSelectedCustomer(null)

      // Attempt to print the canonical saved sale (non-blocking)
      try {
        const fullSale = await saleService.get(String(sale.id))
        const receiptCartItems = (fullSale.items || []).map((it: any, idx: number) => ({
          id: it.productId ? `${it.productId}-${idx}` : `item-${idx}`,
          name: it.productName || it.product_name || it.name || "Item",
          price: it.price || 0,
          quantity: it.quantity || 0,
          total: it.total || (it.quantity || 0) * (it.price || 0),
        }))
        await printReceipt({ cart: receiptCartItems, subtotal: fullSale.subtotal || cartTotal, discount: fullSale.discount || 0, tax: fullSale.tax || 0, total: fullSale.total || cartTotal, sale: fullSale }, currentOutlet!.id)
        toast({ title: 'Printed receipt', description: `Receipt ${fullSale.id} sent to printer.` })
      } catch (err: any) {
        console.warn('Auto-print failed in SingleProductPOS:', err)
        // Non-blocking
      }
    } catch (error: any) {
      console.error("Failed to process payment:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingPayment(false)
      setShowPaymentMethod(false)
    }
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  if (isLoadingProducts) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <Package className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No products available. Please add products first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Single-Product POS</h1>
            <p className="text-sm text-muted-foreground">
              Fast quantity-first checkout
            </p>
          </div>
          <div className="flex items-center gap-4">
            {selectedCustomer ? (
              <Button
                variant="outline"
                onClick={() => setShowCustomerSelect(true)}
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                {selectedCustomer.name}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowCustomerSelect(true)}
              >
                <User className="h-4 w-4 mr-2" />
                Select Customer
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Product Selection Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Product Selection */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Label htmlFor="product-select">Product</Label>
                  <Select
                    value={selectedProduct?.id || ""}
                    onValueChange={(value) => {
                      const product = products.find((p) => p.id === value)
                      setSelectedProduct(product || null)
                      // Reset unit selection
                      if (product) {
                        const sellingUnits = (product as any).selling_units || []
                        setSelectedUnit(sellingUnits.length > 0 ? sellingUnits[0] : null)
                      } else {
                        setSelectedUnit(null)
                      }
                      setQuantity(1)
                    }}
                  >
                    <SelectTrigger id="product-select" className="h-12 text-base">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {selectedProduct && (
              <>
                {/* Unit Selection */}
                {availableUnits.length > 0 && (
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <Label htmlFor="unit-select">Selling Unit</Label>
                        <Select
                          value={selectedUnit?.id?.toString() || "base"}
                          onValueChange={(value) => {
                            if (value === "base") {
                              setSelectedUnit(null)
                            } else {
                              const unit = availableUnits.find(
                                (u: ProductUnit) => String(u.id) === value
                              )
                              setSelectedUnit(unit || null)
                            }
                            setQuantity(1)
                          }}
                        >
                          <SelectTrigger id="unit-select" className="h-12 text-base">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="base">
                              Base Unit ({selectedProduct.unit || "pcs"}) - {formatCurrency(selectedProduct.price || 0, currentBusiness)}
                            </SelectItem>
                            {availableUnits.map((unit: ProductUnit) => (
                              <SelectItem key={unit.id} value={String(unit.id)}>
                                {unit.unit_name} - {formatCurrency(unit.retail_price, currentBusiness)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quantity Input - Prominent */}
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <Label htmlFor="quantity" className="text-lg font-semibold">
                        Quantity
                      </Label>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-12 w-12"
                          onClick={() => handleQuantityChange(-1)}
                        >
                          <Minus className="h-5 w-5" />
                        </Button>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1
                            setQuantity(Math.max(1, val))
                          }}
                          className="h-12 text-2xl text-center font-bold"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-12 w-12"
                          onClick={() => handleQuantityChange(1)}
                        >
                          <Plus className="h-5 w-5" />
                        </Button>
                      </div>
                      {stockInUnit > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Stock available: {stockInUnit} {selectedUnit?.unit_name || selectedProduct.unit || "units"}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Price Display */}
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Unit Price:</span>
                        <span className="text-xl font-bold">
                          {formatCurrency(currentPrice, currentBusiness)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2">
                        <span className="text-lg font-semibold">Total:</span>
                        <span className="text-3xl font-bold text-primary">
                          {formatCurrency(total, currentBusiness)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Add to Cart Button */}
                <Button
                  onClick={handleAddToCart}
                  className="w-full h-14 text-lg font-semibold"
                  size="lg"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add to Cart
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="flex-1 lg:flex-none w-full lg:w-[520px] border-t lg:border-t-0 lg:border-l bg-card flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Cart ({cart.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <Card key={item.id} className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.price, currentBusiness)} × {item.quantity}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatCurrency(item.price * item.quantity, currentBusiness)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const newQuantity = Math.max(1, item.quantity - 1)
                          if (newQuantity === 1) {
                            removeFromCart(item.id)
                          } else {
                            updateCartItem(item.id, { quantity: newQuantity })
                          }
                        }}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Action Icons Row */}
          <div className="border-t bg-card px-3 py-2">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-amber-700"
                disabled={cart.length === 0}
                title="Apply discount"
              >
                <Tag className="h-4 w-4" />
                <span className="text-xs">Discount</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-blue-700"
                disabled={cart.length === 0}
                title="Process refund"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="text-xs">Refund</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-slate-700"
                disabled={cart.length === 0}
                title="Close register"
              >
                <Lock className="h-4 w-4" />
                <span className="text-xs">Close</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 text-red-600"
                disabled={cart.length === 0}
                title="Void sale"
              >
                <Ban className="h-4 w-4" />
                <span className="text-xs">Void</span>
              </Button>
            </div>
          </div>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <div className="border-t p-4 bg-muted/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Total:</span>
                <span className="text-2xl font-bold">
                  {formatCurrency(cartTotal, currentBusiness)}
                </span>
              </div>
              <Button
                className="w-full h-12 text-base font-semibold bg-blue-900 hover:bg-blue-800"
                size="lg"
                onClick={handleCheckout}
                disabled={isProcessingPayment || cart.length === 0}
              >
                {isProcessingPayment ? (
                  "Processing..."
                ) : (
                  "Process Payment"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CustomerSelectModal
        open={showCustomerSelect}
        onOpenChange={setShowCustomerSelect}
        onSelect={setSelectedCustomer}
        selectedCustomer={selectedCustomer || undefined}
      />
      
      <PaymentPopup
        open={showPaymentMethod}
        onClose={() => setShowPaymentMethod(false)}
        total={cartTotal}
        subtotal={cartTotal}
        discount={0}
        tax={0}
        customer={selectedCustomer}
        items={cart}
        onConfirm={(method, amount) => handlePayment(method, amount || cartTotal)}
      />

      {/* Receipt preview removed from POS terminal - printing is automatic */}
    </div>
  )
}

