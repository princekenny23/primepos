"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { usePOSStore } from "@/stores/posStore"
import { useBusinessStore } from "@/stores/businessStore"
import { productService, categoryService } from "@/lib/services/productService"
import { formatCurrency } from "@/lib/utils/currency"
import { DiscountModal } from "@/components/modals/discount-modal"
import { SaleDiscountModal, type SaleDiscount } from "@/components/modals/sale-discount-modal"
import { CloseRegisterModal } from "@/components/modals/close-register-modal"
import { CustomerSelectModal } from "@/components/modals/customer-select-modal"
import { SelectUnitModal } from "@/components/modals/select-unit-modal"
import { ProductModalTabs } from "@/components/modals/product-modal-tabs"
import { PaymentMethodModal } from "@/components/modals/payment-method-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MoreVertical, Trash2 } from "lucide-react"
import { useShift } from "@/contexts/shift-context"
import { saleService } from "@/lib/services/saleService"
import { useToast } from "@/components/ui/use-toast"
import { printReceipt } from "@/lib/print"
import type { Customer } from "@/lib/services/customerService"
import type { Product } from "@/lib/types"
import { useI18n } from "@/contexts/i18n-context"
import { useBarcodeScanner } from "@/lib/hooks/useBarcodeScanner"
import { ProductGrid } from "@/components/pos/product-grid-enhanced"
import { CartItem as CartItemDisplay, CartSummary } from "@/components/pos/cart-item"
// Printing helper removed - reverted to receipt preview flow

type SaleType = "retail" | "wholesale"

interface ProductUnit {
  id: string | number
  unit_name: string
  conversion_factor: number | string
  retail_price: number | string
  wholesale_price?: number | string
  is_active?: boolean
  stock_in_unit?: number
}

export function RetailPOS() {
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { cart, addToCart, updateCartItem, removeFromCart, clearCart, holdSale } = usePOSStore()
  const { activeShift } = useShift()
  const { toast } = useToast()
  const { t } = useI18n()
  const [saleType, setSaleType] = useState<SaleType>("retail")
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showCustomerSelect, setShowCustomerSelect] = useState(false)
  const [showSaleTypeConfirm, setShowSaleTypeConfirm] = useState(false)
  const [pendingSaleType, setPendingSaleType] = useState<SaleType | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [showDiscount, setShowDiscount] = useState(false)
  const [showCloseRegister, setShowCloseRegister] = useState(false)
  // Receipt preview in POS has been removed; printing is handled automatically
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [showUnitSelector, setShowUnitSelector] = useState(false)
  const [selectedProductForUnit, setSelectedProductForUnit] = useState<any>(null)
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [selectedProductForVariation, setSelectedProductForVariation] = useState<any>(null)
  // Add product modal for creating product from barcode lookup
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [productToCreate, setProductToCreate] = useState<any | null>(null)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [showQuickSelectDropdown, setShowQuickSelectDropdown] = useState(false)
  const [showPaymentMethod, setShowPaymentMethod] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [showSaleDiscount, setShowSaleDiscount] = useState(false)
  const [saleDiscount, setSaleDiscount] = useState<SaleDiscount | null>(null)
  
  // Focus search on mount and after actions
  const searchInputRef = useRef<HTMLInputElement>(null)

  

  // Debounce search term for performance with bulk data
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Filter search results for dropdown (limit to 10 for performance)
  useEffect(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }

    const term = debouncedSearchTerm.toLowerCase()
    const results = products
      .filter((product: any) => {
        const matchesSearch = product.name?.toLowerCase().includes(term) ||
                             product.sku?.toLowerCase().includes(term) ||
                             product.barcode?.toLowerCase().includes(term)
        const matchesCategory = selectedCategory === "all" || 
                               product.categoryId === selectedCategory ||
                               (product.category && (product.category.id === selectedCategory || product.category.name === selectedCategory))
        return matchesSearch && matchesCategory && product.isActive
      })
      .slice(0, 10) // Limit to 10 results for performance

    setSearchResults(results)
    setShowSearchDropdown(results.length > 0)
  }, [debouncedSearchTerm, products, selectedCategory])

  // Get quick select items (all active products, limited to 20 for performance)
  const quickSelectItems = useMemo(() => {
    return products
      .filter((product: any) => {
        const matchesCategory = selectedCategory === "all" || 
                               product.categoryId === selectedCategory ||
                               (product.category && (product.category.id === selectedCategory || product.category.name === selectedCategory))
        return product.isActive
      })
      .slice(0, 20) // Limit to 20 items for quick selection
  }, [products, selectedCategory])

  const fetchProductsAndCategories = async () => {
    if (!currentBusiness) {
      setIsLoadingProducts(false)
      return
    }
    
    setIsLoadingProducts(true)
    setProductsError(null)
    
    try {
      const [productsData, categoriesData] = await Promise.all([
        productService.list({ is_active: true }),
        categoryService.list(),
      ])
      setProducts(productsData.results || productsData)
      setCategories(["all", ...(categoriesData.map((c: any) => c.name) || [])])
    } catch (error: any) {
      console.error("Failed to load products:", error)
      setProductsError("Failed to load products. Please refresh the page.")
      setProducts([])
      setCategories(["all"])
    } finally {
      setIsLoadingProducts(false)
    }
  }

  useEffect(() => {
    fetchProductsAndCategories()
  }, [currentBusiness])

  // Global barcode scanner handler (keyboard-wedge)
  const handleBarcodeScanned = async (code: string) => {
    const term = String(code).trim()
    if (!term) return

    try {
      const { products: matchedProducts } = await productService.lookup(term)

      // Single product match -> add to cart or open unit modal if multiple units exist
      if (matchedProducts && matchedProducts.length === 1) {
        const p = matchedProducts[0]
        // If product has multiple units, open unit modal
        const units = p.selling_units || []
        if (units.length > 1) {
          setSelectedProductForVariation(p)
          setShowUnitModal(true)
          return
        }

        // Single unit - add product directly
        const price = getProductPrice(p)
        addToCart({
          id: `cart_${Date.now()}_${Math.random()}`,
          productId: String(p.id),
          name: p.name,
          price: price,
          quantity: 1,
          saleType: saleType,
        })
        toast({ title: "Added to cart", description: `${p.name} added via barcode` })
        return
      }

      // No matches - offer to create product prefilled with barcode
      toast({ title: "No product found", description: "Would you like to create a product with this barcode?" })
      setProductToCreate({ barcode: term })
      setShowAddProductModal(true)
      return

    } catch (err: any) {
      console.error("Barcode lookup failed:", err)
      toast({ title: "Lookup failed", description: err.message || String(err), variant: "destructive" })
      return
    }
  }

  useBarcodeScanner({ onScan: handleBarcodeScanned })


  const filteredProducts = products.filter((product: any) => {
    const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || 
                           product.categoryId === selectedCategory ||
                           (product.category && (product.category.id === selectedCategory || product.category.name === selectedCategory))
    return matchesSearch && matchesCategory && product.isActive
  })

  const cartSubtotal = cart.reduce((sum, item) => sum + item.total, 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  
  // Calculate discount amount
  const discountAmount = useMemo(() => {
    if (!saleDiscount) return 0
    if (saleDiscount.type === "percentage") {
      return (cartSubtotal * saleDiscount.value) / 100
    }
    return saleDiscount.value
  }, [saleDiscount, cartSubtotal])
  
  // Calculate final total
  const cartTotal = cartSubtotal - discountAmount

  const cartDisplayItems = cart.map((item) => {
    const product = (products as any[]).find((p) => String(p.id) === String(item.productId)) || {
      id: item.productId,
      name: item.name,
      retail_price: item.price,
      price: item.price,
      units: [],
      variations: [],
    }
    const variation = product?.variations?.find((v: any) => String(v.id) === String(item.variationId))
    const units = (product as any).units || (product as any).selling_units || []
    const unit = units.find((u: any) => String(u.id) === String(item.unitId))

    return {
      id: item.id,
      product,
      variation,
      unit,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
    }
  })

  // Get price based on sale type
  const getProductPrice = (product: any): number => {
    if (saleType === "wholesale") {
      return product.wholesale_price || product.wholesalePrice || product.price || 0
    }
    return product.price || 0
  }

  const addCartWithDetails = (product: any, variation?: any, unit?: any, quantity = 1) => {
    const basePrice = unit?.retail_price ?? unit?.price ?? variation?.price ?? product.retail_price ?? product.price ?? getProductPrice(product)
    const displayNameParts = [product.name]
    if (variation?.name) displayNameParts.push(`- ${variation.name}`)
    if (unit?.unit_name) displayNameParts.push(`(${unit.unit_name})`)
    const displayName = displayNameParts.join(" ")

    addToCart({
      id: `cart_${Date.now()}_${Math.random()}`,
      productId: String(product.id),
      name: displayName,
      price: basePrice,
      quantity: quantity || 1,
      saleType: saleType,
      variationId: variation?.id ? String(variation.id) : undefined,
      unitId: unit?.id ? String(unit.id) : undefined,
    })
  }

  const handleProductGridAdd = (product: any, variation?: any, unit?: any, quantity = 1) => {
    addCartWithDetails(product, variation, unit, quantity)
  }

  const handleAddToCart = async (product: any) => {
    // Check if product has multiple selling units
    const sellingUnits = (product as any).units || (product as any).selling_units || []
    const activeUnits = sellingUnits.filter((u: any) => u.is_active !== false)
    
    if (activeUnits.length > 1) {
      setSelectedProductForVariation(product)
      setShowUnitModal(true)
      return
    }
    
    if (activeUnits.length > 0) {
      // Show unit selector popup
      setSelectedProductForUnit(product)
      setShowUnitSelector(true)
      return
    }

    // No variations or units - add directly to cart
    addCartWithDetails(product, undefined, undefined, 1)
  }

  const handleUnitSelected = (unit: ProductUnit | null) => {
    if (!selectedProductForVariation) return

    // If unit is null, use base unit (conversion_factor = 1.0)
    if (!unit) {
      addCartWithDetails(selectedProductForVariation, undefined, undefined, 1)
      setSelectedProductForVariation(null)
      setShowUnitModal(false)
      return
    }

    // Use selected unit
    addCartWithDetails(selectedProductForVariation, undefined, unit, 1)

    setSelectedProductForVariation(null)
    setShowUnitModal(false)
  }

  const handleQuantityChange = (itemId: string, change: number) => {
    const item = cart.find(i => i.id === itemId)
    if (item) {
      const newQuantity = Math.max(1, item.quantity + change)
      updateCartItem(itemId, { quantity: newQuantity })
    }
  }

  const handleHoldSale = () => {
    const holdId = holdSale()
    alert(`Sale held with ID: ${holdId}`)
  }

  const handleSaleTypeChange = (newType: SaleType) => {
    if (cart.length > 0 && saleType !== newType) {
      setPendingSaleType(newType)
      setShowSaleTypeConfirm(true)
    } else {
      setSaleType(newType)
    }
  }

  const handleConfirmSaleTypeChange = () => {
    if (pendingSaleType) {
      clearCart()
      setSelectedCustomer(null)
      setSaleType(pendingSaleType)
      setPendingSaleType(null)
      setShowSaleTypeConfirm(false)
    }
  }

  const handleCancelSaleTypeChange = () => {
    setPendingSaleType(null)
    setShowSaleTypeConfirm(false)
  }

  const handleCheckout = async () => {
    // Validation
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to cart before processing payment.",
        variant: "destructive",
      })
      return
    }

    if (!currentOutlet) {
      toast({
        title: "Outlet not selected",
        description: "Please select an outlet before processing payment.",
        variant: "destructive",
      })
      return
    }

    if (!activeShift) {
      toast({
        title: "No active shift",
        description: "Please start a shift before processing payments.",
        variant: "destructive",
      })
      return
    }

    // Show payment method selection modal
    setShowPaymentMethod(true)
  }

  const handlePaymentConfirm = async (method: "cash" | "card" | "mobile" | "tab", amount?: number, change?: number) => {
    setShowPaymentMethod(false)
    
    // Re-validate (shouldn't happen, but safety check)
    if (!currentOutlet || !activeShift) {
      toast({
        title: "Error",
        description: "Outlet or shift not available.",
        variant: "destructive",
      })
      setIsProcessingPayment(false)
      return
    }
    
    setIsProcessingPayment(true)

    try {
      // Calculate totals - round to 2 decimal places to avoid floating point precision issues
      const subtotal = Math.round(cartSubtotal * 100) / 100
      const discount = Math.round(discountAmount * 100) / 100
      const tax = 0 // TODO: Calculate tax if needed
      const total = Math.round((subtotal - discount + tax) * 100) / 100

      // Transform cart items to backend format
      const items_data = cart.map((item) => {
        // Extract variation_id and unit_id from item if stored
        // For now, we'll use product_id only (backend will handle variations if needed)
        return {
          product_id: item.productId,
          variation_id: (item as any).variationId || undefined,
          unit_id: (item as any).unitId || undefined,
          quantity: item.quantity,
          price: Math.round(item.price * 100) / 100, // Round price to 2 decimal places
          notes: item.notes || "",
        }
      })

      // Create sale data - ensure all decimal values are rounded to 2 decimal places
      // TypeScript knows currentOutlet and activeShift are not null due to the check above
      const saleData = {
        outlet: currentOutlet!.id,
        shift: activeShift!.id,
        customer: selectedCustomer?.id || undefined,
        items_data: items_data,
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        discount_type: saleDiscount?.type,
        discount_reason: saleDiscount?.reason,
        total: Math.round(total * 100) / 100,
        payment_method: method,
        notes: method === "tab" ? "Credit sale" : "",
      }

      // Call backend API
      const sale = await saleService.create(saleData)
      // Fetch canonical sale from backend to ensure printed receipt matches DB
      let fullSale = sale
      try {
        fullSale = await saleService.get(String(sale.id))
      } catch (err) {
        // If fetching fails, fall back to the created sale response
        console.warn('Failed to fetch full sale from backend, using immediate response', err)
      }

      // Show success message
      const saleAny = sale as any
      const receiptNumber = saleAny._raw?.receipt_number || saleAny.receipt_number || sale.id
      toast({
        title: "Sale completed successfully",
        description: `Receipt #${receiptNumber}`,
      })

      // Dispatch event to notify other components (e.g., sales history page)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sale-completed', { 
          detail: { saleId: sale.id, receiptNumber: receiptNumber }
        }))
      }

      // Prepare receipt data for modal
      // Prefer items from the backend canonical sale when available
      const receiptCartItems = (fullSale.items || []).map((it: any, idx: number) => ({
        id: it.productId ? `${it.productId}-${idx}` : `item-${idx}`,
        name: it.productName || it.product_name || it.name || "Item",
        price: it.price || 0,
        quantity: it.quantity || 0,
        discount: 0,
        total: it.total || (it.quantity || 0) * (it.price || 0),
      }))

      // Do not show receipt preview in the POS terminal; printing is handled automatically

      // Clear cart and discount
      clearCart()
      setSelectedCustomer(null)
      setSaleDiscount(null)

  // Receipt preview removed: we no longer open a preview modal in the POS terminal
      // Attempt to auto-print (non-blocking). Uses QZ Tray and saved default printer.
      ;(async () => {
        try {
          const outletId = typeof currentOutlet!.id === 'string' ? parseInt(String(currentOutlet!.id), 10) : currentOutlet!.id
          await printReceipt({ cart: receiptCartItems, subtotal: fullSale.subtotal ?? subtotal, discount: fullSale.discount ?? discount, tax: fullSale.tax ?? tax, total: fullSale.total ?? total, sale: fullSale }, outletId)
          // optional: show a subtle toast on success
          toast({ title: "Printed receipt", description: `Receipt ${receiptNumber} sent to printer.` })
        } catch (err: any) {
          // Non-blocking failure - inform user but don't interrupt flow
          console.error("Auto-print failed:", err)
          toast({ title: "Print failed", description: err?.message || "Unable to print receipt. Check printer settings.", variant: "destructive" })
        }
      })()
    } catch (error: any) {
      console.error("Checkout error:", error)
      toast({
        title: "Payment failed",
        description: error.message || "An error occurred while processing the payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const handleReturn = () => {
    // TODO: Implement return functionality
    toast({
      title: "Return",
      description: "Return functionality coming soon.",
    })
  }

  const handleRefund = () => {
    // TODO: Implement refund functionality
    toast({
      title: "Refund",
      description: "Refund functionality coming soon.",
    })
  }

  if (!currentBusiness) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Please select a business first</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-background h-screen">
      {/* Compact Header */}
      <div className="border-b bg-card px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-lg font-bold">POS Terminal</div>
            <div className="text-xs text-muted-foreground">{currentBusiness.name}</div>
          </div>
          <Tabs value={saleType} onValueChange={(value) => handleSaleTypeChange(value as SaleType)}>
            <TabsList>
              <TabsTrigger value="retail">Retail</TabsTrigger>
              <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Products Panel - Clean List View */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Search Bar with Dropdown */}
          <div className="p-3 border-b bg-card">
            <div className="relative">
              <Input
                ref={searchInputRef}
                placeholder={t("pos.search_placeholder")}
                className="w-full"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  if (e.target.value.length >= 2) {
                    setShowSearchDropdown(true)
                    setShowQuickSelectDropdown(false)
                  } else {
                    setShowSearchDropdown(false)
                  }
                }}
                onFocus={() => {
                  // Only show search dropdown if user has typed search term
                  if (searchTerm.length >= 2 && searchResults.length > 0) {
                    setShowSearchDropdown(true)
                  }
                  setShowQuickSelectDropdown(false)
                }}
                onBlur={() => {
                  // Delay to allow click on dropdown items
                  setTimeout(() => {
                    setShowSearchDropdown(false)
                    setShowQuickSelectDropdown(false)
                  }, 200)
                }}
                onClick={() => {
                  // Don't auto-show dropdowns on click, only show when searching
                  setShowQuickSelectDropdown(false)
                  setShowSearchDropdown(false)
                }}
                autoFocus
                onKeyDown={async (e) => {
                  // If Enter is pressed, handle barcode lookup professionally when input looks like a barcode
                  if (e.key === "Enter") {
                    const term = searchTerm.trim()
                    const barcodeLike = /^[0-9A-Za-z]{6,}$/.test(term) // flexible barcode heuristic

                    if (barcodeLike) {
                      try {
                        const { products: matchedProducts } = await productService.lookup(term)

                        // Single product match -> add to cart or open unit modal if multiple units exist
                        if (matchedProducts && matchedProducts.length === 1) {
                          const p = matchedProducts[0]
                          const units = p.selling_units || []
                          if (units.length > 1) {
                            setSelectedProductForVariation(p)
                            setShowUnitModal(true)
                            setSearchTerm("")
                            setShowSearchDropdown(false)
                            return
                          }
                          
                          // Single unit - add product directly
                          const price = getProductPrice(p)
                          addCartWithDetails(p, undefined, undefined, 1)
                          toast({ title: "Added to cart", description: `${p.name} added via barcode` })
                          setSearchTerm("")
                          setShowSearchDropdown(false)
                          return
                        }

                        // No matches - offer to create product prefilled with barcode
                        toast({ title: "No product found", description: "Would you like to create a product with this barcode?" })
                        setProductToCreate({ barcode: term })
                        setShowAddProductModal(true)
                        setSearchTerm("")
                        setShowSearchDropdown(false)
                        return

                      } catch (err: any) {
                        console.error("Barcode lookup failed:", err)
                        toast({ title: "Lookup failed", description: err.message || String(err), variant: "destructive" })
                        return
                      }
                    }

                    // Fallback: if searchResults available, add first
                    if (searchResults.length > 0) {
                      handleAddToCart(searchResults[0])
                      setSearchTerm("")
                      setShowSearchDropdown(false)
                    }

                  } else if (e.key === "Escape") {
                    setShowSearchDropdown(false)
                    setShowQuickSelectDropdown(false)
                  }
                }}
              />
              
              {/* Quick Select Dropdown - Shows when search bar is clicked and empty */}
              {showQuickSelectDropdown && quickSelectItems.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                  <div className="px-3 py-2 border-b bg-muted/50">
                    <div className="text-xs font-medium text-muted-foreground">
                      Quick Select ({quickSelectItems.length} items)
                    </div>
                  </div>
                  {quickSelectItems.map((product: any) => {
                    const price = getProductPrice(product)
                    const sellingUnits = product.selling_units || []
                    const activeUnits = sellingUnits.filter((u: any) => u.is_active !== false)
                    const hasUnits = activeUnits.length > 0
                    
                    const handleQuickSelectUnitSelect = (unitId: string) => {
                      if (unitId === "base") {
                        // Use base unit
                        const price = getProductPrice(product)
                        addToCart({
                          id: `cart_${Date.now()}_${Math.random()}`,
                          productId: String(product.id),
                          name: product.name,
                          price: price,
                          quantity: 1,
                          saleType: saleType,
                        })
                      } else {
                        // Find selected unit
                        const selectedUnit = activeUnits.find((u: any) => String(u.id) === unitId)
                        if (selectedUnit) {
                          const unitPrice = saleType === "wholesale" && selectedUnit.wholesale_price
                            ? parseFloat(String(selectedUnit.wholesale_price))
                            : parseFloat(String(selectedUnit.retail_price))
                          const displayName = `${product.name} (${selectedUnit.unit_name})`
                          addToCart({
                            id: `cart_${Date.now()}_${Math.random()}`,
                            productId: String(product.id),
                            name: displayName,
                            price: unitPrice,
                            quantity: 1,
                            saleType: saleType,
                          })
                        }
                      }
                      setShowQuickSelectDropdown(false)
                      setTimeout(() => {
                        searchInputRef.current?.focus()
                      }, 100)
                    }
                    
                    return (
                      <div
                        key={product.id}
                        className="w-full px-4 py-3 hover:bg-accent border-b last:border-b-0 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          if (!hasUnits) {
                            handleAddToCart(product)
                            setShowQuickSelectDropdown(false)
                            setTimeout(() => {
                              searchInputRef.current?.focus()
                            }, 100)
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{product.name}</div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {product.sku && <span>SKU: {product.sku}</span>}
                              {product.barcode && <span>Barcode: {product.barcode}</span>}
                              {product.stock !== undefined && (
                                <span className={product.stock <= 10 ? "text-destructive font-medium" : ""}>
                                  Stock: {product.stock}
                                </span>
                              )}
                            </div>
                            {hasUnits && (
                              <div className="mt-2">
                                <Select onValueChange={handleQuickSelectUnitSelect}>
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue placeholder={t("pos.select_unit")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="base">
                                      Base Unit - {formatCurrency(price, currentBusiness)}
                                    </SelectItem>
                                    {activeUnits.map((unit: any) => {
                                      const unitPrice = saleType === "wholesale" && unit.wholesale_price
                                        ? parseFloat(String(unit.wholesale_price))
                                        : parseFloat(String(unit.retail_price))
                                      return (
                                        <SelectItem key={unit.id} value={String(unit.id)}>
                                          {unit.unit_name} - {formatCurrency(unitPrice, currentBusiness)}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          {!hasUnits && (
                            <div className="ml-4 text-right">
                              <div className="font-bold text-sm">{formatCurrency(price, currentBusiness)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              
              {/* Search Results Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                  {searchResults.map((product: any) => {
                    const price = getProductPrice(product)
                    const sellingUnits = product.selling_units || []
                    const activeUnits = sellingUnits.filter((u: any) => u.is_active !== false)
                    const hasUnits = activeUnits.length > 0
                    
                    const handleSearchUnitSelect = (unitId: string) => {
                      if (unitId === "base") {
                        // Use base unit
                        const price = getProductPrice(product)
                        addToCart({
                          id: `cart_${Date.now()}_${Math.random()}`,
                          productId: String(product.id),
                          name: product.name,
                          price: price,
                          quantity: 1,
                          saleType: saleType,
                        })
                      } else {
                        // Find selected unit
                        const selectedUnit = activeUnits.find((u: any) => String(u.id) === unitId)
                        if (selectedUnit) {
                          const unitPrice = saleType === "wholesale" && selectedUnit.wholesale_price
                            ? parseFloat(String(selectedUnit.wholesale_price))
                            : parseFloat(String(selectedUnit.retail_price))
                          const displayName = `${product.name} (${selectedUnit.unit_name})`
                          addToCart({
                            id: `cart_${Date.now()}_${Math.random()}`,
                            productId: String(product.id),
                            name: displayName,
                            price: unitPrice,
                            quantity: 1,
                            saleType: saleType,
                          })
                        }
                      }
                      setSearchTerm("")
                      setShowSearchDropdown(false)
                      setTimeout(() => {
                        searchInputRef.current?.focus()
                      }, 100)
                    }
                    
                    return (
                      <div
                        key={product.id}
                        className="w-full px-4 py-3 hover:bg-accent border-b last:border-b-0 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          if (!hasUnits) {
                            handleAddToCart(product)
                            setSearchTerm("")
                            setShowSearchDropdown(false)
                            setTimeout(() => {
                              searchInputRef.current?.focus()
                            }, 100)
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{product.name}</div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              {product.sku && <span>SKU: {product.sku}</span>}
                              {product.barcode && <span>Barcode: {product.barcode}</span>}
                              {product.stock !== undefined && (
                                <span className={product.stock <= 10 ? "text-destructive font-medium" : ""}>
                                  Stock: {product.stock}
                                </span>
                              )}
                            </div>
                            {hasUnits && (
                              <div className="mt-2">
                                <Select onValueChange={handleSearchUnitSelect}>
                                  <SelectTrigger className="w-full h-8 text-xs">
                                    <SelectValue placeholder={t("pos.select_unit")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="base">
                                      Base Unit - {formatCurrency(price, currentBusiness)}
                                    </SelectItem>
                                    {activeUnits.map((unit: any) => {
                                      const unitPrice = saleType === "wholesale" && unit.wholesale_price
                                        ? parseFloat(String(unit.wholesale_price))
                                        : parseFloat(String(unit.retail_price))
                                      return (
                                        <SelectItem key={unit.id} value={String(unit.id)}>
                                          {unit.unit_name} - {formatCurrency(unitPrice, currentBusiness)}
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          {!hasUnits && (
                            <div className="ml-4 text-right">
                              <div className="font-bold text-sm">{formatCurrency(price, currentBusiness)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Category Filter - Compact */}
          {categories.length > 1 && (
            <div className="px-3 py-2 border-b bg-muted/30 flex gap-1 flex-wrap">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => setSelectedCategory("all")}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-4 min-w-fit"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          )}

          {/* Products Grid - Enhanced */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingProducts ? (
              <div className="p-8 text-center text-muted-foreground">Loading products...</div>
            ) : productsError ? (
              <div className="p-8 text-center text-destructive">{productsError}</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No products found</div>
            ) : (
              <ProductGrid
                products={filteredProducts as any}
                onAddToCart={(
                  product,
                  unit,
                  quantity
                ) => handleProductGridAdd(product as any, undefined, unit as any, quantity)}
              />
            )}
          </div>
        </div>

        {/* Cart Panel - Table Based */}
        <div className="w-96 border-l bg-card flex flex-col">
          {/* Cart Header */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Cart ({cartItemCount})</div>
            </div>
            
            {/* Customer Selection */}
            {selectedCustomer ? (
              <div className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                <span className="truncate font-medium">{selectedCustomer.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-xs"
                  onClick={() => setSelectedCustomer(null)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={() => setShowCustomerSelect(true)}
              >
                Select Customer
              </Button>
            )}
          </div>

          {/* Cart Items Table */}
          <div className="flex-1 overflow-y-auto border-b">
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Cart is empty
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow className="border-b">
                    <TableHead className="h-8 px-2 py-1 text-xs font-semibold">Product</TableHead>
                    <TableHead className="h-8 px-2 py-1 text-xs font-semibold text-right w-16">Price</TableHead>
                    <TableHead className="h-8 px-2 py-1 text-xs font-semibold text-right w-12">Qty</TableHead>
                    <TableHead className="h-8 px-2 py-1 text-xs font-semibold text-right w-20">Subtotal</TableHead>
                    <TableHead className="h-8 px-2 py-1 text-xs font-semibold text-center w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cartDisplayItems.map((item) => (
                    <TableRow key={item.id} className="border-b hover:bg-muted/40 h-10">
                      <TableCell className="px-2 py-1 text-xs font-medium truncate">{item.product.name}</TableCell>
                      <TableCell className="px-2 py-1 text-xs text-right">{formatCurrency(item.price, currentBusiness)}</TableCell>
                      <TableCell className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => updateCartItem(item.id, { quantity: item.quantity - 1 })}
                            disabled={item.quantity <= 1}
                          >
                            −
                          </Button>
                          <span className="text-xs font-medium w-6 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                          >
                            +
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1 text-xs text-right font-semibold">{formatCurrency(item.total, currentBusiness)}</TableCell>
                      <TableCell className="px-2 py-1 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Summary & Payment Footer */}
          {cart.length > 0 && (
            <div className="p-3 bg-muted/30 space-y-3">
              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(cartSubtotal, currentBusiness)}</span>
                </div>
                {saleDiscount && discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="font-medium text-red-600">-{formatCurrency(discountAmount, currentBusiness)}</span>
                  </div>
                )}
                <div className="col-span-2 flex justify-between font-semibold text-sm border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(cartTotal, currentBusiness)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  size="sm"
                  onClick={handleCheckout}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? "Processing..." : "PAY"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setShowSaleDiscount(true)}>
                      Discount
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      // Handle Return
                      toast({ title: "Return", description: "Feature coming soon" })
                    }}>
                      Return
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      // Handle Refund
                      toast({ title: "Refund", description: "Feature coming soon" })
                    }}>
                      Refund
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      // Handle Hold Sale
                      toast({ title: "Hold Sale", description: "Feature coming soon" })
                    }}>
                      Hold Sale
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowCloseRegister(true)}>
                      Close Register
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={clearCart}
                      className="text-red-600"
                    >
                      Clear Cart
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <SaleDiscountModal
        open={showSaleDiscount}
        onOpenChange={setShowSaleDiscount}
        subtotal={cartSubtotal}
        currentDiscount={saleDiscount}
        business={currentBusiness}
        onApply={(discount) => {
          setSaleDiscount(discount)
        }}
        onRemove={() => {
          setSaleDiscount(null)
        }}
      />
      <CloseRegisterModal
        open={showCloseRegister}
        onOpenChange={setShowCloseRegister}
      />
      <CustomerSelectModal
        open={showCustomerSelect}
        onOpenChange={setShowCustomerSelect}
        onSelect={setSelectedCustomer}
        selectedCustomer={selectedCustomer || undefined}
      />
      
      {/* Unit Selection Modal - Shows popup when product has multiple units */}
      {selectedProductForUnit && (
        <SelectUnitModal
          open={showUnitSelector}
          onOpenChange={(open) => {
            setShowUnitSelector(open)
            if (!open) {
              setSelectedProductForUnit(null)
            }
          }}
          product={selectedProductForUnit}
          saleType={saleType}
          onSelect={handleUnitSelected}
        />
      )}

      {/* Unit Selection Modal */}
      {selectedProductForVariation && (
        <SelectUnitModal
          open={showUnitModal}
          onOpenChange={(open) => {
            setShowUnitModal(open)
            if (!open) {
              setSelectedProductForVariation(null)
            }
          }}
          product={selectedProductForVariation}
          saleType={saleType}
          onSelect={handleUnitSelected}
        />
      )}
      
      {/* Sale Type Change Confirmation */}
      <AlertDialog open={showSaleTypeConfirm} onOpenChange={setShowSaleTypeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching to <strong>{pendingSaleType}</strong> will clear your current cart. 
              All items in the cart will be removed. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSaleTypeChange}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSaleTypeChange}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Receipt preview removed from POS terminal - printing is automatic */}

      {/* Payment Method Selection Modal */}
      <PaymentMethodModal
        open={showPaymentMethod}
        onOpenChange={setShowPaymentMethod}
        total={cartTotal}
        business={currentBusiness}
        selectedCustomer={selectedCustomer}
        onConfirm={handlePaymentConfirm}
        onCancel={() => {
          setShowPaymentMethod(false)
          setIsProcessingPayment(false)
        }}
      />

      {/* Add/Edit Product Modal used when barcode lookup returns no result */}
      <ProductModalTabs
        open={showAddProductModal}
        onOpenChange={(open) => {
          setShowAddProductModal(open)
          if (!open) {
            setProductToCreate(null)
          }
        }}
        product={productToCreate || undefined}
        onProductSaved={async () => {
          // Refresh product list so newly created product is available immediately
          await fetchProductsAndCategories()
          setShowAddProductModal(false)
          setProductToCreate(null)
        }}
      />
    </div>
  )
}
