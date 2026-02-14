// Zustand Store for POS State Management
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  modifiers?: string[]
  notes?: string
  total: number
  saleType?: "retail" | "wholesale" // Optional sale type for unified POS
  variationId?: string
  unitId?: string
}

export interface Table {
  id: string
  number: string
  status: "available" | "occupied" | "reserved"
  currentOrderId?: string
  guests?: number
}

interface POSState {
  // Cart
  cart: CartItem[]
  selectedTable: Table | null
  
  // Actions
  addToCart: (item: Omit<CartItem, "total">) => void
  updateCartItem: (id: string, updates: Partial<CartItem>) => void
  removeFromCart: (id: string) => void
  clearCart: () => void
  
  // Table management (Restaurant)
  setSelectedTable: (table: Table | null) => void
  
  // Hold sale
  holdSale: () => string // Returns hold ID
  retrieveHoldSale: (holdId: string) => void
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      cart: [],
      selectedTable: null,
      
      addToCart: (item) => {
        const existingItem = get().cart.find(
          (cartItem) => cartItem.productId === item.productId &&
            cartItem.variationId === item.variationId &&
            cartItem.unitId === item.unitId &&
            JSON.stringify(cartItem.modifiers) === JSON.stringify(item.modifiers)
        )
        
        if (existingItem) {
          get().updateCartItem(existingItem.id, {
            quantity: existingItem.quantity + item.quantity,
            total: (existingItem.quantity + item.quantity) * existingItem.price,
          })
        } else {
          const newItem: CartItem = {
            ...item,
            total: item.price * item.quantity,
          }
          set({ cart: [...get().cart, newItem] })
        }
      },
      
      updateCartItem: (id, updates) => {
        set({
          cart: get().cart.map((item) =>
            item.id === id
              ? (() => {
                  const nextPrice = updates.price ?? item.price
                  const nextQuantity = updates.quantity ?? item.quantity
                  return {
                    ...item,
                    ...updates,
                    price: nextPrice,
                    total: nextPrice * nextQuantity,
                  }
                })()
              : item
          ),
        })
      },
      
      removeFromCart: (id) => {
        set({ cart: get().cart.filter((item) => item.id !== id) })
      },
      
      clearCart: () => {
        set({ cart: [], selectedTable: null })
      },
      
      setSelectedTable: (table) => {
        set({ selectedTable: table })
      },
      
      holdSale: () => {
        const holdId = `hold_${Date.now()}`
        const holdData = {
          id: holdId,
          cart: get().cart,
          table: get().selectedTable,
          timestamp: new Date().toISOString(),
        }
        localStorage.setItem(`pos_hold_${holdId}`, JSON.stringify(holdData))
        get().clearCart()
        return holdId
      },
      
      retrieveHoldSale: (holdId) => {
        const holdData = localStorage.getItem(`pos_hold_${holdId}`)
        if (holdData) {
          const parsed = JSON.parse(holdData)
          set({ cart: parsed.cart, selectedTable: parsed.table })
          localStorage.removeItem(`pos_hold_${holdId}`)
        }
      },
    }),
    {
      name: "primepos-pos",
      storage: createJSONStorage(() => localStorage),
    }
  )
)

