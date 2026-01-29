import { useMemo } from 'react'
import { usePOSStore } from '@/stores/posStore'

interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  quantity: number
  total?: number
  modifiers?: string[]
  notes?: string
}

interface SaleDiscount {
  type: 'percentage' | 'fixed' | 'amount'
  value: number
  reason?: string
}

/**
 * Shared POS cart math hook for all POS systems
 * Handles subtotal, tax, discount, total calculations
 */
export function usePosCart(discount?: SaleDiscount | null) {
  const { cart } = usePOSStore()

  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.total || item.price * item.quantity), 0)
  }, [cart])

  const cartTax = useMemo(() => {
    return 0 // TODO: implement tax calculation logic
  }, [])

  const cartDiscount = useMemo(() => {
    if (!discount) return 0
    if (discount.type === 'percentage') {
      return (cartSubtotal * discount.value) / 100
    }
    // Treat 'fixed' and 'amount' as absolute value discounts
    return discount.value
  }, [cartSubtotal, discount])

  const cartFinalTotal = useMemo(() => {
    return Math.round((cartSubtotal + cartTax - cartDiscount) * 100) / 100
  }, [cartSubtotal, cartTax, cartDiscount])

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])

  const roundCurrency = (value: number) => {
    return Math.round(value * 100) / 100
  }

  return {
    cart,
    cartSubtotal: roundCurrency(cartSubtotal),
    cartTax: roundCurrency(cartTax),
    cartDiscount: roundCurrency(cartDiscount),
    cartFinalTotal,
    cartItemCount,
    roundCurrency,
  }
}
