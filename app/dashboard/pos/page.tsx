"use client"

import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, ShoppingCart, Receipt, Keyboard, UserPlus, Trash2, X } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useShift } from "@/contexts/shift-context"
import { format } from "date-fns"
import { ProductGrid } from "@/components/pos/product-grid"
import { CartPanel } from "@/components/pos/cart-panel"
import { PaymentSection } from "@/components/pos/payment-section"
import { ShortcutKeysLegend } from "@/components/pos/shortcut-keys-legend"
import { PaymentModal } from "@/components/modals/payment-modal"
import { DiscountModal } from "@/components/modals/discount-modal"
import { HoldRecallSaleModal } from "@/components/modals/hold-recall-sale-modal"
import { AddNewCustomerModal } from "@/components/modals/add-new-customer-modal"
import { ReceiptPreviewModal } from "@/components/modals/receipt-preview-modal"
import { RefundReturnModal } from "@/components/modals/refund-return-modal"
import { CustomItemModal } from "@/components/modals/custom-item-modal"
import { CloseRegisterModal } from "@/components/modals/close-register-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  discount: number
  total: number
}

export default function POSPage() {
  const router = useRouter()
  const { activeShift, isLoading: shiftLoading } = useShift()
  const [searchTerm, setSearchTerm] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeTab, setActiveTab] = useState("new-sale")
  const [showPayment, setShowPayment] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showHoldRecall, setShowHoldRecall] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [showCustomItem, setShowCustomItem] = useState(false)
  const [showClearCart, setShowClearCart] = useState(false)
  const [showCloseRegister, setShowCloseRegister] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CartItem | null>(null)

  // Show register closed screen if no active shift
  if (shiftLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!activeShift) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8">
          <div className="w-full max-w-2xl space-y-8">
            {/* Header Section */}
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">REGISTER CLOSED</h1>
                <p className="text-muted-foreground mt-2">
                  Please start your day shift to begin selling
                </p>
              </div>
            </div>

            {/* Action Card */}
            <Card>
              <CardHeader>
                <CardTitle>Start Day Shift</CardTitle>
                <CardDescription>
                  You need to start a day shift before you can process sales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => router.push("/dashboard/pos/start-shift")}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  START SELLING
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Mock products
  const products = [
    { id: "1", name: "Product A", price: 29.99, barcode: "1234567890123", sku: "SKU-001", stock: 45 },
    { id: "2", name: "Product B", price: 49.99, barcode: "1234567890124", sku: "SKU-002", stock: 12 },
    { id: "3", name: "Product C", price: 19.99, barcode: "1234567890125", sku: "SKU-003", stock: 3 },
    { id: "4", name: "Product D", price: 9.99, barcode: "1234567890126", sku: "SKU-004", stock: 78 },
    { id: "5", name: "Product E", price: 39.99, barcode: "1234567890127", sku: "SKU-005", stock: 23 },
    { id: "6", name: "Product F", price: 15.99, barcode: "1234567890128", sku: "SKU-006", stock: 56 },
  ]

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode.includes(searchTerm)
  )

  const addToCart = (product: typeof products[0]) => {
    const existingItem = cart.find(item => item.id === product.id)
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price - item.discount }
          : item
      ))
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        discount: 0,
        total: product.price,
      }])
    }
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQuantity, total: newQuantity * item.price - item.discount }
      }
      return item
    }))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const applyDiscount = (id: string, discount: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        return { ...item, discount, total: item.quantity * item.price - discount }
      }
      return item
    }))
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0)
  const tax = (subtotal - totalDiscount) * 0.1
  const total = subtotal - totalDiscount + tax

  const handleClearCart = () => {
    setCart([])
    setShowClearCart(false)
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header with Close Register Button */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
          <div className="flex items-center gap-2">
            {activeShift && (
              <div className="text-sm text-muted-foreground">
                Shift started: {format(new Date(activeShift.startTime), "MMM dd, yyyy 'at' HH:mm")}
              </div>
            )}
          </div>
          {activeShift && (
            <Button
              variant="outline"
              onClick={() => setShowCloseRegister(true)}
              className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="mr-2 h-4 w-4" />
              Close Register
            </Button>
          )}
        </div>

        <div className="flex-1 grid grid-cols-12 gap-4 p-4 min-h-0">
          {/* Left Sidebar - Products */}
          <div className="col-span-8 flex flex-col space-y-4 min-h-0">
            {/* Search Bar */}
            <div className="relative flex-shrink-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by barcode, name, or SKU..."
                className="pl-10 h-12 text-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="new-sale">New Sale</TabsTrigger>
                <TabsTrigger value="pending">Pending Sales</TabsTrigger>
                <TabsTrigger value="completed">Completed Sales</TabsTrigger>
              </TabsList>

              <TabsContent value="new-sale" className="flex-1 min-h-0 overflow-hidden">
                <div className="h-full flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowCustomItem(true)}>
                        Custom Item
                      </Button>
                      <Button variant="outline" onClick={() => setShowHoldRecall(true)}>
                        Hold/Recall
                      </Button>
                    </div>
                    <ShortcutKeysLegend />
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <ProductGrid products={filteredProducts} onAddToCart={addToCart} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pending" className="flex-1">
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No pending sales</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="completed" className="flex-1">
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No completed sales</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar - Cart and Payment */}
          <div className="col-span-4 flex flex-col space-y-4 min-h-0">
            {/* Cart Panel - Scrollable with more height */}
            <div className="flex-[2] min-h-0 overflow-y-auto">
              <CartPanel
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
                onApplyDiscount={(id) => {
                  setSelectedItem(cart.find(item => item.id === id) || null)
                  setShowDiscount(true)
                }}
                onClearCart={() => setShowClearCart(true)}
              />
            </div>

            {/* Payment Section - Sticky at bottom */}
            <div className="flex-shrink-0">
              <PaymentSection
                subtotal={subtotal}
                discount={totalDiscount}
                tax={tax}
                total={total}
                onPayment={() => setShowPayment(true)}
                onAddCustomer={() => setShowAddCustomer(true)}
                disabled={cart.length === 0}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PaymentModal
        open={showPayment}
        onOpenChange={setShowPayment}
        total={total}
        onComplete={() => {
          setShowPayment(false)
          setShowReceiptPreview(true)
        }}
      />
      <DiscountModal
        open={showDiscount}
        onOpenChange={setShowDiscount}
        item={selectedItem}
        onApply={(discount) => {
          if (selectedItem) {
            applyDiscount(selectedItem.id, discount)
          }
          setShowDiscount(false)
        }}
      />
      <HoldRecallSaleModal
        open={showHoldRecall}
        onOpenChange={setShowHoldRecall}
      />
      <AddNewCustomerModal
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
      />
      <ReceiptPreviewModal
        open={showReceiptPreview}
        onOpenChange={setShowReceiptPreview}
        cart={cart}
        subtotal={subtotal}
        discount={totalDiscount}
        tax={tax}
        total={total}
        onPrint={() => {
          setShowReceiptPreview(false)
          setCart([])
          // In production, trigger actual print here
        }}
        onSkip={() => {
          setShowReceiptPreview(false)
          setCart([])
        }}
      />
      <RefundReturnModal
        open={showRefund}
        onOpenChange={setShowRefund}
      />
      <CustomItemModal
        open={showCustomItem}
        onOpenChange={setShowCustomItem}
        onAdd={(item) => {
          setCart([...cart, item])
          setShowCustomItem(false)
        }}
      />
      <CloseRegisterModal
        open={showCloseRegister}
        onOpenChange={setShowCloseRegister}
      />

      {/* Clear Cart Confirmation */}
      <AlertDialog open={showClearCart} onOpenChange={setShowClearCart}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all items from the cart? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCart} className="bg-destructive text-destructive-foreground">
              Clear Cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

