import { api, apiEndpoints } from "@/lib/api"
import type { Product } from "@/lib/types"

export interface StockAdjustmentData {
  product_id: string
  outlet_id: string
  quantity: number
  type?: string
  reason?: string
}

export interface StockTransferData {
  product_id: string
  from_outlet_id: string
  to_outlet_id: string
  quantity: number
  reason?: string
  is_return?: boolean
  return_number?: string
}

export interface StockReceivingData {
  outlet_id: string
  supplier?: string
  items: Array<{
    product_id: string
    quantity: number
    cost?: number
  }>
  reason?: string
}

export interface CreateMovementData {
  product_id: string
  outlet?: string
  outlet_id?: string
  movement_type: string
  quantity: number
  reason?: string
  reference_id?: string
}

export interface StockTakeData {
  outlet: string
  operating_date: string
  description?: string
  tenant?: string
}

export interface StockTakeItemData {
  product_id?: string
  expected_quantity?: number
  counted_quantity?: number
  notes?: string
}

export interface StockTakeSummary {
  stock_take_id: number
  status: string
  total_items: number
  counted_items: number
  completion_percent: number
  expected_total_quantity: number
  counted_total_quantity: number
  variance_total_quantity: number
  absolute_variance_total_quantity: number
  accuracy_percent: number
  valuation_difference: string
}

export interface StockTakeImportHistoryRow {
  batch_id: string
  import_date: string
  source_filename: string
  status: string
  stock_take_id: string
  stock_take_status?: string
  created_by?: string
  outlet?: { id: string; name: string }
  total_rows: number
  accepted_rows: number
  rejected_rows: number
  duplicate_rows: number
  processing_time_ms?: number
  preview_summary?: any
  apply_summary?: any
  previewed_at?: string
  applied_at?: string
}

export interface StockTakeImportRowResult {
  row_number: number
  product_name: string
  sku: string
  barcode: string
  counted_quantity: number
  quantity_before: number
  quantity_after: number
  status: string
  reason: string
  rejection_code?: string
  suggested_resolution?: string
  raw_data?: Record<string, any>
  normalized_data?: Record<string, any>
  target_item_id?: string
  target_product_id?: string
  expected_quantity?: number
  duplicate_count?: number
}

export interface StockTakeImportParsedRow {
  rowNumber: number
  productName: string
  countedQuantity: number
  sku?: string
  barcode?: string
}

export const inventoryService = {
  async adjust(data: StockAdjustmentData): Promise<any> {
    return api.post(apiEndpoints.inventory.adjust, data)
  },

  async transfer(data: StockTransferData): Promise<any> {
    return api.post(apiEndpoints.inventory.transfer, data)
  },

  async receive(data: StockReceivingData): Promise<any> {
    return api.post(apiEndpoints.inventory.receive, data)
  },

  async createMovement(data: CreateMovementData): Promise<any> {
    const { outlet_id, outlet, product_id, ...rest } = data
    const normalizedOutlet = outlet ?? outlet_id

    if (!normalizedOutlet) {
      throw new Error("Outlet is required to create stock movement")
    }

    if (!product_id) {
      throw new Error("Product ID is required to create stock movement")
    }

    const payload = {
      ...rest,
      outlet_id: normalizedOutlet,
      outlet: normalizedOutlet,
      product_id: product_id,
    }

    console.log("Sending stock movement payload to API:", payload)

    try {
      const response = await api.post(apiEndpoints.inventory.movements, payload)
      console.log("Stock movement created successfully:", response)
      return response
    } catch (error: any) {
      console.error("Stock movement creation failed:", {
        payload,
        error: error.message,
        status: error?.status,
        errorData: error?.data,
      })
      throw error
    }
  },

  async getMovements(filters?: {
    product?: string
    outlet?: string
    movement_type?: string
    start_date?: string
    end_date?: string
    limit?: number
  }): Promise<{ results: any[]; count?: number }> {
    const params = new URLSearchParams()
    if (filters?.product) params.append("product", filters.product)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.movement_type) params.append("movement_type", filters.movement_type)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    if (typeof filters?.limit === "number") params.append("limit", String(filters.limit))
    
    const query = params.toString()
    const url = `${apiEndpoints.inventory.movements}${query ? `?${query}` : ""}`
    
    try {
      const response = await api.get<any>(url)
      
      const results = Array.isArray(response) ? response : (response.results || [])
      const count = response.count || (Array.isArray(response) ? response.length : 0)
      
      return {
        results,
        count,
      }
    } catch (error: any) {
      console.error("Failed to fetch movements:", {
        error,
        message: error?.message,
        status: error?.status,
        data: error?.data,
        url
      })
      return { results: [], count: 0 }
    }
  },

  async updateMovement(id: string, data: Record<string, any>): Promise<any> {
    return api.patch(`${apiEndpoints.inventory.movements}${id}/`, data)
  },

  // Stock Takes
  async getStockTakes(filters?: {
    outlet?: string
    status?: string
  }): Promise<{ results: any[]; count?: number }> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.status) params.append("status", filters.status)
    
    const query = params.toString()
    try {
      const response = await api.get<any>(`${apiEndpoints.inventory.stockTakes}${query ? `?${query}` : ""}`)
      return {
        results: Array.isArray(response) ? response : (response.results || []),
        count: response.count || (Array.isArray(response) ? response.length : 0),
      }
    } catch (error) {
      console.error("Failed to fetch stock takes:", error)
      return { results: [], count: 0 }
    }
  },

  async getStockTake(id: string): Promise<any> {
    return api.get(`${apiEndpoints.inventory.stockTakes}${id}/`)
  },

  async getStockTakeSummary(id: string): Promise<StockTakeSummary> {
    return api.get(apiEndpoints.inventory.stockTakeSummary(id))
  },

  async createStockTake(data: StockTakeData): Promise<any> {
    return api.post(apiEndpoints.inventory.stockTakes, data)
  },

  async createStockTakeItem(stockTakeId: string, data: StockTakeItemData): Promise<any> {
    return api.post(`${apiEndpoints.inventory.stockTakes}${stockTakeId}/items/`, data)
  },

  async previewStockTakeImport(
    stockTakeId: string,
    file: File,
    idempotencyKey?: string,
    parsedRows?: StockTakeImportParsedRow[]
  ): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    if (parsedRows && parsedRows.length > 0) {
      formData.append('rows_json', JSON.stringify(parsedRows))
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    const headers: HeadersInit = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
    const response = await fetch(`${API_BASE_URL}${apiEndpoints.imports.stockTakesPreview(stockTakeId)}`, {
      method: 'POST',
      headers,
      body: formData,
    })

    const responseData = await response.json().catch(() => ({ detail: 'Unknown error' }))
    if (!response.ok) {
      throw new Error(responseData.detail || responseData.error || `HTTP ${response.status}: ${response.statusText}`)
    }
    return responseData
  },

  async getStockTakeImportHistory(stockTakeId: string, filters?: { search?: string; page?: number; pageSize?: number }): Promise<{ results: StockTakeImportHistoryRow[]; count: number; page: number; total_pages: number }> {
    const params = new URLSearchParams()
    if (filters?.search) params.append('search', filters.search)
    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.pageSize) params.append('page_size', String(filters.pageSize))
    const query = params.toString()
    return api.get(`${apiEndpoints.imports.stockTakesHistory(stockTakeId)}${query ? `?${query}` : ''}`)
  },

  async getStockTakeImportStatus(batchId: string): Promise<any> {
    return api.get(apiEndpoints.imports.stockTakesStatus(batchId))
  },

  async getStockTakeImportRows(batchId: string, filters?: { search?: string; page?: number; pageSize?: number }): Promise<{ results: StockTakeImportRowResult[]; count: number; page: number; total_pages: number }> {
    const params = new URLSearchParams()
    if (filters?.search) params.append('search', filters.search)
    if (filters?.page) params.append('page', String(filters.page))
    if (filters?.pageSize) params.append('page_size', String(filters.pageSize))
    const query = params.toString()
    return api.get(`${apiEndpoints.imports.stockTakesRows(batchId)}${query ? `?${query}` : ''}`)
  },

  async updateStockTakeImportRow(batchId: string, rowNumber: number, data: Record<string, any>): Promise<any> {
    return api.patch(apiEndpoints.imports.stockTakesRowUpdate(batchId, rowNumber), data)
  },

  async applyStockTakeImport(batchId: string, idempotencyKey?: string): Promise<any> {
    const payload: Record<string, any> = {}
    if (idempotencyKey) payload.idempotency_key = idempotencyKey
    return api.post(apiEndpoints.imports.stockTakesApply(batchId), payload)
  },

  async reopenStockTakeImport(batchId: string): Promise<any> {
    return api.post(apiEndpoints.imports.stockTakesReopen(batchId), {})
  },

  async downloadStockTakeImportSource(batchId: string): Promise<{ url: string; filename?: string }> {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    const response = await fetch(`${base}${apiEndpoints.imports.stockTakesSource(batchId)}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })

    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`)
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    return { url: downloadUrl, filename: `stocktake-import-${batchId}.xlsx` }
  },

  async getStockTakeItems(stockTakeId: string): Promise<any[]> {
    try {
      const results: any[] = []
      let url = `${apiEndpoints.inventory.stockTakes}${stockTakeId}/items/?page_size=500`

      while (url) {
        const response = await api.get<any>(url)
        const pageItems = Array.isArray(response) ? response : (response.results || [])
        results.push(...pageItems)
        url = response.next || null
      }

      return results
    } catch (error) {
      console.error("Failed to fetch stock take items:", error)
      return []
    }
  },

  async updateStockTakeItem(stockTakeId: string, itemId: string, data: StockTakeItemData): Promise<any> {
    return api.patch(`${apiEndpoints.inventory.stockTakes}${stockTakeId}/items/${itemId}/`, data)
  },

  async completeStockTake(id: string): Promise<any> {
    return api.post(apiEndpoints.inventory.stockTakeComplete(id))
  },

  async deleteStockTake(id: string): Promise<void> {
    await api.delete(`${apiEndpoints.inventory.stockTakes}${id}/`)
  },
}

