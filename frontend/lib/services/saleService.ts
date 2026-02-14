import { api, apiEndpoints } from "@/lib/api"
import type { Sale } from "@/lib/types"

// Sale with backend metadata such as nested detail fields and discount info
type SaleWithMetadata = Sale & {
  _raw?: any
  discount?: number
  discountType?: string | undefined
  discountReason?: string | undefined
}

export interface SaleFilters {
  outlet?: string
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
  items_data: Array<{
    product_id: string
    quantity: number
    price: number
    notes?: string
    kitchen_status?: string
  }>
  subtotal: number
  tax?: number
  discount?: number
  discount_type?: "percentage" | "amount"
  discount_reason?: string
  total: number
  payment_method: "cash" | "card" | "mobile" | "tab" | "credit"
  notes?: string
  // Restaurant-specific fields
  table_id?: string
  guests?: number
  priority?: "normal" | "high" | "urgent"
  status?: string
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
  payment_method?: "cash" | "card" | "mobile" | "tab" | "credit"
  notes?: string
  reason?: string
}

// Transform backend sale to frontend format
function transformSale(backendSale: any): Sale {
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
    paymentMethod: backendSale.payment_method || backendSale.paymentMethod || "cash",
    status: backendSale.status || "completed",
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
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.status) params.append("status", filters.status)
    if (filters?.payment_method) params.append("payment_method", filters.payment_method)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    if (filters?.search) params.append("search", filters.search)
    if (filters?.page) params.append("page", String(filters.page))
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.businessId) params.append("business", filters.businessId)
    if (filters?.limit) params.append("limit", String(filters.limit))
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.sales.list}${query ? `?${query}` : ""}`)
    
    // Handle paginated and non-paginated responses
    if (Array.isArray(response)) {
      return {
        results: response.map(transformSale),
        count: response.length,
      }
    }
    
    return {
      results: (response.results || []).map(transformSale),
      count: response.count || (response.results || []).length,
    }
  },

  async get(id: string): Promise<SaleWithMetadata> {
    const response = await api.get<any>(apiEndpoints.sales.get(id))
    return transformSale(response)
  },

  async create(data: CreateSaleData): Promise<SaleWithMetadata> {
    // Transform frontend data to backend format
    // Ensure all IDs are integers
    const backendData: any = {
      outlet: parseInt(String(data.outlet)),
      shift: data.shift ? parseInt(String(data.shift)) : undefined,
      customer: data.customer ? parseInt(String(data.customer)) : undefined,
      items_data: data.items_data.map(item => ({
        product_id: parseInt(String(item.product_id)),
        quantity: item.quantity,
        price: String(item.price), // Backend expects string for DecimalField
        notes: item.notes || "",
        kitchen_status: item.kitchen_status || "pending",
      })),
      subtotal: String(data.subtotal), // Backend expects string for DecimalField
      tax: data.tax ? String(data.tax) : "0",
      discount: data.discount ? String(data.discount) : "0",
      total: String(data.total), // Backend expects string for DecimalField
      payment_method: data.payment_method,
      notes: data.notes || "",
    }
    
    // Add discount metadata if discount is applied
    if (data.discount && data.discount > 0) {
      if (data.discount_type) {
        backendData.discount_type = data.discount_type
      }
      if (data.discount_reason) {
        backendData.discount_reason = data.discount_reason
      }
    }
    
    // Remove undefined fields
    if (!backendData.shift) delete backendData.shift
    if (!backendData.customer) delete backendData.customer
    
    // Add restaurant-specific fields if provided
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

  async refund(
    id: string,
    options?:
      | string
      | {
          reason?: string
          restock?: boolean
          refund_method?: string
          refund_amount?: number
          items?: Array<{ item_id: string; quantity: number }>
        }
  ): Promise<SaleWithMetadata> {
    const payload = typeof options === "string"
      ? { reason: options }
      : (options || {})

    const response = await api.post<any>(`${apiEndpoints.sales.get(id)}refund/`, payload)
    return transformSale(response)
  },

  async getStats(filters?: { start_date?: string; end_date?: string; outlet?: string }): Promise<{
    total_sales: number
    total_revenue: number
    today_sales: number
    today_revenue: number
  }> {
    const params = new URLSearchParams()
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    
    const query = params.toString()
    // Use the stats action endpoint: /sales/stats/
    return api.get(`/sales/stats/${query ? `?${query}` : ""}`)
  },

  async getChartData(outletId?: string): Promise<Array<{
    date: string
    sales: number
    profit: number
  }>> {
    const params = outletId ? `?outlet=${outletId}` : ""
    return api.get(`/sales/chart_data/${params}`)
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

