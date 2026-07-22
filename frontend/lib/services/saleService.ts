import { api, apiEndpoints } from "@/lib/api"
import { offlineConfig } from "@/lib/offline/config"
import type { Sale } from "@/lib/types"

// Sale with backend metadata such as nested detail fields and discount info
export type SaleWithMetadata = Sale & {
  _raw?: any
  discount?: number
  discountType?: string | undefined
  discountReason?: string | undefined
}

export interface SaleFilters {
  outlet?: string
  user?: string
  status?: string
  payment_method?: string
  start_date?: string
  end_date?: string
  search?: string
  page?: number
  tenant?: string
  businessId?: string
  limit?: number
  customer?: string
}

export interface CreateSaleData {
  outlet: string
  shift?: string
  customer?: string
  delivery_required?: boolean
  items_data: Array<{
    product_id: string
    quantity: number
    price: number
    notes?: string
    kitchen_status?: string
    unit_id?: string | number
    variation_id?: string | number
  }>
  subtotal: number
  tax?: number
  discount?: number
  discount_type?: "percentage" | "amount"
  discount_reason?: string
  total: number
  payment_method: "cash" | "card" | "mobile" | "other" | "airtel" | "tnm" | "first_capital_bank" | "national_bank" | "standard_bank" | "tab" | "credit" | "mixed"
  notes?: string
  // Restaurant-specific fields
  table_id?: string
  guests?: number
  priority?: "normal" | "high" | "urgent"
  status?: string
  payment_lines?: Array<{
    payment_method: string
    amount: number
    other_payment_method_name?: string
  }>
}

export interface VoidSaleData {
  outlet: string | number
  shift?: string | number
  customer?: string | number
  items_data: Array<{
    product_id: string | number
    quantity: number
    price: number
    unit_id?: string | number
    notes?: string
    discount?: number
  }>
  subtotal?: number
  tax?: number
  discount?: number
  total?: number
  payment_method?: "cash" | "card" | "mobile" | "other" | "airtel" | "tnm" | "first_capital_bank" | "national_bank" | "standard_bank" | "tab" | "credit" | "mixed"
  notes?: string
  reason?: string
}

export interface InitiatePaymentData {
  outlet: string | number
  shift?: string | number
  customer?: string | number
  delivery_required?: boolean
  items_data: Array<{
    product_id: string | number
    quantity: number
    price: number
    unit_id?: string | number
    notes?: string
  }>
  subtotal?: number
  tax?: number
  discount?: number
  total?: number
  notes?: string
}

export interface OfflineQueuedResult {
  offline_queued: true
  endpoint?: string
  method?: string
  detail?: string
}

export function isOfflineQueuedResult(value: SaleWithMetadata | OfflineQueuedResult): value is OfflineQueuedResult {
  return Boolean((value as OfflineQueuedResult)?.offline_queued)
}

export function buildSaleCreatePayload(data: CreateSaleData): any {
  const backendData: any = {
    outlet: parseInt(String(data.outlet)),
    shift: data.shift ? parseInt(String(data.shift)) : undefined,
    customer: data.customer ? parseInt(String(data.customer)) : undefined,
    items_data: data.items_data.map(item => ({
      product_id: parseInt(String(item.product_id)),
      variation_id: item.variation_id ? parseInt(String(item.variation_id)) : undefined,
      unit_id: item.unit_id ? parseInt(String(item.unit_id)) : undefined,
      quantity: item.quantity,
      price: String(item.price),
      notes: item.notes || "",
      kitchen_status: item.kitchen_status || "pending",
    })),
    subtotal: String(data.subtotal),
    tax: data.tax ? String(data.tax) : "0",
    discount: data.discount ? String(data.discount) : "0",
    total: String(data.total),
    payment_method: data.payment_method,
    notes: data.notes || "",
  }

  if (data.payment_lines && Array.isArray(data.payment_lines) && data.payment_lines.length > 0) {
    backendData.payment_lines = data.payment_lines.map((pl) => ({
      payment_method: pl.payment_method,
      amount: String(pl.amount),
      other_payment_method_name: pl.other_payment_method_name || undefined,
    }))
  }

  if (data.discount && data.discount > 0) {
    if (data.discount_type) {
      backendData.discount_type = data.discount_type
    }
    if (data.discount_reason) {
      backendData.discount_reason = data.discount_reason
    }
  }

  if (!backendData.shift) delete backendData.shift
  if (!backendData.customer) delete backendData.customer

  backendData.items_data = backendData.items_data.map((item: any) => {
    if (!item.variation_id) delete item.variation_id
    if (!item.unit_id) delete item.unit_id
    return item
  })

  if (data.table_id) {
    backendData.table_id = parseInt(data.table_id)
  }
  if (data.guests) {
    backendData.guests = data.guests
  }
  if (data.priority) {
    backendData.priority = data.priority
  }
  if (data.status) {
    backendData.status = data.status
  }
  if (typeof data.delivery_required === "boolean") {
    backendData.delivery_required = data.delivery_required
  }

  return backendData
}

// Transform backend sale to frontend format
function transformSale(backendSale: any): Sale {
  const paymentMethod = (backendSale.payment_method || backendSale.paymentMethod || "cash") as string
  const normalizedPaymentMethod = String(paymentMethod).toLowerCase()
  const derivedStatus = backendSale.status || (
    normalizedPaymentMethod === "tab" || normalizedPaymentMethod === "credit"
      ? "pending"
      : "completed"
  )

  return {
    id: String(backendSale.id),
    businessId: String(backendSale.tenant || backendSale.tenant_id || ""),
    outletId: String(backendSale.outlet || backendSale.outlet_id || backendSale.outlet_detail?.id || ""),
    userId: backendSale.user_detail 
      ? String(backendSale.user_detail.id) 
      : (backendSale.user ? String(backendSale.user.id || backendSale.user_id) : ""),
    items: (backendSale.items || []).map((item: any) => ({
      id: String(item.id || item.sale_item_id || ""),
      productId: item.product ? String(item.product.id || item.product_id) : "",
      productName: item.product_name || item.product?.name || "",
      quantity: item.quantity || 0,
      price: parseFloat(item.price) || 0,
      total: parseFloat(item.total) || 0,
    })),
    subtotal: parseFloat(backendSale.subtotal) || 0,
    tax: parseFloat(backendSale.tax) || 0,
    total: parseFloat(backendSale.total) || 0,
    discount: backendSale.discount ? parseFloat(backendSale.discount) : 0,
    discountType: backendSale.discount_type || backendSale.discountType,
    discountReason: backendSale.discount_reason || backendSale.discount_reason,
    paymentMethod,
    paymentLines: (backendSale.payment_lines || backendSale._raw?.payment_lines || []) as any,
    payment_lines: backendSale.payment_lines || backendSale._raw?.payment_lines || [],
    status: derivedStatus,
    createdAt: backendSale.created_at || backendSale.createdAt || new Date().toISOString(),
    // Include raw backend data with nested detail fields (outlet_detail, user_detail, shift_detail, customer_detail)
    // These are optimized fields from the backend that eliminate N+1 queries
    _raw: {
      ...backendSale,
      // Preserve nested detail fields for efficient data access
      outlet_detail: backendSale.outlet_detail,
      user_detail: backendSale.user_detail,
      shift_detail: backendSale.shift_detail,
      customer_detail: backendSale.customer_detail,
    },
  } as SaleWithMetadata
}

export const saleService = {
  async list(filters?: SaleFilters): Promise<{ results: SaleWithMetadata[]; count: number }> {
    const buildUrl = (page?: number) => {
      const params = new URLSearchParams()
      if (filters?.outlet) params.append("outlet", filters.outlet)
      if (filters?.user) params.append("user", filters.user)
      if (filters?.status) params.append("status", filters.status)
      if (filters?.payment_method) params.append("payment_method", filters.payment_method)
      if (filters?.start_date) params.append("start_date", filters.start_date)
      if (filters?.end_date) params.append("end_date", filters.end_date)
      if (filters?.search) params.append("search", filters.search)
      if (filters?.tenant) params.append("tenant", filters.tenant)
      if (filters?.businessId) params.append("business", filters.businessId)
      if (filters?.limit) params.append("limit", String(filters.limit))
      if (filters?.page != null) {
        params.append("page", String(filters.page))
      } else if (page != null) {
        params.append("page", String(page))
      }
      const query = params.toString()
      return `${apiEndpoints.sales.list}${query ? `?${query}` : ""}`
    }

    const requestedLimit = filters?.limit
    const results: SaleWithMetadata[] = []
    let page = filters?.page ?? 1
    let count = 0
    let hasNext = false

    const appendResults = (items: any[]) => {
      const transformed = items.map(transformSale)
      if (requestedLimit != null && results.length + transformed.length > requestedLimit) {
        results.push(...transformed.slice(0, requestedLimit - results.length))
      } else {
        results.push(...transformed)
      }
    }

    const response = await api.get<any>(buildUrl(page))
    if (Array.isArray(response)) {
      const transformed = response.map(transformSale)
      return {
        results: requestedLimit != null ? transformed.slice(0, requestedLimit) : transformed,
        count: transformed.length,
      }
    }

    appendResults(response.results || [])
    count = response.count || results.length
    hasNext = Boolean(response.next)

    if (filters?.page != null || !hasNext || results.length === 0 || (requestedLimit != null && results.length >= requestedLimit)) {
      return {
        results,
        count,
      }
    }

    while (hasNext && (requestedLimit == null || results.length < requestedLimit)) {
      page += 1
      const nextResponse = await api.get<any>(buildUrl(page))
      if (Array.isArray(nextResponse)) {
        appendResults(nextResponse)
        count = results.length
        break
      }

      appendResults(nextResponse.results || [])
      count = nextResponse.count || count || results.length
      hasNext = Boolean(nextResponse.next) && results.length < (requestedLimit ?? Infinity)
    }

    return {
      results,
      count,
    }
  },

  async get(id: string): Promise<SaleWithMetadata> {
    const response = await api.get<any>(apiEndpoints.sales.get(id))
    return transformSale(response)
  },

  async create(data: CreateSaleData): Promise<SaleWithMetadata> {
    const backendData = buildSaleCreatePayload(data)
    
    console.log("Sending sale request to backend:", {
      endpoint: apiEndpoints.sales.create,
      data: JSON.stringify(backendData, null, 2)
    })
    
    try {
      const response = await api.post<any>(apiEndpoints.sales.create, backendData)
      console.log("Sale response received:", response)
      if (typeof window !== "undefined") {
        const receiptNumber = response?._raw?.receipt_number || response?.receipt_number
        const outletId = response?._raw?.outlet_detail?.id || response?.outlet_detail?.id || response?.outlet || response?.outlet_id
        window.dispatchEvent(new CustomEvent("sale-completed", {
          detail: {
            saleId: response?.id,
            receiptNumber,
            outletId,
            sale: response,
          },
        }))
      }
      return transformSale(response)
    } catch (error: any) {
      console.error("Sale creation error:", error)
      console.error("Error status:", error.status)
      console.error("Error data:", error.data)
      console.error("Error message:", error.message)
      // Re-throw with more context
      throw error
    }
  },

  async void(data: VoidSaleData): Promise<SaleWithMetadata> {
    const response = await api.post<any>(apiEndpoints.sales.void, data)
    if (typeof window !== "undefined") {
      const receiptNumber = response?._raw?.receipt_number || response?.receipt_number
      const outletId = response?._raw?.outlet_detail?.id || response?.outlet_detail?.id || response?.outlet || response?.outlet_id
      window.dispatchEvent(new CustomEvent("sale-completed", {
        detail: {
          saleId: response?.id,
          receiptNumber,
          outletId,
          sale: response,
        },
      }))
    }
    return transformSale(response)
  },

  async initiatePayment(data: InitiatePaymentData): Promise<SaleWithMetadata | OfflineQueuedResult> {
    if (typeof window !== "undefined" && !window.navigator.onLine && !offlineConfig.isPhaseAtLeast(2)) {
      throw new Error(
        "You are offline. Checkout start requires internet in offline phase 1. Switch to phase 2 to queue write operations."
      )
    }

    const response = await api.post<any>(`/sales/initiate-payment/`, data)

    if (response?.offline_queued) {
      return {
        offline_queued: true,
        endpoint: response?.endpoint,
        method: response?.method,
        detail: response?.detail || "Checkout request queued offline. Reconnect to sync and complete payment.",
      }
    }

    return transformSale(response)
  },

  async finalizePayment(
    id: string,
    payload: {
      payment_method: "cash" | "card" | "mobile" | "other" | "airtel" | "tnm" | "first_capital_bank" | "national_bank" | "standard_bank" | "tab" | "credit" | "mixed"
      cash_received?: number
      change?: number
      other_payment_method_name?: string
      payment_lines?: Array<{
        payment_method: string
        amount: number
        other_payment_method_name?: string
      }>
    }
  ): Promise<SaleWithMetadata> {
    const response = await api.post<any>(`/sales/${id}/finalize-payment/`, payload)
    return transformSale(response)
  },

  async voidTransaction(id: string, reason?: string): Promise<SaleWithMetadata> {
    const response = await api.post<any>(`/sales/${id}/void-transaction/`, {
      reason: reason || "Cancelled during payment stage",
    })
    return transformSale(response)
  },

  async refund(
    id: string,
    options?:
      | string
      | {
          reason?: string
          restock?: boolean
          refund_method?: string
          refund_amount?: number
          items?: Array<{ item_id: string; sale_item_id?: string; quantity: number }>
          other_payment_method_name?: string
        }
  ): Promise<SaleWithMetadata> {
    const normalizeReason = (value?: string) => {
      const trimmed = String(value || "").trim()
      return trimmed.length > 0 ? trimmed : "Refund"
    }

    const payload = typeof options === "string"
      ? { reason: normalizeReason(options) }
      : { ...(options || {}), reason: normalizeReason(options && typeof options !== "string" ? options.reason : undefined) }

    // Backend contract expects:
    // - payment_method (not refund_method)
    // - restore_stock (not restock)
    // - items[].sale_item_id (not item_id)
    if (typeof options !== "string" && options) {
      ;(payload as any).payment_method = options.refund_method || "cash"
      ;(payload as any).restore_stock = options.restock !== undefined ? Boolean(options.restock) : true

      const normalizedItems = (options.items || []).map((item) => ({
        sale_item_id: Number(item.sale_item_id || item.item_id),
        quantity: Number(item.quantity || 0),
      }))

      const hasInvalidItems = normalizedItems.some(
        (item) => !Number.isInteger(item.sale_item_id) || item.sale_item_id <= 0 || !Number.isInteger(item.quantity) || item.quantity <= 0
      )
      if (hasInvalidItems) {
        throw new Error("Refund payload invalid: one or more selected sale items are missing a valid sale item id or quantity")
      }

      ;(payload as any).items = normalizedItems
      delete (payload as any).refund_method
      delete (payload as any).restock
      delete (payload as any).refund_amount
      delete (payload as any).other_payment_method_name
    }

    const response = await api.post<any>(`${apiEndpoints.sales.get(id)}refund/`, payload)
    return transformSale(response)
  },

  async getStats(filters?: { start_date?: string; end_date?: string; outlet?: string; status?: string }): Promise<{
    total_sales: number
    total_revenue: number
    today_sales: number
    today_revenue: number
  }> {
    const params = new URLSearchParams()
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.status) params.append("status", filters.status)
    
    const query = params.toString()
    // Use the stats action endpoint: /sales/stats/
    return api.get(`/sales/stats/${query ? `?${query}` : ""}`)
  },

  async getChartData(outletId?: string, status?: string, startDate?: string, endDate?: string): Promise<Array<{
    date: string
    sales: number
    profit: number
  }>> {
    const params = new URLSearchParams()
    if (outletId) params.append("outlet", outletId)
    if (status) params.append("status", status)
    if (startDate) params.append("start_date", startDate)
    if (endDate) params.append("end_date", endDate)
    const query = params.toString()
    return api.get(`/sales/chart_data/${query ? `?${query}` : ""}`)
  },

  async getTopSellingItems(filters?: { outlet?: string; start_date?: string; end_date?: string }): Promise<Array<{
    id: string
    name: string
    sku: string
    quantity: number
    revenue: number
    change: number
  }>> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    
    const query = params.toString()
    return api.get(`/sales/top_selling_items/${query ? `?${query}` : ""}`)
  },
}

