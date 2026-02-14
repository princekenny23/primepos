import { api, apiEndpoints } from "@/lib/api"

export interface PurchaseOrderItem {
  id: string
  product: any
  product_id?: number
  variation?: any
  variation_id?: number
  supplier?: any
  supplier_id?: number | null
  quantity: number
  unit_price: string
  total: string
  received_quantity: number
  supplier_status?: 'no_supplier' | 'supplier_assigned'
  notes?: string
}

export interface PurchaseOrder {
  id: string
  tenant: string
  supplier: any | null
  supplier_id?: number | null
  outlet: any
  outlet_id: number
  po_number: string
  order_date: string
  expected_delivery_date?: string
  status: 'draft' | 'pending_supplier' | 'pending' | 'approved' | 'ready_to_order' | 'ordered' | 'received' | 'partial' | 'cancelled'
  subtotal: string
  tax: string
  discount: string
  total: string
  notes?: string
  terms?: string
  items: PurchaseOrderItem[]
  items_data?: Array<{
    product_id: number
    quantity: number
    unit_price: string
    notes?: string
  }>
  created_by?: string
  created_at: string
  updated_at: string
}

export interface PurchaseOrderFilters {
  supplier?: string
  outlet?: string
  status?: string
  search?: string
}

export const purchaseOrderService = {
  async list(filters?: PurchaseOrderFilters): Promise<{ results: PurchaseOrder[]; count?: number }> {
    const params = new URLSearchParams()
    if (filters?.supplier) params.append("supplier", filters.supplier)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.status) params.append("status", filters.status)
    if (filters?.search) params.append("search", filters.search)
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.purchaseOrders.list}${query ? `?${query}` : ""}`)
    return {
      results: Array.isArray(response) ? response : (response.results || []),
      count: response.count || (Array.isArray(response) ? response.length : 0),
    }
  },

  async get(id: string): Promise<PurchaseOrder> {
    return api.get(apiEndpoints.purchaseOrders.get(id))
  },

  async create(data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    // Send outlet via query param as backend expects it from request context
    const outletId = (data as any).outlet_id
    if (!outletId) {
      throw new Error("Outlet is required to create a purchase order")
    }
    
    const url = `${apiEndpoints.purchaseOrders.create}?outlet=${outletId}`
    return api.post(url, data)
  },

  async update(id: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return api.put(apiEndpoints.purchaseOrders.update(id), data)
  },

  async delete(id: string): Promise<void> {
    return api.delete(apiEndpoints.purchaseOrders.delete(id))
  },

  async approve(id: string): Promise<PurchaseOrder> {
    return api.post(apiEndpoints.purchaseOrders.approve(id))
  },

  async receive(id: string, items: Array<{ item_id: number; received_quantity: number }>): Promise<PurchaseOrder> {
    return api.post(apiEndpoints.purchaseOrders.receive(id), { items })
  },

  async getItemsNeedingSupplier(): Promise<PurchaseOrderItem[]> {
    return api.get(apiEndpoints.purchaseOrders.itemsNeedingSupplier)
  },

  async assignSupplierToItem(poId: string, itemId: number, supplierId: number): Promise<PurchaseOrderItem> {
    return api.post(apiEndpoints.purchaseOrders.assignSupplierToItem(poId), {
      item_id: itemId,
      supplier_id: supplierId,
    })
  },
}

