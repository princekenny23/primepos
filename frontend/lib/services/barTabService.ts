/**
 * Bar Tab Service - Full tab management for bar POS
 * Connects to /api/v1/bar/tabs/ endpoints
 */
import { api } from "@/lib/api"

const BAR_API_BASE = "/bar"

// ==================== Types ====================

export interface TabItem {
  id: string
  product: string
  product_name: string
  variation?: string
  variation_name?: string
  unit?: string
  quantity: number
  price: number
  discount: number
  total: number
  added_by?: string
  added_by_name?: string
  is_voided: boolean
  voided_by?: string
  voided_by_name?: string
  voided_at?: string
  void_reason?: string
  notes: string
  added_at: string
  updated_at: string
}

export interface Tab {
  id: string
  tab_number: string
  customer?: string
  customer_name: string
  customer_phone?: string
  customer_display: string
  table?: string
  table_number?: string
  status: "open" | "closed" | "merged"
  opened_by?: string
  opened_by_name?: string
  closed_by?: string
  closed_by_name?: string
  opened_at: string
  closed_at?: string
  subtotal: number
  discount: number
  tax: number
  total: number
  credit_limit?: number
  is_over_limit: boolean
  item_count: number
  items: TabItem[]
  sale?: string
  merged_into?: string
  notes: string
  created_at: string
  updated_at: string
}

export interface TabListItem {
  id: string
  tab_number: string
  customer_name: string
  customer_display: string
  table?: string
  table_number?: string
  status: "open" | "closed" | "merged"
  opened_by_name?: string
  opened_at: string
  total: number
  item_count: number
  is_over_limit: boolean
}

export interface BarTable {
  id: string
  outlet?: string
  number: string
  table_type: "table" | "bar_seat" | "booth" | "patio" | "vip"
  capacity: number
  status: "available" | "occupied" | "reserved" | "out_of_service"
  location?: string
  position_x?: number
  position_y?: number
  current_tab?: string
  current_tab_summary?: {
    id: string
    tab_number: string
    customer_name: string
    total: number
    item_count: number
    opened_at: string
  }
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TabFilters {
  outlet?: string
  status?: "open" | "closed" | "merged"
  customer?: string
  table?: string
}

export interface TableFilters {
  outlet?: string
  status?: string
  table_type?: string
  is_active?: boolean
}

// ==================== Open Tab ====================

export interface OpenTabData {
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  table_id?: string
  credit_limit?: number
  notes?: string
}

// ==================== Add Item ====================

export interface AddItemData {
  product_id: string
  variation_id?: string
  unit_id?: string
  quantity: number
  price?: number
  discount?: number
  notes?: string
}

// ==================== Close Tab ====================

export interface CloseTabData {
  payment_method: "cash" | "card" | "mobile" | "credit"
  discount?: number
  discount_type?: "percentage" | "fixed"
  discount_reason?: string
  cash_received?: number
  due_date?: string
  tip?: number
  notes?: string
}

export interface CloseTabResponse {
  tab: Tab
  sale: {
    id: string
    receipt_number: string
    total: number
    payment_method: string
    change_given: number
  }
}

// ==================== Transfer Tab ====================

export interface TransferTabData {
  to_table_id?: string | null
  reason?: string
}

// ==================== Merge Tabs ====================

export interface MergeTabsData {
  source_tab_ids: string[]
  target_tab_id: string
  reason?: string
}

export interface MergeTabsResponse {
  target_tab: Tab
  merged_count: number
}

// ==================== Split Tab ====================

export interface SplitTabData {
  split_type: "equal" | "by_items"
  number_of_splits?: number
  item_groups?: string[][]
}

export interface SplitEqualResponse {
  split_type: "equal"
  original_total: number
  splits: { split_number: number; amount: number }[]
  message: string
}

export interface SplitByItemsResponse {
  split_type: "by_items"
  original_tab: Tab
  new_tabs: TabListItem[]
}

// ==================== Tab Service ====================

export const tabService = {
  // ==================== TABS ====================

  /**
   * List tabs (defaults to open tabs only)
   */
  async list(filters?: TabFilters): Promise<{ results: TabListItem[]; count: number }> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.status) params.append("status", filters.status)
    if (filters?.customer) params.append("customer", filters.customer)
    if (filters?.table) params.append("table", filters.table)
    
    const query = params.toString()
    try {
      const response = await api.get(`${BAR_API_BASE}/tabs/${query ? `?${query}` : ""}`) as any
      return {
        results: response.results || response || [],
        count: response.count || (response.results || response || []).length
      }
    } catch (error) {
      console.error("Failed to list tabs:", error)
      return { results: [], count: 0 }
    }
  },

  /**
   * Get a single tab with all items
   */
  async get(tabId: string): Promise<Tab> {
    return api.get(`${BAR_API_BASE}/tabs/${tabId}/`)
  },

  /**
   * Open a new tab
   */
  async open(data: OpenTabData): Promise<Tab> {
    return api.post(`${BAR_API_BASE}/tabs/open/`, data)
  },

  /**
   * Add a single item to a tab
   */
  async addItem(tabId: string, data: AddItemData): Promise<{ item: TabItem; tab_total: number; warning?: string }> {
    return api.post(`${BAR_API_BASE}/tabs/${tabId}/add_item/`, data)
  },

  /**
   * Add multiple items to a tab
   */
  async addItems(tabId: string, items: AddItemData[]): Promise<{ items: TabItem[]; tab_total: number; errors: any[] }> {
    return api.post(`${BAR_API_BASE}/tabs/${tabId}/add_items/`, { items })
  },

  /**
   * Void an item from a tab
   */
  async voidItem(tabId: string, itemId: string, reason: string): Promise<{ item: TabItem; tab_total: number }> {
    return api.post(`${BAR_API_BASE}/tabs/${tabId}/items/${itemId}/void/`, { reason })
  },

  /**
   * Apply discount to a tab
   */
  async applyDiscount(tabId: string, data: { 
    discount: number
    discount_type: "percentage" | "fixed"
    reason?: string 
  }): Promise<{ tab: Tab; discount_applied: number }> {
    return api.post(`${BAR_API_BASE}/tabs/${tabId}/apply_discount/`, data)
  },

  /**
   * Close a tab and create a sale
   */
  async close(tabId: string, data: CloseTabData): Promise<CloseTabResponse> {
    return api.post(`${BAR_API_BASE}/tabs/${tabId}/close/`, data)
  },

  /**
   * Transfer a tab to a different table (or make it walk-up)
   */
  async transfer(tabId: string, data: TransferTabData): Promise<Tab> {
    return api.post(`${BAR_API_BASE}/tabs/${tabId}/transfer/`, data)
  },

  /**
   * Merge multiple tabs into one
   */
  async merge(data: MergeTabsData): Promise<MergeTabsResponse> {
    return api.post(`${BAR_API_BASE}/tabs/merge/`, data)
  },

  /**
   * Split a tab
   */
  async split(tabId: string, data: SplitTabData): Promise<SplitEqualResponse | SplitByItemsResponse> {
    return api.post(`${BAR_API_BASE}/tabs/${tabId}/split/`, data)
  },

  /**
   * Get tab summary (all open tabs overview)
   */
  async summary(outletId?: string): Promise<{ open_tabs: number; total_outstanding: number; tabs: TabListItem[] }> {
    const query = outletId ? `?outlet=${outletId}` : ""
    return api.get(`${BAR_API_BASE}/tabs/summary/${query}`)
  },

  /**
   * Get tab history (items, transfers)
   */
  async history(tabId: string): Promise<{ tab: Tab; items_history: TabItem[]; transfers: any[] }> {
    return api.get(`${BAR_API_BASE}/tabs/${tabId}/history/`)
  },

  // ==================== TABLES ====================

  /**
   * List all bar tables
   */
  async listTables(filters?: TableFilters): Promise<{ results: BarTable[]; count: number }> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.status) params.append("status", filters.status)
    if (filters?.table_type) params.append("table_type", filters.table_type)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))
    
    const query = params.toString()
    try {
      const response = await api.get(`${BAR_API_BASE}/tables/${query ? `?${query}` : ""}`) as any
      return {
        results: response.results || response || [],
        count: response.count || (response.results || response || []).length
      }
    } catch (error) {
      console.error("Failed to list tables:", error)
      return { results: [], count: 0 }
    }
  },

  /**
   * Get a single table
   */
  async getTable(tableId: string): Promise<BarTable> {
    return api.get(`${BAR_API_BASE}/tables/${tableId}/`)
  },

  /**
   * Create a new table
   */
  async createTable(data: Partial<BarTable>): Promise<BarTable> {
    return api.post(`${BAR_API_BASE}/tables/`, data)
  },

  /**
   * Update a table
   */
  async updateTable(tableId: string, data: Partial<BarTable>): Promise<BarTable> {
    return api.put(`${BAR_API_BASE}/tables/${tableId}/`, data)
  },

  /**
   * Delete a table
   */
  async deleteTable(tableId: string): Promise<void> {
    return api.delete(`${BAR_API_BASE}/tables/${tableId}/`)
  },

  /**
   * Set table status
   */
  async setTableStatus(tableId: string, status: BarTable["status"]): Promise<BarTable> {
    return api.post(`${BAR_API_BASE}/tables/${tableId}/set_status/`, { status })
  },

  /**
   * Get floor plan view
   */
  async floorPlan(outletId?: string): Promise<{
    locations: Record<string, BarTable[]>
    tables: BarTable[]
    summary: { total: number; available: number; occupied: number; reserved: number }
  }> {
    const query = outletId ? `?outlet=${outletId}` : ""
    return api.get(`${BAR_API_BASE}/tables/floor_plan/${query}`)
  },
}

export default tabService
