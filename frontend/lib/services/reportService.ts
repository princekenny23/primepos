import { api, apiEndpoints, apiConfig } from "@/lib/api"

export interface SalesReportData {
  date: string
  sales: number
  transactions: number
  revenue: number
}

export interface SalesReportSummary {
  total_sales: number
  total_transactions: number
  total_revenue: number
  total_tax: number
  total_discount: number
  by_payment_method?: { payment_method: string; count: number; total: number }[]
  top_products?: { product_name: string; total_quantity: number; total_revenue: number }[]
}

export interface ProductReportData {
  product_id: number
  product_name: string
  product_sku: string
  category: string
  total_sold: number
  total_revenue: number
  current_stock: number
  is_low_stock: boolean
}

export interface ReportFilters {
  tenant?: string
  outlet?: string
  start_date?: string
  end_date?: string
  category?: string
}

export interface InventoryValuationItem {
  id: number
  code: string
  name: string
  retail_price: number
  cost_price: number
  category: string
  category_id: number | null
  low_stock_threshold: number
  open_qty: number
  open_value: number
  received_qty: number
  received_value: number
  transferred_qty: number
  transferred_value: number
  adjusted_qty: number
  adjusted_value: number
  sold_qty: number
  sold_value: number
  stock_qty: number
  stock_value: number
  counted_qty: number
  counted_value: number
  discrepancy: number
  surplus_qty: number
  surplus_value: number
  shortage_qty: number
  shortage_value: number
}

export interface InventoryValuationReport {
  items: InventoryValuationItem[]
  totals: {
    open_qty: number
    open_value: number
    received_qty: number
    received_value: number
    transferred_qty: number
    transferred_value: number
    adjusted_qty: number
    adjusted_value: number
    sold_qty: number
    sold_value: number
    stock_qty: number
    stock_value: number
    counted_qty: number
    counted_value: number
    discrepancy: number
    surplus_qty: number
    surplus_value: number
    shortage_qty: number
    shortage_value: number
  }
  period: {
    start_date: string
    end_date: string
  }
  categories: { id: number; name: string }[]
  has_stock_take: boolean
  stock_take_date: string | null
  item_count: number
}

export const reportService = {
  async getSalesReport(filters?: ReportFilters): Promise<SalesReportSummary | null> {
    const params = new URLSearchParams()
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    
    const query = params.toString()
    try {
      return await api.get<any>(`${apiEndpoints.reports.sales}${query ? `?${query}` : ""}`)
    } catch (error) {
      console.error("Failed to fetch sales report:", error)
      return null
    }
  },

  async getProductReport(filters?: ReportFilters): Promise<ProductReportData[]> {
    const params = new URLSearchParams()
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    if (filters?.category) params.append("category", filters.category)
    
    const query = params.toString()
    try {
      const response = await api.get<any>(`${apiEndpoints.reports.products}${query ? `?${query}` : ""}`)
      if (Array.isArray(response)) return response
      if (response.products) return response.products
      return response.results || []
    } catch (error) {
      console.error("Failed to fetch product report:", error)
      return []
    }
  },

  async getCustomerReport(filters?: ReportFilters): Promise<any[]> {
    const params = new URLSearchParams()
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    
    const query = params.toString()
    try {
      const response = await api.get<any>(`${apiEndpoints.reports.customers}${query ? `?${query}` : ""}`)
      if (Array.isArray(response)) return response
      if (response.customers) return response.customers
      return response.results || []
    } catch (error) {
      console.error("Failed to fetch customer report:", error)
      return []
    }
  },

  async getProfitLoss(filters?: ReportFilters): Promise<any> {
    const params = new URLSearchParams()
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    
    const query = params.toString()
    try {
      return await api.get<any>(`${apiEndpoints.reports.profitLoss}${query ? `?${query}` : ""}`)
    } catch (error) {
      console.error("Failed to fetch profit & loss:", error)
      return null
    }
  },

  async getInventoryValuation(filters?: ReportFilters): Promise<InventoryValuationReport | null> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    if (filters?.category) params.append("category", filters.category)
    
    const query = params.toString()
    try {
      return await api.get<any>(`${apiEndpoints.reports.inventoryValuation}${query ? `?${query}` : ""}`)
    } catch (error) {
      console.error("Failed to fetch inventory valuation report:", error)
      return null
    }
  },

  async getDailySales(filters?: { date?: string; start_date?: string; end_date?: string; outlet?: string }): Promise<any> {
    const params = new URLSearchParams()
    if (filters?.date) params.append("date", filters.date)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    
    const query = params.toString()
    try {
      return await api.get<any>(`${apiEndpoints.reports.dailySales}${query ? `?${query}` : ""}`)
    } catch (error) {
      console.error("Failed to fetch daily sales report:", error)
      return null
    }
  },

  async getTopProducts(filters?: ReportFilters, limit = 10): Promise<any> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    params.append("limit", limit.toString())
    
    const query = params.toString()
    try {
      return await api.get<any>(`${apiEndpoints.reports.topProducts}${query ? `?${query}` : ""}`)
    } catch (error) {
      console.error("Failed to fetch top products report:", error)
      return null
    }
  },

  async getCashSummary(date?: string): Promise<any> {
    const params = new URLSearchParams()
    if (date) params.append("date", date)
    
    const query = params.toString()
    try {
      return await api.get<any>(`${apiEndpoints.reports.cashSummary}${query ? `?${query}` : ""}`)
    } catch (error) {
      console.error("Failed to fetch cash summary report:", error)
      return null
    }
  },

  async getShiftSummary(filters?: ReportFilters): Promise<any> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    
    const query = params.toString()
    try {
      return await api.get<any>(`${apiEndpoints.reports.shiftSummary}${query ? `?${query}` : ""}`)
    } catch (error) {
      console.error("Failed to fetch shift summary report:", error)
      return null
    }
  },

  async getExpensesReport(filters?: ReportFilters): Promise<any> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)

    const query = params.toString()
    try {
      return await api.get<any>(`${apiEndpoints.reports.expenses}${query ? `?${query}` : ""}`)
    } catch (error) {
      console.error("Failed to fetch expenses report:", error)
      return null
    }
  },

  async downloadReport(endpoint: string, params?: Record<string, string>, filename?: string): Promise<void> {
    if (typeof window === "undefined") return

    const url = new URL(`${apiConfig.baseURL}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.append(key, value)
        }
      })
    }

    const token = localStorage.getItem("authToken")
    const outletId = localStorage.getItem("currentOutletId")
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (outletId) headers["X-Outlet-ID"] = outletId

    const response = await fetch(url.toString(), { headers })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `Failed to download report: ${response.status}`)
    }

    const blob = await response.blob()
    const link = document.createElement("a")
    link.href = window.URL.createObjectURL(blob)
    link.download = filename || "report"
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(link.href)
  },
}

