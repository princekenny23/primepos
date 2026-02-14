"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useBusinessStore } from "@/stores/businessStore"
import { productService, categoryService } from "@/lib/services/productService"
import { tabService, type Tab, type TabListItem, type TabItem } from "@/lib/services/barTabService"
import { tableService, type Table as RestaurantTable } from "@/lib/services/tableService"
import { saleService } from "@/lib/services/saleService"
import { kitchenService } from "@/lib/services/kitchenService"
import { formatCurrency } from "@/lib/utils/currency"
import type { Product, Category } from "@/lib/types"
import { 
  Search, Wine, Receipt, Plus, Minus, X, CreditCard, Smartphone, DollarSign, 
  Lock, RefreshCw, Users, ArrowRightLeft, Merge, Split, Clock, User,
  Table2, Armchair, List, AlertCircle, Check, Trash2,
  MoreHorizontal, RotateCcw, Percent, Pencil,
  Wallet, ShieldAlert, XCircle, Zap, History, ChefHat
} from "lucide-react"
import { CloseRegisterModal } from "@/components/modals/close-register-modal"
import { PaymentMethodModal } from "@/components/modals/payment-method-modal"
import { SaleDiscountModal, type SaleDiscount } from "@/components/modals/sale-discount-modal"
import { RefundReturnModal } from "@/components/modals/refund-return-modal"
import { TabFinderModal } from "@/components/modals/tab-finder-modal"
import { AddEditCustomerModal } from "@/components/modals/add-edit-customer-modal"
import { printReceipt } from "@/lib/print"
import { useShift } from "@/contexts/shift-context"
import { useTenant } from "@/contexts/tenant-context"
import { useToast } from "@/components/ui/use-toast"
import { customerService, type Customer } from "@/lib/services/customerService"
import { cn } from "@/lib/utils"

// ==================== Types ====================

interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  variationId?: string
  variationName?: string
  notes?: string
  total: number
}

type HeldSale = {
  id: string
  cart: CartItem[]
  timestamp: string
}

// ==================== Component ====================

export function RestaurantPOS() {
  const router = useRouter()
  const { currentBusiness, currentOutlet } = useBusinessStore()
  const { currentOutlet: tenantOutlet } = useTenant()
  const { activeShift } = useShift()
  const { toast } = useToast()
  const outlet = tenantOutlet || currentOutlet

  // ==================== State ====================

  // Products
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Categories
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  // Tabs
  const [tabs, setTabs] = useState<TabListItem[]>([])
  const [currentTab, setCurrentTab] = useState<Tab | null>(null)
  const [isLoadingTabs, setIsLoadingTabs] = useState(true)
  
  // Tables
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [isLoadingTables, setIsLoadingTables] = useState(true)
  const [tableLinkMap, setTableLinkMap] = useState<Record<string, string>>({})

  // Cart (for current tab or quick sale)
  const [cart, setCart] = useState<CartItem[]>([])

  // Modals
  const [showCloseRegister, setShowCloseRegister] = useState(false)
  const [showOpenTab, setShowOpenTab] = useState(false)
  const [showCloseTab, setShowCloseTab] = useState(false)
  const [showTransferTab, setShowTransferTab] = useState(false)
  const [showMergeTabs, setShowMergeTabs] = useState(false)
  const [showSplitTab, setShowSplitTab] = useState(false)
  
  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  
  // Manager Actions Popup
  const [showManagerActions, setShowManagerActions] = useState(false)
  
  // Additional Action Modals
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [showTabHistory, setShowTabHistory] = useState(false)
  const [showTabFinder, setShowTabFinder] = useState(false)

  const [showHoldSales, setShowHoldSales] = useState(false)
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [pendingHoldId, setPendingHoldId] = useState<string | null>(null)
  const [showReplaceCartConfirm, setShowReplaceCartConfirm] = useState(false)

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSendingToKitchen, setIsSendingToKitchen] = useState(false)
  const [activeView, setActiveView] = useState<"products" | "tables">("products")
  const [isCategoryOpen, setIsCategoryOpen] = useState(true)

  // Sale discount state (retail-style flow)
  const [saleDiscount, setSaleDiscount] = useState<SaleDiscount | null>(null)

  // Customer search
  const [customerSearchTerm, setCustomerSearchTerm] = useState("")
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false)

  // Open tab form
  const [openTabForm, setOpenTabForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_id: "", // For linking to CRM
    table_id: "",
    notes: "",
  })

  // Add state for new customer modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)

  // Close tab form
  const [closeTabForm, setCloseTabForm] = useState({
    payment_method: "cash" as "cash" | "card" | "mobile" | "credit",
    cash_received: "",
    notes: "",
  })

  // Transfer form
  const [transferTableId, setTransferTableId] = useState<string>("")

  // Merge form
  const [selectedTabsToMerge, setSelectedTabsToMerge] = useState<string[]>([])
  const [mergeTargetId, setMergeTargetId] = useState<string>("")

  // ==================== Data Loading ====================

  const loadProducts = useCallback(async () => {
    if (!currentBusiness) return
    
    setIsLoadingProducts(true)
    setProductsError(null)
    
    try {
      const response = await productService.list({ is_active: true })
      const productsList = Array.isArray(response) ? response : (response.results || [])
      setProducts(productsList)
    } catch (error: any) {
      console.error("Failed to load products:", error)
      setProductsError("Failed to load products.")
      setProducts([])
    } finally {
      setIsLoadingProducts(false)
    }
  }, [currentBusiness])

  const loadCategories = useCallback(async () => {
    setIsLoadingCategories(true)
    setCategoriesError(null)
    try {
      const list = await categoryService.list()
      setCategories(list)
    } catch (error) {
      console.error("Failed to load categories:", error)
      setCategories([])
      setCategoriesError("Failed to load categories")
    } finally {
      setIsLoadingCategories(false)
    }
  }, [])

  const loadTabs = useCallback(async () => {
    if (!outlet) return
    
    setIsLoadingTabs(true)
    try {
      const response = await tabService.list({ outlet: outlet.id, status: "open" })
      setTabs(response.results || [])
    } catch (error) {
      console.error("Failed to load tabs:", error)
      setTabs([])
    } finally {
      setIsLoadingTabs(false)
    }
  }, [outlet])

  const loadTables = useCallback(async () => {
    if (!outlet) return
    
    setIsLoadingTables(true)
    try {
      const [restaurantResponse, barResponse] = await Promise.all([
        tableService.list({ outlet: String(outlet.id), is_active: true }),
        tabService.listTables({ outlet: String(outlet.id), is_active: true }),
      ])
      const restaurantTables = restaurantResponse.results || []
      const barTables = barResponse.results || []
      setTables(restaurantTables)

      const nextMap: Record<string, string> = {}
      restaurantTables.forEach((table) => {
        const match = barTables.find((barTable) => barTable.number === table.number)
        if (match) {
          nextMap[table.id] = match.id
        }
      })
      setTableLinkMap(nextMap)
    } catch (error) {
      console.error("Failed to load tables:", error)
      setTables([])
    } finally {
      setIsLoadingTables(false)
    }
  }, [outlet])

  const resolveBarTableId = useCallback(
    async (restaurantTableId?: string) => {
      if (!restaurantTableId || !outlet) return undefined

      const existing = tableLinkMap[restaurantTableId]
      if (existing) return existing

      const restaurantTable = tables.find((table) => table.id === restaurantTableId)
      if (!restaurantTable) return undefined

      try {
        const barTables = await tabService.listTables({ outlet: String(outlet.id), is_active: true })
        const match = (barTables.results || []).find(
          (barTable) => barTable.number === restaurantTable.number
        )
        if (match) {
          setTableLinkMap((prev) => ({ ...prev, [restaurantTableId]: match.id }))
          return match.id
        }

        const created = await tabService.createTable({
          outlet: String(outlet.id),
          number: restaurantTable.number,
          capacity: restaurantTable.capacity,
          status: restaurantTable.status,
          location: restaurantTable.location,
          table_type: "table",
          is_active: true,
        })
        setTableLinkMap((prev) => ({ ...prev, [restaurantTableId]: created.id }))
        return created.id
      } catch (error) {
        console.error("Failed to resolve bar table:", error)
        return undefined
      }
    },
    [outlet, tableLinkMap, tables]
  )

  const loadTabDetails = useCallback(async (tabId: string) => {
    try {
      const tab = await tabService.get(tabId)
      setCurrentTab(tab)
      if (tab.discount && tab.discount > 0) {
        setSaleDiscount({ type: "amount", value: tab.discount })
      } else {
        setSaleDiscount(null)
      }
      
      // Sync cart with tab items
      const cartItems: CartItem[] = tab.items
        .filter(item => !item.is_voided)
        .map(item => ({
          id: item.id,
          productId: item.product,
          name: item.product_name,
          price: item.price,
          quantity: item.quantity,
          variationId: item.variation || undefined,
          variationName: item.variation_name || undefined,
          notes: item.notes,
          total: item.total,
        }))
      setCart(cartItems)
    } catch (error) {
      console.error("Failed to load tab details:", error)
      toast({
        title: "Error",
        description: "Failed to load tab details",
        variant: "destructive",
      })
    }
  }, [toast])

  // ==================== Customer Search ====================
  const searchCustomers = useCallback(async (term: string) => {
    if (!term || term.length < 2) {
      setCustomerSearchResults([])
      return
    }
    
    setIsSearchingCustomers(true)
    try {
      const response = await customerService.list({ search: term })
      const customers = Array.isArray(response) ? response : response.results
      setCustomerSearchResults(customers.slice(0, 10)) // Limit to 10 results
    } catch (error) {
      console.error("Failed to search customers:", error)
      setCustomerSearchResults([])
    } finally {
      setIsSearchingCustomers(false)
    }
  }, [])

  // Debounced customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers(customerSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearchTerm, searchCustomers])

  // ==================== Discount (Retail-style) ====================
  const calculateDiscountAmount = (subtotal: number) => {
    if (!saleDiscount) return 0
    if (saleDiscount.type === "percentage") {
      return (subtotal * saleDiscount.value) / 100
    }
    return saleDiscount.value
  }

  // Initial load
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    loadTabs()
    loadTables()
    loadCategories()
  }, [loadTabs, loadTables, loadCategories])

  // Debounce search term for dropdown
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Build search dropdown results
  useEffect(() => {
    if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }

    const term = debouncedSearchTerm.toLowerCase()
    const results = products
      .filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(term) ||
          product.sku?.toLowerCase().includes(term) ||
          product.barcode?.toLowerCase().includes(term)
        const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory
        return matchesSearch && matchesCategory && product.isActive
      })
      .slice(0, 10)

    setSearchResults(results)
    setShowSearchDropdown(results.length > 0)
  }, [debouncedSearchTerm, products, selectedCategory])

  // ==================== Filtered Products ====================

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Category filtering - use real category IDs
    const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory
    
    return matchesSearch && matchesCategory && product.isActive
  })

  // ==================== Cart Calculations ====================

  const cartSubtotal = cart.reduce((sum, item) => sum + item.total, 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const discountAmount = calculateDiscountAmount(currentTab?.subtotal ?? cartSubtotal)

  // ==================== Held Sales ====================

  const getHoldTotal = (hold: HeldSale) =>
    hold.cart.reduce((sum, item) => sum + (item.total ?? item.price * item.quantity), 0)

  const getHoldItemCount = (hold: HeldSale) =>
    hold.cart.reduce((sum, item) => sum + (item.quantity || 0), 0)

  const loadHeldSales = () => {
    if (typeof window === "undefined") return
    const holds: HeldSale[] = []
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("pos_hold_")) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || "{}")
          if (data?.id && data?.cart) {
            holds.push(data)
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    holds.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    setHeldSales(holds)
  }

  useEffect(() => {
    if (showHoldSales) {
      loadHeldSales()
    }
  }, [showHoldSales])

  const handleHoldSale = () => {
    if (cart.length === 0) {
      toast({ title: "Hold Sale", description: "Cart is empty." })
      return
    }
    const holdId = `hold_${Date.now()}`
    const holdData: HeldSale = {
      id: holdId,
      cart,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem(`pos_hold_${holdId}`, JSON.stringify(holdData))
    setCart([])
    setSaleDiscount(null)
    setSelectedCustomer(null)
    toast({ title: "Hold Sale", description: `Sale held: ${holdId}` })
    loadHeldSales()
  }

  const handleRetrieveHoldSale = (holdId: string) => {
    if (cart.length > 0) {
      setPendingHoldId(holdId)
      setShowReplaceCartConfirm(true)
      return
    }
    const holdData = localStorage.getItem(`pos_hold_${holdId}`)
    if (holdData) {
      const parsed = JSON.parse(holdData)
      setCart(parsed.cart || [])
      localStorage.removeItem(`pos_hold_${holdId}`)
    }
    setShowHoldSales(false)
    toast({ title: "Hold Sale", description: "Hold sale retrieved." })
  }

  const handleConfirmReplaceCart = () => {
    if (!pendingHoldId) return
    handleRetrieveHoldSale(pendingHoldId)
    setShowReplaceCartConfirm(false)
    setPendingHoldId(null)
  }

  const handleCancelReplaceCart = () => {
    setShowReplaceCartConfirm(false)
    setPendingHoldId(null)
  }

  const handleDeleteHoldSale = (holdId: string) => {
    localStorage.removeItem(`pos_hold_${holdId}`)
    setHeldSales((prev) => prev.filter((hold) => hold.id !== holdId))
  }

  // ==================== Tab Operations ====================

  const handleOpenTab = async () => {
    if (!outlet) return
    
    setIsProcessing(true)
    try {
      const selectedTable = openTabForm.table_id
        ? tables.find((table) => table.id === openTabForm.table_id)
        : undefined
      const barTableId = await resolveBarTableId(openTabForm.table_id || undefined)
      const combinedNotes = [openTabForm.notes, selectedTable ? `Table ${selectedTable.number}` : undefined]
        .filter(Boolean)
        .join(" · ")

      const newTab = await tabService.open({
        customer_name: openTabForm.customer_name || undefined,
        customer_phone: openTabForm.customer_phone || undefined,
        customer_id: openTabForm.customer_id || undefined, // Link to CRM customer
        table_id: barTableId,
        notes: combinedNotes || undefined,
      })
      
      toast({
        title: "Tab Opened",
        description: `Tab ${newTab.tab_number} opened successfully`,
      })
      
      // Reset form and close modal
      setOpenTabForm({ customer_name: "", customer_phone: "", customer_id: "", table_id: "", notes: "" })
      setSelectedCustomer(null)
      setShowOpenTab(false)
      
      // Reload data and select new tab
      await loadTabs()
      await loadTables()
      await loadTabDetails(newTab.id)
    } catch (error: any) {
      console.error("Failed to open tab:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to open tab",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddItemToTab = async (product: Product) => {
    if (!currentTab) {
      // No tab selected - add to local cart for quick sale
      const existingItem = cart.find(item => item.productId === product.id)
      if (existingItem) {
        setCart(cart.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        ))
      } else {
        setCart([...cart, {
          id: `local_${Date.now()}`,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          total: product.price,
        }])
      }
      return
    }

    // Add to current tab via API
    try {
      const result = await tabService.addItem(currentTab.id, {
        product_id: product.id,
        quantity: 1,
      })
      
      // Reload tab details to get updated items
      await loadTabDetails(currentTab.id)
      
      if (result.warning) {
        toast({
          title: "Warning",
          description: result.warning,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Failed to add item:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add item to tab",
        variant: "destructive",
      })
    }
  }

  // Increment quantity (Square-style)
  const handleIncrementItem = async (item: CartItem) => {
    if (currentTab) {
      try {
        await tabService.addItem(currentTab.id, {
          product_id: item.productId,
          quantity: 1,
        })
        await loadTabDetails(currentTab.id)
      } catch (error: any) {
        console.error("Failed to increment item:", error)
        toast({ title: "Error", description: error.message || "Failed to update item", variant: "destructive" })
      }
      return
    }

    // Quick sale cart
    setCart(prev => prev.map(ci => ci.id === item.id
      ? { ...ci, quantity: ci.quantity + 1, total: (ci.quantity + 1) * ci.price }
      : ci
    ))
  }

  // Decrement quantity (Square-style)
  const handleDecrementItem = async (item: CartItem) => {
    if (currentTab) {
      if (item.quantity <= 1) {
        await handleVoidItem(item.id)
        return
      }
      try {
        await tabService.addItem(currentTab.id, {
          product_id: item.productId,
          quantity: -1,
        })
        await loadTabDetails(currentTab.id)
      } catch (error: any) {
        console.error("Failed to decrement item:", error)
        toast({ title: "Error", description: error.message || "Failed to update item", variant: "destructive" })
      }
      return
    }

    // Quick sale cart
    if (item.quantity <= 1) {
      setCart(prev => prev.filter(ci => ci.id !== item.id))
      return
    }
    setCart(prev => prev.map(ci => ci.id === item.id
      ? { ...ci, quantity: ci.quantity - 1, total: (ci.quantity - 1) * ci.price }
      : ci
    ))
  }

  const handleVoidItem = async (itemId: string) => {
    if (!currentTab) {
      setCart(prev => prev.filter(ci => ci.id !== itemId))
      return
    }

    try {
      await tabService.voidItem(currentTab.id, itemId, "Removed by staff")
      await loadTabDetails(currentTab.id)
      
      toast({
        title: "Item Removed",
        description: "Item has been voided from the tab",
      })
    } catch (error: any) {
      console.error("Failed to void item:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove item",
        variant: "destructive",
      })
    }
  }

  const handleVoidSale = async () => {
    if (cart.length === 0) {
      toast({ title: "Void Sale", description: "Cart is already empty." })
      return
    }

    if (!outlet) {
      toast({ title: "Void Sale", description: "Outlet not available.", variant: "destructive" })
      return
    }

    try {
      const subtotal = Math.round(cartSubtotal * 100) / 100
      const discount = Math.round(discountAmount * 100) / 100
      const tax = 0
      const total = Math.round((subtotal - discount + tax) * 100) / 100

      const items_data = cart.map((item) => ({
        product_id: item.productId,
        unit_id: (item as any).unitId || undefined,
        quantity: item.quantity,
        price: Math.round(item.price * 100) / 100,
        notes: item.notes || "",
      }))

      const voidSale = await saleService.void({
        outlet: outlet.id,
        shift: activeShift?.id,
        customer: selectedCustomer?.id || undefined,
        items_data,
        subtotal,
        tax,
        discount,
        total,
        payment_method: "cash",
        notes: "Voided sale from POS",
      })

      const receiptNumber =
        voidSale._raw?.receipt_number ||
        ("receipt_number" in voidSale ? (voidSale as any).receipt_number : undefined) ||
        voidSale.id
      toast({
        title: "Void Sale",
        description: `Sale voided. Receipt #${receiptNumber}`,
      })

      setCart([])
      setSaleDiscount(null)
      setSelectedCustomer(null)
    } catch (error: any) {
      console.error("Void sale error:", error)
      toast({
        title: "Void Sale Failed",
        description: error.message || "Unable to record void sale.",
        variant: "destructive",
      })
    }
  }

  // Close tab with payment data from PaymentMethodModal
  const handleCloseTabWithPayment = async (
    method: "cash" | "card" | "mobile" | "credit",
    amount?: number,
    change?: number
  ) => {
    if (!currentTab) return
    
    setIsProcessing(true)
    try {
      const result = await tabService.close(currentTab.id, {
        payment_method: method,
        cash_received: method === "cash" ? amount : undefined,
        discount: discountAmount,
        discount_type: saleDiscount?.type === "percentage" ? "percentage" : saleDiscount ? "fixed" : undefined,
        discount_reason: saleDiscount?.reason,
        notes: "",
      })
      
      toast({
        title: "Tab Closed",
        description: `Receipt #${result.sale.receipt_number}${change && change > 0 ? ` - Change: ${formatCurrency(change, currentBusiness)}` : ''}`,
      })
      
      // Try to print receipt
      try {
        await printReceipt({
          cart: currentTab.items.filter(i => !i.is_voided).map(i => ({
            id: i.id,
            name: i.product_name,
            price: i.price,
            quantity: i.quantity,
            total: i.total,
          })),
          subtotal: currentTab.subtotal,
          discount: discountAmount,
          tax: currentTab.tax,
          total: result.sale.total,
          sale: result.sale,
        }, outlet?.id || "")
      } catch (printError) {
        console.warn("Print failed:", printError)
      }
      
      // Reset and reload
      setShowPaymentModal(false)
      setShowCloseTab(false)
      setCloseTabForm({ payment_method: "cash", cash_received: "", notes: "" })
      setCurrentTab(null)
      setCart([])
      setSaleDiscount(null)
      
      await loadTabs()
      await loadTables()
    } catch (error: any) {
      console.error("Failed to close tab:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to close tab",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Legacy close tab from inline modal (deprecated, use PaymentMethodModal instead)
  const handleCloseTab = async () => {
    if (!currentTab) return
    
    // Validate cash received for cash payments
    if (closeTabForm.payment_method === "cash") {
      const cashReceived = parseFloat(closeTabForm.cash_received)
      if (!cashReceived || cashReceived < currentTab.total) {
        toast({
          title: "Invalid Amount",
          description: "Cash received must be at least equal to the total",
          variant: "destructive",
        })
        return
      }
    }
    
    setIsProcessing(true)
    try {
      const cashReceived = closeTabForm.cash_received ? parseFloat(closeTabForm.cash_received) : undefined
      
      const result = await tabService.close(currentTab.id, {
        payment_method: closeTabForm.payment_method,
        cash_received: cashReceived,
        discount: discountAmount,
        discount_type: saleDiscount?.type === "percentage" ? "percentage" : saleDiscount ? "fixed" : undefined,
        discount_reason: saleDiscount?.reason,
        notes: closeTabForm.notes,
      })
      
      toast({
        title: "Tab Closed",
        description: `Receipt #${result.sale.receipt_number} - Change: ${formatCurrency(result.sale.change_given, currentBusiness)}`,
      })
      
      // Try to print receipt
      try {
        await printReceipt({
          cart: currentTab.items.filter(i => !i.is_voided).map(i => ({
            id: i.id,
            name: i.product_name,
            price: i.price,
            quantity: i.quantity,
            total: i.total,
          })),
          subtotal: currentTab.subtotal,
          discount: discountAmount,
          tax: currentTab.tax,
          total: result.sale.total,
          sale: result.sale,
        }, outlet?.id || "")
      } catch (printError) {
        console.warn("Print failed:", printError)
      }
      
      // Reset and reload
      setShowCloseTab(false)
      setCloseTabForm({ payment_method: "cash", cash_received: "", notes: "" })
      setCurrentTab(null)
      setCart([])
      setSaleDiscount(null)
      
      await loadTabs()
      await loadTables()
    } catch (error: any) {
      console.error("Failed to close tab:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to close tab",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTransferTab = async () => {
    if (!currentTab) return
    
    setIsProcessing(true)
    try {
      const resolvedTableId = transferTableId ? await resolveBarTableId(transferTableId) : null
      if (transferTableId && !resolvedTableId) {
        toast({
          title: "Transfer failed",
          description: "Unable to resolve destination table.",
          variant: "destructive",
        })
        return
      }
      await tabService.transfer(currentTab.id, {
        to_table_id: resolvedTableId || null,
      })
      
      toast({
        title: "Tab Transferred",
        description: transferTableId ? "Tab moved to new table" : "Tab is now walk-up",
      })
      
      setShowTransferTab(false)
      setTransferTableId("")
      
      await loadTabs()
      await loadTables()
      await loadTabDetails(currentTab.id)
    } catch (error: any) {
      console.error("Failed to transfer tab:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to transfer tab",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleMergeTabs = async () => {
    if (!mergeTargetId || selectedTabsToMerge.length === 0) return
    
    setIsProcessing(true)
    try {
      const result = await tabService.merge({
        target_tab_id: mergeTargetId,
        source_tab_ids: selectedTabsToMerge,
      })
      
      toast({
        title: "Tabs Merged",
        description: `${result.merged_count} tab(s) merged into Tab ${result.target_tab.tab_number}`,
      })
      
      setShowMergeTabs(false)
      setSelectedTabsToMerge([])
      setMergeTargetId("")
      
      await loadTabs()
      await loadTables()
      
      // Select the merged tab
      await loadTabDetails(result.target_tab.id)
    } catch (error: any) {
      console.error("Failed to merge tabs:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to merge tabs",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Send current tab or cart to kitchen for preparation
  const handleSendToKitchen = async () => {
    if (!outlet) {
      toast({
        title: "Select Outlet",
        description: "Please choose an outlet before sending orders to the kitchen",
        variant: "destructive",
      })
      return
    }

    const items = currentTab
      ? currentTab.items.filter((item) => !item.is_voided)
      : cart

    if (items.length === 0) {
      toast({
        title: "No Items",
        description: "Add items to the cart or tab before sending to kitchen",
        variant: "destructive",
      })
      return
    }

    setIsSendingToKitchen(true)
    try {
      const discountValue = discountAmount

      const discountType: "percentage" | "amount" | undefined = discountValue > 0
        ? (saleDiscount?.type === "percentage" ? "percentage" : "amount")
        : undefined

      const salePayload = {
        outlet: String(outlet.id),
        shift: activeShift?.id ? String(activeShift.id) : undefined,
        customer: currentTab?.customer ? String(currentTab.customer) : undefined,
        items_data: items.map((item) => ({
          product_id: String('product' in item ? (item as TabItem).product : (item as CartItem).productId),
          quantity: item.quantity,
          price: item.price,
          notes: item.notes || undefined,
          kitchen_status: "pending" as const,
        })),
        subtotal: currentTab ? currentTab.subtotal : cartSubtotal,
        tax: currentTab ? currentTab.tax : 0,
        discount: discountValue,
        discount_type: discountType,
        total: currentTab ? currentTab.total : cartSubtotal,
        payment_method: "tab" as const,
        table_id: currentTab?.table ? String(currentTab.table) : undefined,
        status: "pending" as const,
      }

      const sale = await saleService.create(salePayload)

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sale-completed"))
      }

      await kitchenService.create({
        sale_id: parseInt(String(sale.id), 10),
        table_id: salePayload.table_id ? parseInt(salePayload.table_id, 10) : undefined,
        priority: "normal",
      })

      toast({
        title: "Sent to kitchen",
        description: `Created kitchen ticket for ${items.length} item${items.length === 1 ? "" : "s"}.`,
      })
    } catch (error: any) {
      console.error("Failed to send to kitchen:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to send to kitchen",
        variant: "destructive",
      })
    } finally {
      setIsSendingToKitchen(false)
    }
  }

  const handleSelectTab = async (tabId: string) => {
    await loadTabDetails(tabId)
  }

  const getTableStatus = useCallback(
    (table: RestaurantTable) => {
      const linkedBarTableId = tableLinkMap[table.id]
      const hasActiveTab = linkedBarTableId ? tabs.some((tab) => tab.table === linkedBarTableId) : false
      if (hasActiveTab) return "occupied" as const
      return table.status
    },
    [tableLinkMap, tabs]
  )

  const handleSelectTable = async (table: RestaurantTable) => {
    const linkedBarTableId = tableLinkMap[table.id]
    const existingTab = linkedBarTableId ? tabs.find((tab) => tab.table === linkedBarTableId) : undefined
    if (existingTab) {
      await loadTabDetails(existingTab.id)
      return
    }

    if (getTableStatus(table) === "available") {
      setOpenTabForm(prev => ({ ...prev, table_id: table.id }))
      setShowOpenTab(true)
      return
    }

    toast({
      title: "Table unavailable",
      description: "This table is currently not available.",
      variant: "destructive",
    })
  }

  const handleClearSelection = () => {
    setCurrentTab(null)
    setCart([])
  }

  // Keyboard shortcut for tab finder (Ctrl+Shift+T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        setShowTabFinder(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  

  // ==================== Render ====================

  if (!currentBusiness) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please select a business first</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-background overflow-hidden min-h-[calc(100vh-0px)]">
      {/* Header Bar - View Toggle + Open Tabs - FIXED */}
      <div className="border-b bg-card flex-shrink-0">
        <div className="px-3 py-2 flex items-center gap-3 overflow-x-auto">
          {/* Menu/Tables Toggle */}
          <div className="flex bg-muted rounded-lg p-1 shrink-0">
            
            <Button
              variant={activeView === "products" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("products")}
              className="rounded-md"
            >
              <Wine className="h-4 w-4 mr-2" />
              Menu
            </Button>
            <Button
              variant={activeView === "tables" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("tables")}
              className="rounded-md"
            >
              <Table2 className="h-4 w-4 mr-2" />
              Tables
            </Button>
          </div>
            <Button 
            variant={!currentTab ? "default" : "secondary"} 
            size="sm" 
            onClick={handleClearSelection}
            className="shrink-0"
          >
            <Zap className="h-4 w-4 mr-1" />
            Quick Sale
          </Button>
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* Tab Finder Button Only (No Scrollable List) */}
          {isLoadingTabs ? (
            <span className="text-sm text-muted-foreground">Loading tabs...</span>
          ) : tabs.length === 0 ? (
            <span className="text-sm text-muted-foreground">No open tabs</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTabFinder(true)}
              title="Find tab (Ctrl+Shift+T)"
              className="shrink-0"
            >
              <List className="h-4 w-4 mr-1" />
              Tabs ({tabs.length})
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowOpenTab(true)}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Tab
          </Button>
        
          
          
        
        </div>
      </div>

      {/* Main Content - fills remaining space */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left Panel - Tables/Products */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Products View */}
          {activeView === "products" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Search - FIXED at top */}
              <div className="p-2 border-b flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search menu by name, SKU, or barcode..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowSearchDropdown(searchResults.length > 0)}
                    onBlur={() => setTimeout(() => setShowSearchDropdown(false), 120)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setShowSearchDropdown(false)
                      }
                    }}
                  />

                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-[320px] overflow-y-auto">
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent border-b last:border-b-0 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleAddItemToTab(product)
                            setSearchTerm("")
                            setShowSearchDropdown(false)
                            setTimeout(() => searchInputRef.current?.focus(), 100)
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
                            </div>
                            <div className="ml-3 text-right">
                              <div className="font-bold text-sm">{formatCurrency(product.price, currentBusiness)}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Category Sidebar */}
                <div
                  className={cn(
                    "border-r bg-gray-200 overflow-y-auto flex-shrink-0 transition-all duration-200",
                    isCategoryOpen ? "w-40 p-3" : "w-12 p-2"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className={cn("text-xs font-medium", !isCategoryOpen && "sr-only")}>
                      Categories
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setIsCategoryOpen((prev) => !prev)}
                      title={isCategoryOpen ? "Collapse categories" : "Expand categories"}
                    >
                      {isCategoryOpen ? "«" : "»"}
                    </Button>
                  </div>
                  {isLoadingCategories ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="h-10 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : categoriesError ? (
                    <div className="text-xs text-destructive">{categoriesError}</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Button
                        key="all"
                        variant={selectedCategory === "all" ? "default" : "outline"}
                        className={cn(
                          "h-10 justify-start px-3 text-sm",
                          selectedCategory === "all" && "ring-2 ring-primary",
                          !isCategoryOpen && "hidden"
                        )}
                        onClick={() => setSelectedCategory("all")}
                      >
                        All
                      </Button>
                      {categories.map(cat => (
                        <Button
                          key={cat.id}
                          variant={selectedCategory === cat.id ? "default" : "outline"}
                          className={cn(
                            "h-10 justify-start px-3 text-sm",
                            selectedCategory === cat.id && "ring-2 ring-primary",
                            !isCategoryOpen && "hidden"
                          )}
                          onClick={() => setSelectedCategory(cat.id)}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Product Grid - SCROLLABLE */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-200">
                  <ScrollArea className="flex-1 min-h-0">
                    {isLoadingProducts ? (
                      <div className="flex items-center justify-center h-64">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : productsError ? (
                      <div className="flex flex-col items-center justify-center h-64">
                        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                        <p className="text-destructive mb-2">{productsError}</p>
                        <Button variant="outline" onClick={loadProducts}>Retry</Button>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Wine className="h-12 w-12 mb-2 opacity-50" />
                        <p>No products found</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-3 p-5">
                        {filteredProducts.map(product => (
                          <Card
                            key={product.id}
                            className="cursor-pointer hover:shadow-md transition-shadow border border-muted"
                            onClick={() => handleAddItemToTab(product)}
                          >
                            <CardContent className="p-3">
                              <div className="flex flex-col gap-1">
                                <h3 className="text-sm leading-tight whitespace-normal break-normal">{product.name}</h3>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}

          {/* Tables View */}
          {activeView === "tables" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Status Legend - FIXED */}
              <div className="border-b p-2 flex items-center justify-between flex-shrink-0">
                <p className="text-sm font-medium">Tables</p>
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500" />
                    Available
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-500" />
                    Occupied
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-yellow-500" />
                    Reserved
                  </span>
                </div>
              </div>

              {/* Tables Display - SCROLLABLE */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4">
                {isLoadingTables ? (
                  <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tables.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Table2 className="h-12 w-12 mb-2 opacity-50" />
                    <p>No tables configured</p>
                    <p className="text-xs">Add tables in Table Management</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {tables.map(table => {
                      const linkedBarTableId = tableLinkMap[table.id]
                      const activeTab = linkedBarTableId ? tabs.find((tab) => tab.table === linkedBarTableId) : undefined
                      const displayStatus = getTableStatus(table)
                      return (
                        <Card
                          key={table.id}
                          className={cn(
                            "cursor-pointer transition-all hover:scale-105 hover:shadow-md",
                            displayStatus === "available" && "border-green-500 bg-green-50 dark:bg-green-950",
                            displayStatus === "occupied" && "border-red-500 bg-red-50 dark:bg-red-950",
                            displayStatus === "reserved" && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
                            displayStatus === "out_of_service" && "border-gray-400 bg-gray-100 dark:bg-gray-900 opacity-50"
                          )}
                          onClick={() => handleSelectTable(table)}
                        >
                          <CardContent className="p-3 text-center">
                            <Table2 className="h-8 w-8 mx-auto mb-1 opacity-70" />
                            <p className="font-bold text-sm">{table.number}</p>
                            <p className="text-xs text-muted-foreground capitalize">{displayStatus.replace('_', ' ')}</p>
                            {activeTab && (
                              <>
                                <p className="text-xs truncate mt-1">{activeTab.customer_name}</p>
                                <p className="text-sm font-bold text-primary">
                                  {formatCurrency(activeTab.total, currentBusiness)}
                                </p>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Right Panel - Cart - Fixed layout, only cart items scroll */}
        <div className="flex-1 lg:flex-none w-full lg:w-[520px] border-t lg:border-t-0 lg:border-l bg-card flex flex-col min-h-0 overflow-hidden">
          {/* Tab Header */}
          <div className="p-3 border-b flex-shrink-0">
            {currentTab ? (
              <div>
                <h2 className="font-bold">{currentTab.customer_display}</h2>
                <p className="text-xs text-muted-foreground">
                  {currentTab.tab_number} • {currentTab.table_number ? `Table ${currentTab.table_number}` : "Walk-up"}
                </p>
              </div>
            ) : (
              <div>
                <h2 className="font-bold">New Sale</h2>
                <p className="text-xs text-muted-foreground">Select a tab or add items</p>
              </div>
            )}
          </div>

          {/* Cart Items - SCROLLABLE */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Wine className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">
                  {currentTab ? "Add menu items to this tab" : "Add menu items for quick sale"}
                </p>
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
                  {cart.map(item => (
                    <TableRow key={item.id} className="border-b hover:bg-muted/40 h-10">
                      <TableCell className="px-2 py-1 text-xs font-medium truncate" title={item.name}>
                        {item.name}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-xs text-right">
                        {formatCurrency(item.price, currentBusiness)}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => handleDecrementItem(item)}
                            disabled={item.quantity <= 1}
                          >
                            −
                          </Button>
                          <span className="text-xs font-medium w-6 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => handleIncrementItem(item)}
                          >
                            +
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1 text-xs text-right font-semibold">
                        {formatCurrency(item.total, currentBusiness)}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => handleVoidItem(item.id)}
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
          </ScrollArea>

          {/* Totals - FIXED at bottom */}
          <div className="border-t p-3 space-y-2 flex-shrink-0 bg-card">
            <div className="flex justify-between text-sm">
              <span>Items</span>
              <span>{cartItemCount}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(discountAmount, currentBusiness)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-xl">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(currentTab?.total || cartSubtotal, currentBusiness)}</span>
            </div>
            {currentTab?.is_over_limit && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Tab exceeded credit limit
              </p>
            )}
          </div>

          {/* Simplified Action Bar - Payment + More - Always visible */}
          <div className="border-t bg-muted/50 p-3 space-y-2 flex-shrink-0">
            {/* Main Buttons */}
            <div className="flex gap-2">
              <Button
                className="flex-1 h-14 text-lg bg-blue-900 hover:bg-blue-800"
                onClick={() => setShowPaymentModal(true)}
                disabled={cart.length === 0}
              >
                <Wallet className="h-5 w-5 mr-2" />
                Payment
              </Button>
              <Button
                variant="outline"
                className="h-14 px-4"
                disabled={cart.length === 0 || isSendingToKitchen}
                onClick={handleSendToKitchen}
              >
                {isSendingToKitchen ? (
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <ChefHat className="h-5 w-5 mr-2" />
                )}
                Send to Kitchen
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-14 px-4"
                    disabled={cart.length === 0}
                    title="More actions"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem disabled={cart.length === 0} onClick={() => setShowDiscountModal(true)}>
                    Discount
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={cart.length === 0} onClick={() => setShowRefundModal(true)}>
                    Refund / Return
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={cart.length === 0}
                    onClick={handleHoldSale}
                  >
                    Hold Sale
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowHoldSales(true)}
                  >
                    Retrieve Hold
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCloseRegister(true)}>
                    Close Register
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={cart.length === 0} onClick={handleVoidSale} className="text-red-600">
                    Void Sale
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Quick Tab Actions (when tab is selected) */}
            {currentTab && (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setShowDiscountModal(true)}
                >
                  <Percent className="h-3 w-3 mr-1" />
                  Discount
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setShowTransferTab(true)}
                >
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  Transfer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setShowMergeTabs(true)}
                >
                  <Merge className="h-3 w-3 mr-1" />
                  Merge
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setShowSplitTab(true)}
                >
                  <Split className="h-3 w-3 mr-1" />
                  Split
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== Modals ==================== */}

      {/* Open Tab Modal */}
      <Dialog open={showOpenTab} onOpenChange={(open) => {
        setShowOpenTab(open)
        if (!open) {
          // Reset customer search when closing
          setCustomerSearchTerm("")
          setCustomerSearchResults([])
          setSelectedCustomer(null)
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Open New Tab</DialogTitle>
            <DialogDescription>
              Start a new tab for a customer. Search existing customers or enter new details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer Search / Lookup */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Search Customer (CRM)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddCustomerModal(true)}
                  title="Create new customer"
                  className="h-6 px-2 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, or email..."
                  className="pl-9"
                  value={customerSearchTerm}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value)
                    setSelectedCustomer(null) // Clear selection when typing
                  }}
                />
                {isSearchingCustomers && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {/* Search Results Dropdown */}
              {customerSearchResults.length > 0 && !selectedCustomer && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {customerSearchResults.map(customer => (
                    <button
                      key={customer.id}
                      type="button"
                      className="w-full p-2 text-left hover:bg-muted flex items-center justify-between"
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setCustomerSearchTerm("")
                        setCustomerSearchResults([])
                        setOpenTabForm(prev => ({
                          ...prev,
                          customer_name: customer.name,
                          customer_phone: customer.phone || "",
                          customer_id: customer.id,
                        }))
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.phone || customer.email || "No contact info"}
                        </p>
                      </div>
                      {customer.credit_enabled && (
                        <Badge variant="outline" className="text-xs">
                          Credit: {formatCurrency(customer.available_credit || 0, currentBusiness)}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Selected Customer Badge */}
              {selectedCustomer && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg">
                  <User className="h-4 w-4 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{selectedCustomer.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.phone || selectedCustomer.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCustomer(null)
                      setOpenTabForm(prev => ({ ...prev, customer_name: "", customer_phone: "", customer_id: "" }))
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Manual Entry (if no customer selected) */}
            {!selectedCustomer && (
              <>
                <div>
                  <Label>Customer Name</Label>
                  <Input
                    placeholder="John, Guy in red shirt, etc."
                    value={openTabForm.customer_name}
                    onChange={(e) => setOpenTabForm(prev => ({ ...prev, customer_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Phone (for callbacks)</Label>
                  <Input
                    placeholder="+265..."
                    value={openTabForm.customer_phone}
                    onChange={(e) => setOpenTabForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                  />
                </div>
              </>
            )}
            
            <div>
              <Label>Table (optional)</Label>
              <Select 
                value={openTabForm.table_id || "none"} 
                onValueChange={(v) => setOpenTabForm(prev => ({ ...prev, table_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Walk-up (no table)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Walk-up (no table)</SelectItem>
                  {tables.filter(t => getTableStatus(t) === "available").map(table => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.number} - {table.location || "Table"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOpenTab(false)}>Cancel</Button>
            <Button onClick={handleOpenTab} disabled={isProcessing}>
              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Open Tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Tab Modal */}
      <Dialog open={showCloseTab} onOpenChange={setShowCloseTab}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Tab</DialogTitle>
            <DialogDescription>
              {currentTab && `Close ${currentTab.customer_display}'s tab - Total: ${formatCurrency(currentTab.total, currentBusiness)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Method</Label>
              <Select 
                value={closeTabForm.payment_method} 
                onValueChange={(v: any) => setCloseTabForm(prev => ({ ...prev, payment_method: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Cash
                    </div>
                  </SelectItem>
                  <SelectItem value="card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Card
                    </div>
                  </SelectItem>
                  <SelectItem value="mobile">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" /> Mobile Money
                    </div>
                  </SelectItem>
                  <SelectItem value="credit">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Credit (Pay Later)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {closeTabForm.payment_method === "cash" && (
              <div>
                <Label>Cash Received</Label>
                <Input
                  type="number"
                  placeholder="Enter amount received"
                  value={closeTabForm.cash_received}
                  onChange={(e) => setCloseTabForm(prev => ({ ...prev, cash_received: e.target.value }))}
                />
                {closeTabForm.cash_received && currentTab && (
                  <p className="text-sm mt-1">
                    Change: {formatCurrency(parseFloat(closeTabForm.cash_received) - currentTab.total, currentBusiness)}
                  </p>
                )}
              </div>
            )}

            {/* Show applied discount info */}
            {discountAmount > 0 && (
              <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg text-sm">
                <span className="text-green-600 dark:text-green-400">
                  Discount applied: {formatCurrency(discountAmount, currentBusiness)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseTab(false)}>Cancel</Button>
            <Button onClick={handleCloseTab} disabled={isProcessing}>
              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Close & Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Tab Modal */}
      <Dialog open={showTransferTab} onOpenChange={setShowTransferTab}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Tab</DialogTitle>
            <DialogDescription>
              Move this tab to a different table or make it walk-up.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>New Table</Label>
            <Select value={transferTableId || "none"} onValueChange={(v) => setTransferTableId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Walk-up (no table)</SelectItem>
                {tables
                  .filter(t => getTableStatus(t) === "available" && tableLinkMap[t.id] !== currentTab?.table)
                  .map(table => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.number} - {table.location || "Table"}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferTab(false)}>Cancel</Button>
            <Button onClick={handleTransferTab} disabled={isProcessing}>
              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Tabs Modal */}
      <Dialog open={showMergeTabs} onOpenChange={(open) => {
        setShowMergeTabs(open)
        if (open && currentTab) {
          setMergeTargetId(currentTab.id)
        }
        if (!open) {
          setSelectedTabsToMerge([])
          setMergeTargetId("")
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Tabs</DialogTitle>
            <DialogDescription>
              Select tabs to merge into {currentTab?.customer_display || "the target tab"}. All items will be combined.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Target Tab (items will be merged into this tab)</Label>
              <Select value={mergeTargetId || currentTab?.id || ""} onValueChange={setMergeTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target tab" />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map(tab => (
                    <SelectItem key={tab.id} value={tab.id}>
                      {tab.customer_display} - {formatCurrency(tab.total, currentBusiness)} ({tab.item_count} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tabs to Merge (select multiple)</Label>
              <div className="border rounded-md p-2 space-y-2 max-h-48 overflow-y-auto">
                {tabs
                  .filter(tab => tab.id !== (mergeTargetId || currentTab?.id))
                  .map(tab => (
                    <div 
                      key={tab.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded cursor-pointer",
                        selectedTabsToMerge.includes(tab.id) ? "bg-primary/10" : "hover:bg-muted"
                      )}
                      onClick={() => {
                        if (selectedTabsToMerge.includes(tab.id)) {
                          setSelectedTabsToMerge(prev => prev.filter(id => id !== tab.id))
                        } else {
                          setSelectedTabsToMerge(prev => [...prev, tab.id])
                        }
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm">{tab.customer_display}</p>
                        <p className="text-xs text-muted-foreground">{tab.tab_number}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{formatCurrency(tab.total, currentBusiness)}</span>
                        {selectedTabsToMerge.includes(tab.id) && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMergeTabs(false); setSelectedTabsToMerge([]); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleMergeTabs} 
              disabled={isProcessing || selectedTabsToMerge.length === 0 || !mergeTargetId}
            >
              {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Merge className="h-4 w-4 mr-2" />}
              Merge {selectedTabsToMerge.length} Tab(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Tab Modal */}
      <Dialog open={showSplitTab} onOpenChange={setShowSplitTab}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split Tab</DialogTitle>
            <DialogDescription>
              Split this tab equally among multiple people.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-muted-foreground mb-4">
              Tab Total: {currentTab && formatCurrency(currentTab.total, currentBusiness)}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 4, 5, 6, 7, 8, 10].map(num => (
                <Button 
                  key={num} 
                  variant="outline"
                  onClick={async () => {
                    if (!currentTab) return
                    try {
                      const result = await tabService.split(currentTab.id, {
                        split_type: "equal",
                        number_of_splits: num,
                      })
                      if ('splits' in result) {
                        toast({
                          title: `Split ${num} Ways`,
                          description: `Each person pays ${formatCurrency(result.splits[0].amount, currentBusiness)}`,
                        })
                      }
                      setShowSplitTab(false)
                    } catch (error: any) {
                      toast({
                        title: "Error",
                        description: error.message || "Failed to split tab",
                        variant: "destructive",
                      })
                    }
                  }}
                >
                  <Users className="h-4 w-4 mr-1" />
                  {num}
                </Button>
              ))}
            </div>
            {currentTab && (
              <p className="text-sm text-muted-foreground mt-4">
                Example: Split 2 ways = {formatCurrency(currentTab.total / 2, currentBusiness)} each
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitTab(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== PAYMENT METHOD MODAL ==================== */}
      <PaymentMethodModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        total={currentTab?.total || cartSubtotal}
        business={currentBusiness}
        onConfirm={(method, amount, change) => {
          // Map "tab" (credit) to "credit" for backend
          const paymentMethod = method === "tab" ? "credit" : method
          
          // If this is a tab, close it with payment
          if (currentTab) {
            handleCloseTabWithPayment(paymentMethod as "cash" | "card" | "mobile" | "credit", amount, change)
          } else {
            // Quick sale (no tab) - just show confirmation
            toast({
              title: "Payment Processed",
              description: `${method.charAt(0).toUpperCase() + method.slice(1)} payment of ${formatCurrency(cartSubtotal, currentBusiness)} received${change && change > 0 ? `. Change: ${formatCurrency(change, currentBusiness)}` : ''}`,
            })
            setCart([])
            setShowPaymentModal(false)
          }
        }}
      />

      {/* ==================== MANAGER ACTIONS POPUP ==================== */}
      <Dialog open={showManagerActions} onOpenChange={setShowManagerActions}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Manager Actions
            </DialogTitle>
            <DialogDescription>
              These actions require manager authorization
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            <Button
              variant="outline"
              className="flex flex-col h-20 gap-1 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
              onClick={() => {
                setShowManagerActions(false)
                router.push("/pos/retail")
              }}
              title="Return to Retail POS"
            >
              <Zap className="h-5 w-5 text-blue-500" />
              <span className="text-xs text-blue-600 dark:text-blue-400">Go to Retail</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col h-20 gap-1 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950"
              onClick={() => {
                setShowManagerActions(false)
                router.push("/dashboard/pos")
              }}
              title="Return to POS Dashboard"
            >
              <Receipt className="h-5 w-5 text-purple-500" />
              <span className="text-xs text-purple-600 dark:text-purple-400">POS Menu</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col h-20 gap-1 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              onClick={() => {
                setShowManagerActions(false)
                setShowRefundModal(true)
              }}
            >
              <RotateCcw className="h-5 w-5 text-red-500" />
              <span className="text-xs text-red-600 dark:text-red-400">Refund</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col h-20 gap-1 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
              onClick={() => {
                setShowManagerActions(false)
                toast({
                  title: "Void Sale",
                  description: "Manager PIN required to void a sale",
                })
              }}
            >
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-xs text-red-600 dark:text-red-400">Void Sale</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col h-20 gap-1"
              onClick={() => {
                setShowManagerActions(false)
                if (!activeShift) {
                  toast({
                    title: "No Active Shift",
                    description: "There is no active shift to close",
                    variant: "destructive",
                  })
                  return
                }
                setShowCloseRegister(true)
              }}
            >
              <Lock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-xs">Close Shift</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== ADDITIONAL MODALS ==================== */}

      {/* Discount Modal - Using SaleDiscountModal from retail */}
      {currentBusiness && (
        <SaleDiscountModal
          open={showDiscountModal}
          onOpenChange={setShowDiscountModal}
          subtotal={currentTab?.subtotal || cartSubtotal}
          currentDiscount={saleDiscount}
          business={currentBusiness}
          onApply={(discount) => setSaleDiscount(discount)}
          onRemove={() => setSaleDiscount(null)}
        />
      )}

      {/* Refund Modal */}
      <RefundReturnModal
        open={showRefundModal}
        onOpenChange={setShowRefundModal}
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

      {/* Tab History Modal */}
      <Dialog open={showTabHistory} onOpenChange={setShowTabHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Tab History
            </DialogTitle>
            <DialogDescription>
              {currentTab ? `${currentTab.tab_number} - ${currentTab.customer_display}` : "No tab selected"}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 min-h-0 pr-4">
            {currentTab && (
              <div className="space-y-4">
                {/* Tab Info */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Opened:</span>
                      <span className="ml-2 font-medium">{new Date(currentTab.opened_at).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">By:</span>
                      <span className="ml-2 font-medium">{currentTab.opened_by_name || "Unknown"}</span>
                    </div>
                    {currentTab.table_number && (
                      <div>
                        <span className="text-muted-foreground">Table:</span>
                        <span className="ml-2 font-medium">{currentTab.table_number}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={currentTab.status === "open" ? "default" : "secondary"} className="ml-2">
                        {currentTab.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Items History */}
                <div>
                  <h4 className="font-semibold mb-2">Items ({currentTab.items.length})</h4>
                  <div className="space-y-2">
                    {currentTab.items.map((item, index) => (
                      <div 
                        key={item.id} 
                        className={cn(
                          "p-2 border rounded-lg",
                          item.is_voided && "bg-red-50 dark:bg-red-950 border-red-200"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={cn("font-medium", item.is_voided && "line-through text-muted-foreground")}>
                              {item.product_name}
                              {item.variation_name && <span className="text-xs ml-1">({item.variation_name})</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} × {formatCurrency(item.price, currentBusiness)} = {formatCurrency(item.total, currentBusiness)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Added by {item.added_by_name || "Unknown"} at {new Date(item.added_at).toLocaleTimeString()}
                            </p>
                          </div>
                          {item.is_voided && (
                            <div className="text-right">
                              <Badge variant="destructive" className="text-xs">Voided</Badge>
                              <p className="text-xs text-red-600 mt-1">
                                {item.void_reason}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                by {item.voided_by_name}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(currentTab.subtotal, currentBusiness)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-{formatCurrency(discountAmount, currentBusiness)}</span>
                      </div>
                    )}
                    {currentTab.tax > 0 && (
                      <div className="flex justify-between">
                        <span>Tax:</span>
                        <span>{formatCurrency(currentTab.tax, currentBusiness)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>{formatCurrency(currentTab.total, currentBusiness)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTabHistory(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Register Modal */}
      <CloseRegisterModal
        open={showCloseRegister}
        onOpenChange={setShowCloseRegister}
      />

      {/* Tab Finder Modal - Square POS Style */}
      <TabFinderModal
        open={showTabFinder}
        onOpenChange={setShowTabFinder}
        tabs={tabs}
        currentTabId={currentTab?.id}
        business={currentBusiness}
        onSelectTab={handleSelectTab}
      />

      {/* Add / Edit Customer Modal (same as retail) */}
      <AddEditCustomerModal
        open={showAddCustomerModal}
        onOpenChange={setShowAddCustomerModal}
        onSuccess={(customer) => {
          if (customer) {
            setSelectedCustomer(customer)
            setOpenTabForm(prev => ({
              ...prev,
              customer_name: customer.name,
              customer_phone: customer.phone || "",
              customer_id: customer.id,
            }))
            setCustomerSearchResults([])
            setCustomerSearchTerm("")
          }
          setShowAddCustomerModal(false)
        }}
      />
    </div>
  )
}

export default RestaurantPOS

