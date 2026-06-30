export interface ViewSaleDetailsItem {
  id: string
  name: string
  quantity: number
  price: number
  total: number
}

export interface ViewSaleDetailsPaymentLine {
  payment_method?: string
  amount?: number | string
  other_payment_method_name?: string
}

export interface ViewSaleDetailsModalSale {
  id: string
  saleDbId?: string
  date: string
  customer?: string
  outlet?: string
  items: ViewSaleDetailsItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod?: string
  payment_method?: string
  payment_lines?: ViewSaleDetailsPaymentLine[]
  status: string
  amountPaid?: number
}

export function getPaymentMethod(sale: Record<string, unknown>, fallback = "cash"): string {
  const raw = sale._raw as Record<string, unknown> | undefined
  return String(raw?.payment_method || sale.payment_method || sale.paymentMethod || fallback)
}

export function getSalePaymentLines(sale: Record<string, unknown>): ViewSaleDetailsPaymentLine[] {
  const raw = sale._raw as Record<string, unknown> | undefined
  const lines = sale.payment_lines || sale.paymentLines || raw?.payment_lines
  return Array.isArray(lines) ? lines : []
}

export function mapSaleItems(sale: Record<string, unknown>): ViewSaleDetailsItem[] {
  const items = sale.items
  if (!Array.isArray(items)) return []

  return items.map((item: Record<string, unknown>, index: number) => ({
    id: String(item.id || item.productId || `item-${index}`),
    name: String(item.productName || item.name || "Unknown Product"),
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    total: Number(item.total || 0) || Number(item.price || 0) * Number(item.quantity || 0),
  }))
}

export function resolveTransactionStatus(sale: Record<string, unknown> | object): string {
  const saleRecord = sale as Record<string, unknown>
  const pm = getPaymentMethod(saleRecord, "").toLowerCase()
  const isTabCredit = pm === "tab" || pm === "credit"
  if (!isTabCredit) return "completed"

  const raw = saleRecord._raw as Record<string, unknown> | undefined
  const ps = String(raw?.payment_status || saleRecord.payment_status || "").toLowerCase()
  if (ps === "paid") return "completed"
  if (ps === "partially_paid") return "partially_paid"
  if (ps === "overdue") return "overdue"
  return "pending"
}

export function mapSaleToViewDetailsModalProps(
  sale: Record<string, unknown> | object,
  options?: {
    status?: string
    paymentMethodFallback?: string
    amountPaid?: number
  }
): ViewSaleDetailsModalSale {
  const saleRecord = sale as Record<string, unknown>
  const paymentMethod = getPaymentMethod(saleRecord, options?.paymentMethodFallback || "cash")
  const raw = saleRecord._raw as Record<string, unknown> | undefined

  return {
    id: String(raw?.receipt_number || saleRecord.receipt_number || saleRecord.id || ""),
    saleDbId: String(saleRecord.id || raw?.id || ""),
    date: String(saleRecord.created_at || saleRecord.createdAt || ""),
    customer: (saleRecord.customer as { name?: string } | undefined)?.name,
    outlet: (saleRecord.outlet as { name?: string } | undefined)?.name,
    items: mapSaleItems(saleRecord),
    subtotal: Number(saleRecord.subtotal || 0),
    tax: Number(saleRecord.tax || 0),
    discount: Number(saleRecord.discount || 0),
    total: Number(saleRecord.total || 0),
    paymentMethod,
    payment_method: paymentMethod,
    payment_lines: getSalePaymentLines(saleRecord),
    status:
      options?.status ??
      String(saleRecord.status || "completed"),
    amountPaid:
      options?.amountPaid ??
      (raw?.amount_paid != null ? parseFloat(String(raw.amount_paid || "0")) : undefined),
  }
}
