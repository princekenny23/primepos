/**
 * Sale payload builder utility
 * Standardizes sale data structure across all POS systems
 */

interface CartItem {
  productId: string
  quantity: number
  price: number
  modifiers?: string[]
  notes?: string
}

interface SalePayload {
  outlet: string | number
  shift: string | number
  customer?: string | number
  items_data: any[]
  subtotal: number
  tax: number
  discount: number
  discount_type?: string
  discount_reason?: string
  total: number
  payment_method: 'cash' | 'card' | 'mobile'
  notes?: string
  table_id?: string | number
  guests?: number
  priority?: 'normal' | 'urgent'
  [key: string]: any
}

export function buildSalePayload(options: {
  cart: CartItem[]
  outlet: any
  shift: any
  customer?: any
  subtotal: number
  discount: number
  discountType?: string
  discountReason?: string
  paymentMethod?: 'cash' | 'card' | 'mobile'
  table?: any
  notes?: string
  guests?: number
  priority?: 'normal' | 'urgent'
  additionalFields?: Record<string, any>
}): SalePayload {
  const {
    cart,
    outlet,
    shift,
    customer,
    subtotal,
    discount,
    discountType,
    discountReason,
    paymentMethod = 'cash',
    table,
    notes,
    guests,
    priority = 'normal',
    additionalFields = {},
  } = options

  const tax = 0 // TODO: implement tax logic
  const total = Math.round((subtotal - discount + tax) * 100) / 100

  const payload: SalePayload = {
    outlet: outlet.id || outlet,
    shift: shift.id || shift,
    ...(customer && { customer: customer.id || customer }),
    items_data: cart.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      price: Math.round(item.price * 100) / 100,
      notes: item.modifiers?.join(', ') || item.notes || '',
    })),
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    ...(discountType && { discount_type: discountType }),
    ...(discountReason && { discount_reason: discountReason }),
    total,
    payment_method: paymentMethod,
    ...(notes && { notes }),
    ...(table && { table_id: table.id || table }),
    ...(guests && { guests }),
    ...(priority && { priority }),
    ...additionalFields,
  }

  return payload
}
