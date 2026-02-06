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

export interface StockTakeData {
  outlet: string
  operating_date: string
  description?: string
}

export interface StockTakeItemData {
  counted_quantity: number
  notes?: string
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

  async getMovements(filters?: {
    product?: string
    outlet?: string
    movement_type?: string
    start_date?: string
    end_date?: string
  }): Promise<{ results: any[]; count?: number }> {
    const params = new URLSearchParams()
    if (filters?.product) params.append("product", filters.product)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.movement_type) params.append("movement_type", filters.movement_type)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    
    const query = params.toString()
    const url = `${apiEndpoints.inventory.movements}${query ? `?${query}` : ""}`
    console.log("getMovements API call:", { url, filters })
    
    try {
      const response = await api.get<any>(url)
      console.log("getMovements raw response:", {
        isArray: Array.isArray(response),
        hasResults: !Array.isArray(response) && 'results' in response,
        responseType: typeof response,
        responseKeys: !Array.isArray(response) ? Object.keys(response) : [],
        response
      })
      
      const results = Array.isArray(response) ? response : (response.results || [])
      const count = response.count || (Array.isArray(response) ? response.length : 0)
      
      console.log("getMovements processed:", { resultsCount: results.length, count })
      
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

  async createStockTake(data: StockTakeData): Promise<any> {
    return api.post(apiEndpoints.inventory.stockTakes, data)
  },

  async getStockTakeItems(stockTakeId: string): Promise<any[]> {
    try {
      const response = await api.get<any>(`${apiEndpoints.inventory.stockTakes}${stockTakeId}/items/`)
      return Array.isArray(response) ? response : (response.results || [])
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

