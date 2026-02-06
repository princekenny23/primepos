import { api, apiEndpoints } from "@/lib/api"
import { saleService } from "./saleService"
import { purchaseReturnService, type PurchaseReturn } from "./purchaseReturnService"
import { inventoryService } from "./inventoryService"

export type ReturnType = "customer" | "supplier" | "outlet"

export interface ReturnItem {
  id?: string
  product_id: string
  product_name?: string
  quantity: number
  unit_price?: string
  reason?: string
  notes?: string
}

export interface CreateReturnData {
  return_type: ReturnType
  outlet_id: string
  reason: string
  notes?: string
  items: ReturnItem[]
  // Customer return specific
  sale_id?: string
  customer_id?: string
  // Supplier return specific
  supplier_id?: string
  purchase_order_id?: string
  return_date?: string
  // Outlet return specific
  from_outlet_id?: string
  to_outlet_id?: string
}

export interface Return {
  id: string
  return_type: ReturnType
  return_number?: string
  date: string
  outlet: any
  outlet_id: string
  outlet_name?: string
  user_name?: string
  reason: string
  notes?: string
  items: ReturnItem[]
  status?: string
  total?: string
  // Customer return specific
  sale?: any
  sale_id?: string
  customer?: any
  customer_id?: string
  // Supplier return specific
  supplier?: any
  supplier_id?: string
  purchase_order?: any
  purchase_order_id?: string
  // Outlet return specific
  from_outlet?: any
  from_outlet_id?: string
  to_outlet?: any
  to_outlet_id?: string
  created_by?: any
  created_at: string
  updated_at?: string
}

export interface ReturnFilters {
  return_type?: ReturnType
  outlet?: string
  status?: string
  start_date?: string
  end_date?: string
}

export const returnService = {
  /**
   * Get all returns (customer, supplier, outlet)
   */
  async list(filters?: ReturnFilters): Promise<{ results: Return[]; count: number }> {
    const allReturns: Return[] = []
    
    try {
      // Get customer returns (from sales refunds via stock movements)
      if (!filters?.return_type || filters.return_type === "customer") {
        const movements = await inventoryService.getMovements({
          movement_type: "return",
          outlet: filters?.outlet,
        })
        
        const customerReturns = (movements.results || []).filter((m: any) => {
          const reason = (m.reason || "").toLowerCase()
          return reason.includes("refund") || 
                 reason.includes("customer") || 
                 (reason.includes("return") && !reason.includes("supplier"))
        }).map((m: any) => ({
          id: `customer_${m.id}`,
          return_type: "customer" as ReturnType,
          return_number: m.reference_id || `CUST-RET-${m.id}`,
          date: m.created_at || m.date,
          outlet: m.outlet,
          outlet_id: String(m.outlet_id || m.outlet?.id || ""),
          outlet_name: m.outlet_name || m.outlet?.name || undefined,
          user_name: m.user_name || m.user?.name || m.user?.email || "System",
          reason: m.reason || "Customer return",
          items: [{
            id: String(m.id),
            product_id: String(m.product_id || m.product?.id || ""),
            product_name: m.product_name || m.product?.name || "N/A",
            quantity: Number(m.quantity) || 0,
          }],
          sale_id: m.reference_id,
          created_at: m.created_at || m.date,
        }))
        
        allReturns.push(...customerReturns)
      }
      
      // Get supplier returns (from purchase returns)
      if (!filters?.return_type || filters.return_type === "supplier") {
        const purchaseReturns = await purchaseReturnService.list({
          outlet: filters?.outlet,
          status: filters?.status,
        })
        
        const supplierReturns = purchaseReturns.results.map((pr: PurchaseReturn) => {
          const createdBy = pr.created_by as any
          const createdByName =
            createdBy && typeof createdBy === "object"
              ? createdBy.name || createdBy.email
              : undefined

          return ({
          id: `supplier_${pr.id}`,
          return_type: "supplier" as ReturnType,
          return_number: pr.return_number,
          date: pr.return_date || pr.created_at,
          outlet: pr.outlet,
          outlet_id: String(pr.outlet_id),
          outlet_name: pr.outlet?.name || undefined,
          user_name: createdByName || (typeof createdBy === "string" ? createdBy : "System"),
          reason: pr.reason,
          notes: pr.notes,
          items: (pr.items || []).map((item: any) => ({
            id: String(item.id),
            product_id: String(item.product_id || item.product?.id || ""),
            product_name: item.product?.name || "N/A",
            quantity: item.quantity,
            unit_price: item.unit_price,
            reason: item.reason,
          })),
          status: pr.status,
          total: pr.total,
          supplier: pr.supplier,
          supplier_id: String(pr.supplier_id),
          purchase_order_id: pr.purchase_order_id ? String(pr.purchase_order_id) : undefined,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          })
        })
        
        allReturns.push(...supplierReturns)
      }
      
      // Get outlet returns (from stock movements with outlet transfer)
      if (!filters?.return_type || filters.return_type === "outlet") {
        const movements = await inventoryService.getMovements({
          movement_type: "return",
          outlet: filters?.outlet,
        })
        
        const outletReturns = (movements.results || []).filter((m: any) => {
          const reason = (m.reason || "").toLowerCase()
          return reason.includes("outlet") && !reason.includes("supplier") && !reason.includes("customer")
        }).map((m: any) => ({
          id: `outlet_${m.id}`,
          return_type: "outlet" as ReturnType,
          return_number: m.reference_id || `OUTLET-RET-${m.id}`,
          date: m.created_at || m.date,
          outlet: m.outlet,
          outlet_id: String(m.outlet_id || m.outlet?.id || ""),
          outlet_name: m.outlet_name || m.outlet?.name || undefined,
          user_name: m.user_name || m.user?.name || m.user?.email || "System",
          reason: m.reason || "Outlet return",
          items: [{
            id: String(m.id),
            product_id: String(m.product_id || m.product?.id || ""),
            product_name: m.product_name || m.product?.name || "N/A",
            quantity: Number(m.quantity) || 0,
          }],
          created_at: m.created_at || m.date,
        }))
        
        allReturns.push(...outletReturns)
      }
      
      // Sort by date (newest first)
      allReturns.sort((a, b) => 
        new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime()
      )
      
      // Apply date filters if provided
      let filtered = allReturns
      if (filters?.start_date) {
        filtered = filtered.filter(r => {
          const returnDate = new Date(r.date || r.created_at)
          return returnDate >= new Date(filters.start_date!)
        })
      }
      if (filters?.end_date) {
        filtered = filtered.filter(r => {
          const returnDate = new Date(r.date || r.created_at)
          return returnDate <= new Date(filters.end_date!)
        })
      }
      
      return {
        results: filtered,
        count: filtered.length,
      }
    } catch (error) {
      console.error("Failed to load returns:", error)
      return { results: [], count: 0 }
    }
  },

  /**
   * Create a new return
   */
  async create(data: CreateReturnData): Promise<Return> {
    if (data.return_type === "customer") {
      // Customer return - process via sale refund
      if (!data.sale_id) {
        throw new Error("Sale ID is required for customer returns")
      }
      
      // Process refund for the sale (this creates stock movements)
      const refundedSale = await saleService.refund(data.sale_id, data.reason)
      
      // Return the refunded sale as a return object
      return {
        id: `customer_${refundedSale.id}`,
        return_type: "customer",
        return_number: `CUST-RET-${refundedSale.id}`,
        date: new Date().toISOString(),
        outlet: null,
        outlet_id: data.outlet_id,
        reason: data.reason,
        notes: data.notes,
        items: data.items,
        sale_id: data.sale_id,
        created_at: new Date().toISOString(),
      }
    } else if (data.return_type === "supplier") {
      // Supplier return - use purchase return service
      const purchaseReturn = await purchaseReturnService.create({
        supplier_id: parseInt(data.supplier_id!),
        outlet_id: parseInt(data.outlet_id),
        purchase_order_id: data.purchase_order_id ? parseInt(data.purchase_order_id) : undefined,
        return_date: data.return_date || new Date().toISOString().split('T')[0],
        reason: data.reason,
        notes: data.notes,
        items_data: data.items.map(item => ({
          product_id: parseInt(item.product_id),
          purchase_order_item_id: undefined,
          quantity: item.quantity,
          unit_price: item.unit_price || "0",
          reason: item.reason,
          notes: item.notes,
        })),
      })
      
      return {
        id: `supplier_${purchaseReturn.id}`,
        return_type: "supplier",
        return_number: purchaseReturn.return_number,
        date: purchaseReturn.return_date || purchaseReturn.created_at,
        outlet: null,
        outlet_id: String(purchaseReturn.outlet_id),
        reason: purchaseReturn.reason,
        notes: purchaseReturn.notes,
        items: (purchaseReturn.items || []).map((item: any) => ({
          id: item.id,
          product_id: String(item.product_id),
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          reason: item.reason,
          notes: item.notes,
        })),
        status: purchaseReturn.status,
        total: purchaseReturn.total,
        supplier_id: String(purchaseReturn.supplier_id),
        purchase_order_id: purchaseReturn.purchase_order_id ? String(purchaseReturn.purchase_order_id) : undefined,
        created_at: purchaseReturn.created_at,
      }
    } else {
      // Outlet return - use stock transfer
      if (!data.from_outlet_id || !data.to_outlet_id) {
        throw new Error("From outlet and to outlet are required for outlet returns")
      }
      
      const returnNumber = `OUTLET-RET-${Date.now()}`

      // Create stock transfers for each item
      const transfers = []
      for (const item of data.items) {
        const transfer = await inventoryService.transfer({
          product_id: item.product_id,
          from_outlet_id: data.from_outlet_id,
          to_outlet_id: data.to_outlet_id,
          quantity: item.quantity,
          reason: `Outlet return: ${data.reason}`,
          is_return: true,
          return_number: returnNumber,
        })
        transfers.push(transfer)
      }
      
      return {
        id: `outlet_${Date.now()}`,
        return_type: "outlet",
        return_number: returnNumber,
        date: new Date().toISOString(),
        outlet: null,
        outlet_id: data.from_outlet_id,
        reason: data.reason,
        notes: data.notes,
        items: data.items,
        from_outlet_id: data.from_outlet_id,
        to_outlet_id: data.to_outlet_id,
        created_at: new Date().toISOString(),
      }
    }
  },

  /**
   * Get a single return by ID
   */
  async get(id: string): Promise<Return> {
    const [type, returnId] = id.split("_")
    
    if (type === "customer") {
      // Get from stock movements
      const movements = await inventoryService.getMovements({
        movement_type: "return",
      })
      const movement = movements.results?.find((m: any) => String(m.id) === returnId)
      if (!movement) throw new Error("Return not found")
      
      return {
        id: `customer_${movement.id}`,
        return_type: "customer",
        return_number: movement.reference_id || `CUST-RET-${movement.id}`,
        date: movement.created_at || movement.date,
        outlet: null,
        outlet_id: String(movement.outlet_id || movement.outlet?.id || ""),
        reason: movement.reason || "Customer return",
        items: [{
          id: String(movement.id),
          product_id: String(movement.product_id || movement.product?.id || ""),
          product_name: movement.product_name || movement.product?.name || "N/A",
          quantity: Number(movement.quantity) || 0,
        }],
        sale_id: movement.reference_id,
        created_at: movement.created_at || movement.date,
      }
    } else if (type === "supplier") {
      const purchaseReturn = await purchaseReturnService.get(returnId)
      return {
        id: `supplier_${purchaseReturn.id}`,
        return_type: "supplier",
        return_number: purchaseReturn.return_number,
        date: purchaseReturn.return_date || purchaseReturn.created_at,
        outlet: null,
        outlet_id: String(purchaseReturn.outlet_id),
        reason: purchaseReturn.reason,
        notes: purchaseReturn.notes,
        items: (purchaseReturn.items || []).map((item: any) => ({
          id: item.id,
          product_id: String(item.product_id),
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          reason: item.reason,
          notes: item.notes,
        })),
        status: purchaseReturn.status,
        total: purchaseReturn.total,
        supplier_id: String(purchaseReturn.supplier_id),
        created_at: purchaseReturn.created_at,
      }
    } else {
      // Outlet return
      const movements = await inventoryService.getMovements({
        movement_type: "return",
      })
      const movement = movements.results?.find((m: any) => String(m.id) === returnId)
      if (!movement) throw new Error("Return not found")
      
      return {
        id: `outlet_${movement.id}`,
        return_type: "outlet",
        return_number: movement.reference_id || `OUTLET-RET-${movement.id}`,
        date: movement.created_at || movement.date,
        outlet: null,
        outlet_id: String(movement.outlet_id || movement.outlet?.id || ""),
        reason: movement.reason || "Outlet return",
        items: [{
          id: String(movement.id),
          product_id: String(movement.product_id || movement.product?.id || ""),
          product_name: movement.product_name || movement.product?.name || "N/A",
          quantity: Number(movement.quantity) || 0,
        }],
        created_at: movement.created_at || movement.date,
      }
    }
  },
}

