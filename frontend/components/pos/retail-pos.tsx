"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useAuthStore } from "@/stores/authStore"
import { productService, categoryService } from "@/lib/services/productService"
import { formatCurrency } from "@/lib/utils/currency"
import { DiscountModal } from "@/components/modals/discount-modal"
import { SaleDiscountModal, type SaleDiscount } from "@/components/modals/sale-discount-modal"
import { CloseRegisterModal } from "@/components/modals/close-register-modal"
import { CustomerSelectModal } from "@/components/modals/customer-select-modal"
import { SelectUnitModal } from "@/components/modals/select-unit-modal"
import { ProductModalTabs } from "@/components/modals/product-modal-tabs"
import { PaymentMethodModal } from "@/components/modals/payment-method-modal"
import { PaymentPopup } from "@/components/pos/payment-popup"
import { RefundReturnModal } from "@/components/modals/refund-return-modal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  History,
  Lock,
  PauseCircle,
  RotateCcw,
  Tag,
  Truck,
  Trash2,
  Wallet,
  Eye,
  EyeOff,
} from "lucide-react"
import { useShift } from "@/contexts/shift-context"
import { offlineConfig } from "@/lib/offline/config"
import { buildOfflinePrintableSale, completeOfflineCashSale } from "@/lib/offline/offline-sales"
import { saleService } from "@/lib/services/saleService"
import { distributionService } from "@/lib/services/distributionService"
import { authService } from "@/lib/services/authService"
import { useToast } from "@/components/ui/use-toast"
import { printReceipt } from "@/lib/print"
import type { Customer } from "@/lib/services/customerService"
import type { Product } from "@/lib/types"
import { useI18n } from "@/contexts/i18n-context"
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

type HeldSale = {
  id: string
  cart: Array<{
    id: string
    productId?: string
    name: string
    price: number
    quantity: number
    total?: number
  }>
  table?: { id?: string; number?: string } | null
  timestamp: string
}

type PosRowAction = "discount" | "refund" | "hold" | "retrieve" | "drawer" | "close" | "void" | "delivery"

const POS_ROW_ACTION_LABELS: Record<PosRowAction, string> = {
  discount: "Discount",
  refund: "Refund",
  hold: "Hold",
  retrieve: "Retrieve",
  drawer: "Drawer",
  close: "Close",
  void: "Void",
  delivery: "Delivery",
}

export function RetailPOS() {
  const { user } = useAuthStore()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { cart, addToCart, updateCartItem, removeFromCart, clearCart, holdSale, retrieveHoldSale } = usePOSStore()
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
  const [isLoadingNextProductsPage, setIsLoadingNextProductsPage] = useState(false)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [productsPage, setProductsPage] = useState(1)
  const [hasNextProductsPage, setHasNextProductsPage] = useState(false)
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
  const [showRefundReturn, setShowRefundReturn] = useState(false)
  const [showSaleDiscount, setShowSaleDiscount] = useState(false)
  const [saleDiscount, setSaleDiscount] = useState<SaleDiscount | null>(null)
  const [isDeliveryRequired, setIsDeliveryRequired] = useState(false)
  const [showHoldSales, setShowHoldSales] = useState(false)
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [showReplaceCartConfirm, setShowReplaceCartConfirm] = useState(false)
  const [pendingHoldId, setPendingHoldId] = useState<string | null>(null)
  const [showRowActionConfirm, setShowRowActionConfirm] = useState(false)
  const [pendingRowAction, setPendingRowAction] = useState<PosRowAction | null>(null)
  const [rowActionUsername, setRowActionUsername] = useState("")
  const [rowActionPassword, setRowActionPassword] = useState("")
  const [showRowActionPassword, setShowRowActionPassword] = useState(false)
  const [isVerifyingRowAction, setIsVerifyingRowAction] = useState(false)
  const [transactionLocked, setTransactionLocked] = useState(false)
  const [initiatedSaleId, setInitiatedSaleId] = useState("")
  
  // Focus search on mount and after actions
  const searchInputRef = useRef<HTMLInputElement>(null)
  const paymentCloseByConfirmRef = useRef(false)

  

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

  // Get quick select items (all active products, limited to 16 for performance)
  const quickSelectItems = useMemo(() => {
    return products
      .filter((product: any) => {
        const matchesCategory = selectedCategory === "all" || 
                               product.categoryId === selectedCategory ||
                               (product.category && (product.category.id === selectedCategory || product.category.name === selectedCategory))
        return product.isActive
      })
      .slice(0, 16) // Limit to 16 items for quick selection
  }, [products, selectedCategory])

  const fetchProductsAndCategories = async (page: number = 1) => {
    if (!currentBusiness) {
      setIsLoadingProducts(false)
      return
    }

    if (page <= 1) {
      setIsLoadingProducts(true)
    } else {
      setIsLoadingNextProductsPage(true)
    }
    setProductsError(null)

    try {
      const [productsData, categoriesData] = await Promise.all([
        productService.list({ is_active: true, page }),
        page === 1 ? categoryService.list() : Promise.resolve(categories.filter((c) => c !== "all").map((name) => ({ name } as any))),
      ])
      setProducts(productsData.results || productsData)
      setProductsPage(page)
      setHasNextProductsPage(Boolean((productsData as any).next))
      if (page === 1) {
        setCategories(["all", ...(categoriesData.map((c: any) => c.name) || [])])
      }
    } catch (error: any) {
      console.error("Failed to load products:", error)
      setProductsError("Failed to load products. Please refresh the page.")
      if (page <= 1) {
        setProducts([])
        setCategories(["all"])
        setProductsPage(1)
        setHasNextProductsPage(false)
      }
    } finally {
      if (page <= 1) {
        setIsLoadingProducts(false)
      } else {
        setIsLoadingNextProductsPage(false)
      }
    }
  }

  const handleNextProductsPage = () => {
    if (!hasNextProductsPage || isLoadingProducts || isLoadingNextProductsPage) return
    void fetchProductsAndCategories(productsPage + 1)
  }

  const handlePreviousProductsPage = () => {
    if (productsPage <= 1 || isLoadingProducts || isLoadingNextProductsPage) return
    void fetchProductsAndCategories(productsPage - 1)
  }

  useEffect(() => {
    void fetchProductsAndCategories(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusiness])

  const loadHeldSales = () => {
    if (typeof window === "undefined") return
    const holds: HeldSale[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith("pos_hold_")) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const data = JSON.parse(raw)
        if (data?.id && Array.isArray(data?.cart)) {
          holds.push(data)
        }
      } catch {
        // ignore malformed entries
      }
    }
    holds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setHeldSales(holds)
  }

  useEffect(() => {
    loadHeldSales()
  }, [])

  useEffect(() => {
    if (showHoldSales) {
      loadHeldSales()
    }
  }, [showHoldSales])


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
  const toNumber = (value: any) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  const getProductPrice = (product: any): number => {
    if (saleType === "wholesale") {
      return toNumber(
        product.wholesale_price ??
          product.wholesalePrice ??
          product.retail_price ??
          product.price
      )
    }
    return toNumber(product.retail_price ?? product.price)
  }

  const getUnitPrice = (unit?: any): number | undefined => {
    if (!unit) return undefined
    if (saleType === "wholesale") {
      const price =
        unit.wholesale_price ?? unit.wholesalePrice ?? unit.price ?? unit.retail_price
      return price !== undefined ? toNumber(price) : undefined
    }
    const price = unit.retail_price ?? unit.price
    return price !== undefined ? toNumber(price) : undefined
  }

  const addCartWithDetails = (product: any, variation?: any, unit?: any, quantity = 1) => {
    const basePrice =
      getUnitPrice(unit) ??
      (variation?.price !== undefined ? toNumber(variation.price) : undefined) ??
      getProductPrice(product)
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
    if (transactionLocked) {
      toast({ title: "Transaction locked", description: "Complete or cancel payment before editing cart.", variant: "destructive" })
      return
    }
    addCartWithDetails(product, variation, unit, quantity)
  }

  const handleAddToCart = async (product: any) => {
    if (transactionLocked) {
      toast({ title: "Transaction locked", description: "Complete or cancel payment before editing cart.", variant: "destructive" })
      return
    }
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

  const getHoldTotal = (hold: HeldSale) =>
    hold.cart.reduce((sum, item) => sum + (item.total ?? item.price * item.quantity), 0)

  const getHoldItemCount = (hold: HeldSale) =>
    hold.cart.reduce((sum, item) => sum + (item.quantity || 0), 0)

  const handleHoldSale = () => {
    if (cart.length === 0) {
      toast({ title: "Hold Sale", description: "Cart is empty." })
      return
    }
    const holdId = holdSale()
    setSelectedCustomer(null)
    setSaleDiscount(null)
    toast({ title: "Hold Sale", description: `Sale held: ${holdId}` })
    loadHeldSales()
  }

  const handleRetrieveHoldSale = (holdId: string) => {
    if (cart.length > 0) {
      setPendingHoldId(holdId)
      setShowReplaceCartConfirm(true)
      return
    }
    retrieveHoldSale(holdId)
    setShowHoldSales(false)
    toast({ title: "Hold Sale", description: "Hold sale retrieved." })
  }

  const handleConfirmReplaceCart = () => {
    if (!pendingHoldId) return
    retrieveHoldSale(pendingHoldId)
    setShowHoldSales(false)
    setShowReplaceCartConfirm(false)
    setPendingHoldId(null)
    toast({ title: "Hold Sale", description: "Hold sale retrieved." })
  }

  const handleCancelReplaceCart = () => {
    setShowReplaceCartConfirm(false)
    setPendingHoldId(null)
  }

  const handleDeleteHoldSale = (holdId: string) => {
    if (typeof window === "undefined") return
    localStorage.removeItem(`pos_hold_${holdId}`)
    setHeldSales((prev) => prev.filter((hold) => hold.id !== holdId))
  }

  const handleSaleTypeChange = (newType: SaleType) => {
    if (cart.length > 0 && saleType !== newType) {
      setPendingSaleType(newType)
      setShowSaleTypeConfirm(true)
    } else {
      setSaleType(newType)
    }
  }

  const handleConfirmSaleTypeChange = async () => {
    if (pendingSaleType) {
      if (cart.length > 0) {
        clearCart()
        setSaleDiscount(null)
        setSelectedCustomer(null)
        toast({ title: "Cart cleared", description: "Cart cleared before switching sale type." })
      }
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

    if (transactionLocked) {
      toast({
        title: "Transaction locked",
        description: "Complete or cancel the current payment flow first.",
        variant: "destructive",
      })
      return
    }

    if (typeof window !== "undefined" && offlineConfig.isPhaseAtLeast(2) && !window.navigator.onLine) {
      setShowPaymentMethod(true)
      toast({
        title: "Offline checkout",
        description: "Cash sales can be completed offline and will sync automatically when internet returns.",
      })
      return
    }

    try {
      const subtotal = Math.round(cartSubtotal * 100) / 100
      const discount = Math.round(discountAmount * 100) / 100
      const tax = 0
      const total = Math.round((subtotal - discount + tax) * 100) / 100

      const initiated = await saleService.initiatePayment({
        outlet: currentOutlet.id,
        shift: activeShift.id,
        customer: selectedCustomer?.id || undefined,
        delivery_required: isDeliveryRequired,
        items_data: cart.map((item) => ({
          product_id: item.productId,
          unit_id: (item as any).unitId || undefined,
          quantity: item.quantity,
          price: Math.round(item.price * 100) / 100,
          notes: item.notes || "",
        })),
        subtotal,
        tax,
        discount,
        total,
        notes: "Transaction initiated from POS pay screen.",
      })

      if (!("id" in initiated)) {
        toast({
          title: "Checkout queued offline",
          description: initiated.detail || "Transaction will sync when internet returns.",
        })
        return
      }

      setInitiatedSaleId(String(initiated.id))
      setTransactionLocked(true)
      setShowPaymentMethod(true)
      toast({
        title: "Transaction initiated",
        description: `Receipt #${initiated._raw?.receipt_number || initiated.id} is locked for payment.`,
      })
    } catch (error: any) {
      toast({
        title: "Checkout start failed",
        description: error?.message || "Unable to initiate transaction.",
        variant: "destructive",
      })
    }
  }

  const handleDeliveryCheckout = async () => {
    if (cart.length === 0) {
      toast({
        title: "Cart is empty",
        description: "Please add items to cart before sending to deliveries.",
        variant: "destructive",
      })
      return
    }

    if (!currentOutlet || !activeShift) {
      toast({
        title: "Missing context",
        description: "Please select outlet and start a shift before sending to deliveries.",
        variant: "destructive",
      })
      return
    }

    setIsProcessingPayment(true)
    try {
      const subtotal = Math.round(cartSubtotal * 100) / 100
      const discount = Math.round(discountAmount * 100) / 100
      const tax = 0
      const total = Math.round((subtotal - discount + tax) * 100) / 100

      const items_data = cart.map((item) => ({
        product_id: item.productId,
        variation_id: (item as any).variationId || undefined,
        unit_id: (item as any).unitId || undefined,
        quantity: item.quantity,
        price: Math.round(item.price * 100) / 100,
        notes: item.notes || "",
      }))

      const sale = await saleService.create({
        outlet: String(currentOutlet.id),
        shift: String(activeShift.id),
        customer: selectedCustomer?.id ? String(selectedCustomer.id) : undefined,
        delivery_required: true,
        items_data,
        subtotal,
        tax,
        discount,
        discount_type: saleDiscount?.type,
        discount_reason: saleDiscount?.reason,
        total,
        payment_method: "tab",
        notes: "Delivery sale",
      } as any)

      await distributionService.createFromSale({
        sale_id: Number(sale.id),
        warehouse_id: Number(currentOutlet.id),
        customer_id: selectedCustomer?.id ? Number(selectedCustomer.id) : undefined,
      })

      clearCart()
      setSelectedCustomer(null)
      setSaleDiscount(null)
      setIsDeliveryRequired(false)

      toast({
        title: "Sent to deliveries",
        description: "Sale created and delivery order generated.",
      })
    } catch (error: any) {
      toast({
        title: "Delivery failed",
        description: error.message || "Failed to send to deliveries.",
        variant: "destructive",
      })
    } finally {
      setIsProcessingPayment(false)
      setIsDeliveryRequired(false)
    }
  }

  const handlePaymentConfirm = async (method: "cash" | "card" | "mobile" | "tab", amount?: number, change?: number) => {
    paymentCloseByConfirmRef.current = true
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
      const paymentSubtotal = Math.round(cartSubtotal * 100) / 100
      const paymentDiscount = Math.round(discountAmount * 100) / 100
      const paymentTax = 0 // TODO: Calculate tax if needed
      const paymentTotal = Math.round((paymentSubtotal - paymentDiscount + paymentTax) * 100) / 100

      const isOfflineCheckout = typeof window !== "undefined" && offlineConfig.isPhaseAtLeast(2) && !window.navigator.onLine

      if (isOfflineCheckout) {
        if (method !== "cash") {
          throw new Error("Only cash payments can be completed fully offline.")
        }

        const offlineSale = await completeOfflineCashSale({
          saleData: {
            outlet: String(currentOutlet.id),
            shift: String(activeShift.id),
            customer: selectedCustomer?.id ? String(selectedCustomer.id) : undefined,
            delivery_required: isDeliveryRequired,
            items_data: cart.map((item) => ({
              product_id: String(item.productId),
              unit_id: (item as any).unitId || undefined,
              quantity: item.quantity,
              price: Math.round(item.price * 100) / 100,
              notes: item.notes || "",
            })),
            subtotal: paymentSubtotal,
            tax: paymentTax,
            discount: paymentDiscount,
            discount_type: saleDiscount?.type,
            discount_reason: saleDiscount?.reason,
            total: paymentTotal,
            payment_method: "cash",
            notes: "Offline cash sale completed from POS pay screen.",
          },
          cashReceived: Number(amount || paymentTotal),
          changeGiven: Number(change || 0),
          customerName: selectedCustomer?.name || null,
          items: cart.map((item, idx) => ({
            id: String(item.id || `${item.productId}-${idx}`),
            name: item.name,
            price: Number(item.price || 0),
            quantity: Number(item.quantity || 0),
            total: Math.round(Number((item.price || 0) * (item.quantity || 0)) * 100) / 100,
          })),
        })

        const receiptCartItems = offlineSale.items.map((item) => ({
          ...item,
          discount: 0,
        }))

        clearCart()
        setSelectedCustomer(null)
        setSaleDiscount(null)
        setIsDeliveryRequired(false)
        setTransactionLocked(false)
        setInitiatedSaleId("")

        toast({
          title: "Offline sale completed",
          description: `Receipt #${offlineSale.receipt_number} created locally and queued for sync.`,
        })

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sale-completed", {
            detail: {
              saleId: offlineSale.local_sale_id,
              receiptNumber: offlineSale.receipt_number,
              offline: true,
            },
          }))
        }

        ;(async () => {
          try {
            const outletId = typeof currentOutlet.id === "string" ? parseInt(String(currentOutlet.id), 10) : currentOutlet.id
            await printReceipt({
              cart: receiptCartItems,
              subtotal: offlineSale.subtotal,
              discount: offlineSale.discount,
              tax: offlineSale.tax,
              total: offlineSale.total,
              sale: buildOfflinePrintableSale(offlineSale),
            }, outletId)
          } catch (err: any) {
            console.error("Offline print failed:", err)
            toast({
              title: "Print failed",
              description: err?.message || "Unable to print offline receipt. Check local printer connectivity.",
              variant: "destructive",
            })
          }
        })()

        return
      }

      if (!initiatedSaleId) {
        throw new Error("No initiated transaction found. Click PAY to start again.")
      }

      // Finalize previously initiated sale
      const sale = await saleService.finalizePayment(initiatedSaleId, {
        payment_method: method,
        cash_received: amount,
        change,
      })
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
      setIsDeliveryRequired(false)
      setTransactionLocked(false)
      setInitiatedSaleId("")

  // Receipt preview removed: we no longer open a preview modal in the POS terminal
      // Attempt to auto-print (non-blocking). Uses the Local Print Agent and saved default printer.
      ;(async () => {
        try {
          const outletId = typeof currentOutlet!.id === 'string' ? parseInt(String(currentOutlet!.id), 10) : currentOutlet!.id
          await printReceipt({ cart: receiptCartItems, subtotal: fullSale.subtotal ?? paymentSubtotal, discount: fullSale.discount ?? paymentDiscount, tax: fullSale.tax ?? paymentTax, total: fullSale.total ?? paymentTotal, sale: fullSale }, outletId)
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
      setIsDeliveryRequired(false)
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

  const handleOpenDrawer = () => {
    toast({
      title: "Drawer",
      description: "Cash drawer functionality coming soon.",
    })
  }

  const handleVoidSale = async () => {
    if (!transactionLocked || !initiatedSaleId) {
      toast({ title: "Void", description: "Void is available only after PAY is clicked and transaction is initiated.", variant: "destructive" })
      return
    }

    try {
      const voidSale = await saleService.voidTransaction(initiatedSaleId, "Cancelled from POS payment stage")

      const receiptNumber =
        voidSale._raw?.receipt_number ||
        ("receipt_number" in voidSale ? (voidSale as any).receipt_number : undefined) ||
        voidSale.id
      toast({
        title: "Void Sale",
        description: `Sale voided. Receipt #${receiptNumber}`,
      })

      clearCart()
      setSaleDiscount(null)
      setSelectedCustomer(null)
      setTransactionLocked(false)
      setInitiatedSaleId("")
    } catch (error: any) {
      console.error("Void sale error:", error)
      toast({
        title: "Void Sale Failed",
        description: error.message || "Unable to record void sale.",
        variant: "destructive",
      })
    }
  }

  const handlePaymentCancel = async () => {
    if (paymentCloseByConfirmRef.current) {
      paymentCloseByConfirmRef.current = false
      return
    }
    setShowPaymentMethod(false)
    if (!transactionLocked || !initiatedSaleId) {
      setIsProcessingPayment(false)
      return
    }

    try {
      await saleService.voidTransaction(initiatedSaleId, "Cashier cancelled payment popup")
      clearCart()
      setSaleDiscount(null)
      setSelectedCustomer(null)
      toast({ title: "Transaction voided", description: "Initiated transaction was cancelled and logged." })
    } catch (error: any) {
      toast({
        title: "Cancel failed",
        description: error?.message || "Unable to void initiated transaction.",
        variant: "destructive",
      })
    } finally {
      setTransactionLocked(false)
      setInitiatedSaleId("")
      setIsProcessingPayment(false)
      setIsDeliveryRequired(false)
    }
  }

  const closeRowActionConfirm = () => {
    setShowRowActionConfirm(false)
    setPendingRowAction(null)
    setRowActionUsername("")
    setRowActionPassword("")
    setIsVerifyingRowAction(false)
  }

  const requestRowActionConfirmation = (action: PosRowAction) => {
    setPendingRowAction(action)
    setRowActionUsername(user?.email || "")
    setRowActionPassword("")
    setShowRowActionConfirm(true)
  }

  const handleConfirmRowAction = async () => {
    if (!pendingRowAction) return

    if (!rowActionUsername.trim() || !rowActionPassword.trim()) {
      toast({
        title: "Login details required",
        description: "Enter username and password to continue.",
        variant: "destructive",
      })
      return
    }

    setIsVerifyingRowAction(true)

    try {
      await authService.verifyCredentials(rowActionUsername.trim(), rowActionPassword)
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error?.message || "Invalid login details. Please try again.",
        variant: "destructive",
      })
      setIsVerifyingRowAction(false)
      return
    }

    const action = pendingRowAction
    closeRowActionConfirm()

    switch (action) {
      case "discount":
        setShowSaleDiscount(true)
        break
      case "refund":
        setShowRefundReturn(true)
        break
      case "hold":
        handleHoldSale()
        break
      case "retrieve":
        setShowHoldSales(true)
        break
      case "drawer":
        handleOpenDrawer()
        break
      case "close":
        setShowCloseRegister(true)
        break
      case "void":
        await handleVoidSale()
        break
      case "delivery":
        await handleDeliveryCheckout()
        break
      default:
        break
    }
  }

  if (!currentBusiness) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Please select a business first</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Products Panel - Clean List View */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Category Filter - Fixed Sidebar */}
            {categories.length > 1 && (
              <div className="w-36 border-r bg-gray-200 flex-shrink-0 p-2">
                <div className="mb-2">
                  <span className="text-xs font-medium">Categories</span>
                </div>
                <div className="max-h-[22rem] overflow-y-auto">
                  <div className="grid grid-cols-1 gap-2 justify-items-center">
                  <Button
                    key="all"
                    variant={selectedCategory === "all" ? "default" : "outline"}
                    className="h-20 w-20 p-1 justify-center items-center text-[11px] overflow-hidden"
                    onClick={() => setSelectedCategory("all")}
                    title="All"
                  >
                    <span className="truncate text-center">All</span>
                  </Button>
                  {categories
                    .filter((category) => category !== "all")
                    .map((category) => (
                      <Button
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        className="h-20 w-20 p-1 justify-center items-center text-[11px] overflow-hidden"
                        onClick={() => setSelectedCategory(category)}
                        title={category}
                      >
                        <span className="truncate text-center">{category}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Products Grid - Enhanced */}
            <div className="relative flex-1 overflow-y-auto bg-gray-200 p-3">
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
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shadow-lg"
                  onClick={handlePreviousProductsPage}
                  disabled={productsPage <= 1 || isLoadingProducts || isLoadingNextProductsPage}
                  title={productsPage > 1 ? "Load previous products" : "Already first page"}
                >
                  Previous Products
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shadow-lg"
                  onClick={handleNextProductsPage}
                  disabled={!hasNextProductsPage || isLoadingProducts || isLoadingNextProductsPage}
                  title={hasNextProductsPage ? "Load next products" : "No more products"}
                >
                  {isLoadingNextProductsPage ? "Loading..." : hasNextProductsPage ? "Next Products" : "No More"}
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t bg-card px-2 py-1.5">
            <div className="flex flex-nowrap gap-1.5 overflow-x-auto">
              <Button
                size="sm"
                className="h-9 gap-1 px-2.5 text-xs bg-amber-600 text-white hover:bg-amber-700 shrink-0"
                onClick={() => requestRowActionConfirmation("discount")}
              >
                <Tag className="h-4 w-4" />
                Discount
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1 px-2.5 text-xs bg-blue-600 text-white hover:bg-blue-700 shrink-0"
                onClick={() => requestRowActionConfirmation("refund")}
              >
                <RotateCcw className="h-4 w-4" />
                Refund
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1 px-2.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
                onClick={handleHoldSale}
              >
                <PauseCircle className="h-4 w-4" />
                Hold
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1 px-2.5 text-xs bg-indigo-600 text-white hover:bg-indigo-700 shrink-0"
                onClick={() => requestRowActionConfirmation("retrieve")}
              >
                <History className="h-4 w-4" />
                Retrieve
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1 px-2.5 text-xs bg-orange-600 text-white hover:bg-orange-700 shrink-0"
                onClick={() => requestRowActionConfirmation("drawer")}
              >
                <Wallet className="h-4 w-4" />
                Drawer
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1 px-2.5 text-xs bg-slate-600 text-white hover:bg-slate-700 shrink-0"
                onClick={() => requestRowActionConfirmation("close")}
              >
                <Lock className="h-4 w-4" />
                Close
              </Button>
              <Button
                size="sm"
                className="h-9 gap-1 px-2.5 text-xs bg-sky-600 text-white hover:bg-sky-700 shrink-0"
                onClick={() => requestRowActionConfirmation("delivery")}
              >
                <Truck className="h-4 w-4" />
                Delivery
              </Button>
            </div>
          </div>
        </div>

        {/* Cart Panel - Table Based */}
        <div className="flex-1 lg:flex-none w-full lg:w-[560px] min-h-0 border-t lg:border-t-0 lg:border-l bg-card flex flex-col">
          {/* Cart Header */}
          <div className="p-2 border-b space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Cart ({cartItemCount})</div>
              <div className="w-[160px]">
                <Select value={saleType} onValueChange={(value) => handleSaleTypeChange(value as SaleType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select sale type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Customer Selection */}
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded bg-muted p-2 text-xs">
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
                className="h-6 w-full text-xs"
                onClick={() => setShowCustomerSelect(true)}
              >
                Select Customer
              </Button>
            )}

            <div className="relative mt-1">
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
                  if (searchTerm.length >= 2 && searchResults.length > 0) {
                    setShowSearchDropdown(true)
                  }
                  setShowQuickSelectDropdown(false)
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowSearchDropdown(false)
                    setShowQuickSelectDropdown(false)
                  }, 200)
                }}
                onClick={() => {
                  setShowQuickSelectDropdown(false)
                  setShowSearchDropdown(false)
                }}
                autoFocus
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    const term = searchTerm.trim()
                    const barcodeLike = /^[0-9A-Za-z]{6,}$/.test(term)

                    if (barcodeLike) {
                      try {
                        const { products: matchedProducts } = await productService.lookup(term)

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

                          addCartWithDetails(p, undefined, undefined, 1)
                          setSearchTerm("")
                          setShowSearchDropdown(false)
                          return
                        }

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

              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                  {searchResults.map((product: any) => {
                    const price = getProductPrice(product)
                    const sellingUnits = product.selling_units || []
                    const activeUnits = sellingUnits.filter((u: any) => u.is_active !== false)
                    const hasUnits = activeUnits.length > 0

                    const handleSearchUnitSelect = (unitId: string) => {
                      if (unitId === "base") {
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
                    <TableRow key={item.id} className="border-b hover:bg-muted/40 h-9">
                      <TableCell className="px-2 py-1 text-xs font-medium truncate">{item.product.name}</TableCell>
                      <TableCell className="px-2 py-1 text-xs text-right">{formatCurrency(item.price, currentBusiness)}</TableCell>
                      <TableCell className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => updateCartItem(item.id, { quantity: item.quantity - 1 })}
                            disabled={item.quantity <= 1 || transactionLocked}
                          >
                            −
                          </Button>
                          <span className="text-xs font-medium w-6 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                            disabled={transactionLocked}
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
                          disabled={transactionLocked}
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
          <div className="shrink-0 p-2 bg-muted/30 space-y-1.5">
              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] leading-tight">
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
                <div className="col-span-2 flex justify-between font-semibold text-xs border-t pt-1.5">
                  <span>Total:</span>
                  <span>{formatCurrency(cartTotal, currentBusiness)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  className="h-8 flex-1 bg-blue-900 hover:bg-blue-800"
                  size="sm"
                  onClick={() => {
                    setIsDeliveryRequired(false)
                    void handleCheckout()
                  }}
                  disabled={isProcessingPayment || cart.length === 0 || transactionLocked}
                >
                  {isProcessingPayment ? "Processing..." : "PAY"}
                </Button>
              </div>
            </div>
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
      <RefundReturnModal
        open={showRefundReturn}
        onOpenChange={setShowRefundReturn}
      />
      <Dialog open={showHoldSales} onOpenChange={setShowHoldSales}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Held Sales</DialogTitle>
            <DialogDescription>Select a held sale to retrieve.</DialogDescription>
          </DialogHeader>

          {heldSales.length === 0 ? (
            <div className="text-sm text-muted-foreground">No held sales found.</div>
          ) : (
            <div className="rounded-md border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold">Hold ID</TableHead>
                    <TableHead className="text-xs font-semibold">Items</TableHead>
                    <TableHead className="text-xs font-semibold">Total</TableHead>
                    <TableHead className="text-xs font-semibold">Time</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {heldSales.map((hold) => (
                    <TableRow key={hold.id}>
                      <TableCell className="text-xs">{hold.id}</TableCell>
                      <TableCell className="text-xs">{getHoldItemCount(hold)}</TableCell>
                      <TableCell className="text-xs">
                        {formatCurrency(getHoldTotal(hold), currentBusiness)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(hold.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => handleRetrieveHoldSale(hold.id)}>
                            Load
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDeleteHoldSale(hold.id)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHoldSales(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

      {/* Replace Cart Confirmation for Hold Retrieval */}
      <AlertDialog open={showReplaceCartConfirm} onOpenChange={setShowReplaceCartConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Current Cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Retrieving a held sale will replace the current cart. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelReplaceCart}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplaceCart}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={showRowActionConfirm}
        onOpenChange={(open) => {
          if (!open) {
            closeRowActionConfirm()
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Login</DialogTitle>
            <DialogDescription>
              Enter your username and password to continue with {pendingRowAction ? POS_ROW_ACTION_LABELS[pendingRowAction] : "this action"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label htmlFor="retail-row-action-username" className="text-sm font-medium leading-none">
                Username
              </label>
              <Input
                id="retail-row-action-username"
                type="text"
                value={rowActionUsername}
                onChange={(event) => setRowActionUsername(event.target.value)}
                placeholder="Enter username or email"
                disabled={isVerifyingRowAction}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="retail-row-action-password" className="text-sm font-medium leading-none">
                Password
              </label>
              <div className="relative">
                <Input
                  id="retail-row-action-password"
                  type={showRowActionPassword ? "text" : "password"}
                  value={rowActionPassword}
                  onChange={(event) => setRowActionPassword(event.target.value)}
                  placeholder="Enter password"
                  disabled={isVerifyingRowAction}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowRowActionPassword(!showRowActionPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={isVerifyingRowAction}
                >
                  {showRowActionPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeRowActionConfirm} disabled={isVerifyingRowAction}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleConfirmRowAction()} disabled={isVerifyingRowAction}>
              {isVerifyingRowAction ? "Verifying..." : "Verify & Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Receipt preview removed from POS terminal - printing is automatic */}

      {/* Payment Popup Modal - Single unified popup */}
      <PaymentPopup
        open={showPaymentMethod}
        onDismiss={() => {
          setShowPaymentMethod(false)
        }}
        onCancel={() => {
          void handlePaymentCancel()
        }}
        blockOutsideClose={transactionLocked}
        total={cartTotal}
        subtotal={cartSubtotal}
        discount={discountAmount}
        tax={0}
        customer={selectedCustomer}
        items={cart}
        onConfirm={handlePaymentConfirm}
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
