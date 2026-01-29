import { api, apiEndpoints } from "@/lib/api"
import type { Product, Category, ProductUnit } from "@/lib/types"

// Transform backend unit to frontend format
function transformUnit(backendUnit: any): ProductUnit {
  return {
    id: String(backendUnit.id),
    unit_name: backendUnit.unit_name || backendUnit.name || `Unit ${backendUnit.id}`,
    conversion_factor: Number(backendUnit.conversion_factor) || 1,
    retail_price: Number(backendUnit.retail_price) || 0,
    wholesale_price: backendUnit.wholesale_price ? Number(backendUnit.wholesale_price) : undefined,
    is_active: backendUnit.is_active !== false,
  }
}

// Transform frontend unit to backend format
function transformUnitToBackend(frontendUnit: Partial<ProductUnit>): any {
  return {
    unit_name: frontendUnit.unit_name,
    conversion_factor: frontendUnit.conversion_factor || 1,
    retail_price: frontendUnit.retail_price || 0,
    wholesale_price: frontendUnit.wholesale_price || undefined,
    is_active: frontendUnit.is_active !== undefined ? frontendUnit.is_active : true,
  }
}

export interface ProductFilters {
  category?: string
  is_active?: boolean
  search?: string
  page?: number
  tenant?: string
  businessId?: string
  outlet?: string
  limit?: number
}

// Transform backend product to frontend format
function transformProduct(backendProduct: any): Product {
  // Extract tenant ID - handle both object and ID formats
  let tenantId = ""
  if (backendProduct.tenant) {
    if (typeof backendProduct.tenant === 'object' && backendProduct.tenant.id) {
      tenantId = String(backendProduct.tenant.id)
    } else {
      tenantId = String(backendProduct.tenant)
    }
  } else if (backendProduct.tenant_id) {
    tenantId = String(backendProduct.tenant_id)
  }
  
  // Extract outlet information
  let outletId = ""
  let outletName = ""
  if (backendProduct.outlet) {
    if (typeof backendProduct.outlet === 'object' && backendProduct.outlet.id) {
      outletId = String(backendProduct.outlet.id)
      outletName = backendProduct.outlet.name || ""
    } else {
      outletId = String(backendProduct.outlet)
    }
  } else if (backendProduct.outlet_id) {
    outletId = String(backendProduct.outlet_id)
  }

  // Normalize units for multi-unit support
  const rawUnits = backendProduct.units || backendProduct.selling_units || []
  const units = Array.isArray(rawUnits)
    ? rawUnits.map((u: any) => ({
        id: String(u.id || u.unit_id || u.name || Math.random()),
        unit_name: u.name || u.unit_name || "Unit",
        conversion_factor: Number(u.conversion_factor || u.conversionFactor || u.quantity || 1),
        retail_price: Number(u.retail_price || u.price || 0),
        wholesale_price: u.wholesale_price !== undefined ? Number(u.wholesale_price) : undefined,
        cost_price: u.cost_price !== undefined ? Number(u.cost_price) : undefined,
        is_active: u.is_active !== false,
      }))
    : []

  // Normalize location stocks
  const location_stocks = Array.isArray(backendProduct.location_stocks || backendProduct.stock_per_location)
    ? (backendProduct.location_stocks || backendProduct.stock_per_location).map((loc: any) => ({
        ...loc,
        id: String(loc.id ?? `${backendProduct.id}-${loc.outlet_id || loc.outlet}`),
        outlet_id: loc.outlet_id || loc.outlet,
        outlet_name: loc.outlet_name || loc.outlet?.name,
        quantity: Number(loc.quantity || 0),
      }))
    : []

  // Normalize batch data
  const batches = Array.isArray(backendProduct.batches)
    ? backendProduct.batches.map((b: any) => ({
        ...b,
        id: String(b.id ?? b.batch_number ?? Math.random()),
        quantity: Number(b.quantity || 0),
      }))
    : []

  return {
    id: String(backendProduct.id),
    businessId: tenantId,
    name: backendProduct.name,
    description: backendProduct.description || "",
    sku: backendProduct.sku || "",
    barcode: backendProduct.barcode || "",
    price: parseFloat(backendProduct.retail_price || backendProduct.price) || 0, // Backward compatibility
    retail_price: parseFloat(backendProduct.retail_price || backendProduct.price) || 0,
    cost: backendProduct.cost ? parseFloat(backendProduct.cost) : undefined,
    cost_price: backendProduct.cost ? parseFloat(backendProduct.cost) : undefined,
    categoryId: backendProduct.category ? String(backendProduct.category.id || backendProduct.category_id) : undefined,
    category: backendProduct.category ? {
      id: String(backendProduct.category.id || backendProduct.category_id),
      name: backendProduct.category.name || "",
    } : undefined,
    outlet: outletId ? { id: outletId, name: outletName } : undefined,
    outlet_id: outletId,
    outlet_name: outletName,
    stock: backendProduct.stock || 0,
    lowStockThreshold: backendProduct.low_stock_threshold || backendProduct.lowStockThreshold || 0,
    is_low_stock: backendProduct.is_low_stock || false, // Include low stock flag from backend
    selling_units: backendProduct.selling_units || [], // Keep legacy field for backward compatibility
    location_stocks,
    batches,
    image: backendProduct.image || undefined,
    isActive: backendProduct.is_active !== undefined ? backendProduct.is_active : (backendProduct.isActive !== undefined ? backendProduct.isActive : true),
    // Wholesale fields
    wholesale_price: backendProduct.wholesale_price ? parseFloat(backendProduct.wholesale_price) : undefined,
    wholesalePrice: backendProduct.wholesale_price ? parseFloat(backendProduct.wholesale_price) : undefined,
    wholesale_enabled: backendProduct.wholesale_enabled || false,
    wholesaleEnabled: backendProduct.wholesale_enabled || false,
    minimum_wholesale_quantity: backendProduct.minimum_wholesale_quantity || 1,
    minimumWholesaleQuantity: backendProduct.minimum_wholesale_quantity || 1,
    createdAt: backendProduct.created_at || backendProduct.createdAt || new Date().toISOString(),
  }
}

// Transform frontend product to backend format
function transformProductToBackend(frontendProduct: Partial<Product>): any {
  // Handle retail_price (preferred) or price (backward compatibility)
  const priceValue = frontendProduct.retail_price !== undefined ? frontendProduct.retail_price : frontendProduct.price
  const retailPrice = priceValue ? Math.max(0.01, parseFloat(priceValue.toString())) : 0.01
  
  const data: any = {
    name: frontendProduct.name,
    description: frontendProduct.description || "",
    barcode: frontendProduct.barcode || "",
    retail_price: retailPrice.toString(),
    stock: frontendProduct.stock || 0,
    low_stock_threshold: (frontendProduct as any).low_stock_threshold !== undefined ? (frontendProduct as any).low_stock_threshold : (frontendProduct.lowStockThreshold || 0),
    unit: frontendProduct.unit || "pcs", // Use provided unit or default to "pcs"
    is_active: frontendProduct.isActive !== undefined ? frontendProduct.isActive : true,
  }
  
  // Only include SKU if provided (SKU is optional)
  if (frontendProduct.sku && frontendProduct.sku.trim() !== "") {
    data.sku = frontendProduct.sku.trim()
  }
  
  // Only include cost if provided (handle both cost and cost_price)
  const costValue = frontendProduct.cost !== undefined ? frontendProduct.cost : frontendProduct.cost_price
  if (costValue !== undefined && costValue !== null) {
    const cost = Math.max(0, parseFloat(costValue.toString()))
    data.cost = cost.toString()
  }
  
  // Handle wholesale fields - always include if wholesale_enabled is explicitly set
  const wholesaleEnabled = frontendProduct.wholesale_enabled !== undefined 
    ? frontendProduct.wholesale_enabled 
    : (frontendProduct.wholesaleEnabled !== undefined ? frontendProduct.wholesaleEnabled : false)
  
  if (wholesaleEnabled) {
    // Wholesale is enabled - require wholesale_price
    const wholesalePrice = frontendProduct.wholesale_price || frontendProduct.wholesalePrice
    if (wholesalePrice !== undefined && wholesalePrice !== null) {
      data.wholesale_price = Math.max(0.01, parseFloat(wholesalePrice.toString())).toString()
      data.wholesale_enabled = true
      data.minimum_wholesale_quantity = frontendProduct.minimum_wholesale_quantity || frontendProduct.minimumWholesaleQuantity || 1
    }
  } else {
    // Explicitly set wholesale_enabled to false to clear any existing wholesale pricing
    data.wholesale_enabled = false
    data.wholesale_price = null
    data.minimum_wholesale_quantity = 1
  }
  
  // Only include category_id if provided and valid
  // Don't send category_id at all if it's empty/null/undefined
  if (frontendProduct.categoryId !== undefined && frontendProduct.categoryId !== null && frontendProduct.categoryId !== "") {
    const categoryIdStr = String(frontendProduct.categoryId).trim()
    if (categoryIdStr !== "" && categoryIdStr !== "undefined" && categoryIdStr !== "null") {
      const categoryId = parseInt(categoryIdStr)
      if (!isNaN(categoryId) && categoryId > 0) {
        data.category_id = categoryId
      }
    }
  }
  
  // Include outlet if provided
  if (frontendProduct.outlet) {
    data.outlet = typeof frontendProduct.outlet === 'object' ? frontendProduct.outlet.id : frontendProduct.outlet
  } else if ((frontendProduct as any).outletId) {
    data.outlet = (frontendProduct as any).outletId
  }

  // NOTE: Units are now handled separately via unitService
  // They should NOT be included in the product create/update payload
  
  return data
}

// Transform backend category to frontend format
function transformCategory(backendCategory: any): Category {
  return {
    id: String(backendCategory.id),
    businessId: String(backendCategory.tenant || backendCategory.tenant_id || ""),
    name: backendCategory.name,
    description: backendCategory.description || "",
    createdAt: backendCategory.created_at || backendCategory.createdAt || new Date().toISOString(),
  }
}

// Inline categoryService for compatibility
export const categoryService = {
  async list(): Promise<Category[]> {
    const response = await api.get<any>(apiEndpoints.categories.list)
    const categories = Array.isArray(response) ? response : (response.results || [])
    return categories.map(transformCategory)
  },

  async get(id: string): Promise<Category> {
    const response = await api.get<any>(apiEndpoints.categories.get(id))
    return transformCategory(response)
  },

  async create(data: Partial<Category>): Promise<Category> {
    const backendData = {
      name: data.name,
      description: data.description || "",
    }
    const response = await api.post<any>(apiEndpoints.categories.create, backendData)
    return transformCategory(response)
  },

  async update(id: string, data: Partial<Category>): Promise<Category> {
    const backendData = {
      name: data.name,
      description: data.description || "",
    }
    const response = await api.put<any>(apiEndpoints.categories.update(id), backendData)
    return transformCategory(response)
  },

  async delete(id: string): Promise<void> {
    await api.delete(apiEndpoints.categories.delete(id))
  },
}

export const productService = {
  async list(filters?: ProductFilters): Promise<{ results: Product[]; count: number; next?: string; previous?: string }> {
    const params = new URLSearchParams()
    if (filters?.category) params.append("category", filters.category)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))
    if (filters?.search) params.append("search", filters.search)
    if (filters?.page) params.append("page", String(filters.page))
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.businessId) params.append("business", filters.businessId)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.limit) params.append("limit", String(filters.limit))
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.products.list}${query ? `?${query}` : ""}`)
    
    // Handle paginated and non-paginated responses
    if (Array.isArray(response)) {
      return {
        results: response.map(transformProduct),
        count: response.length,
      }
    }
    
    return {
      results: (response.results || []).map(transformProduct),
      count: response.count || (response.results || []).length,
      next: response.next,
      previous: response.previous,
    }
  },

  async get(id: string): Promise<Product> {
    const response = await api.get<any>(apiEndpoints.products.get(id))
    return transformProduct(response)
  },

  async create(data: Partial<Product>): Promise<Product> {
    const backendData = transformProductToBackend(data)
    console.log("Creating product via real API:", { endpoint: apiEndpoints.products.create, data: backendData })
    try {
      const response = await api.post<any>(apiEndpoints.products.create, backendData)
      console.log("Product created successfully:", response)
      return transformProduct(response)
    } catch (error: any) {
      console.error("Product creation error:", error)
      console.error("Backend data sent:", backendData)
      throw error
    }
  },

  async update(id: string, data: Partial<Product>): Promise<Product> {
    const backendData = transformProductToBackend(data)
    console.log("Updating product via real API:", { id, endpoint: apiEndpoints.products.update(id), data: backendData })
    try {
      const response = await api.put<any>(apiEndpoints.products.update(id), backendData)
      console.log("Product updated successfully:", response)
      return transformProduct(response)
    } catch (error: any) {
      console.error("Product update failed:", error)
      throw error
    }
  },

  async delete(id: string): Promise<void> {
    await api.delete(apiEndpoints.products.delete(id))
  },

  async getCategories(): Promise<Category[]> {
    try {
      return await categoryService.list()
    } catch (error) {
      console.error("Failed to load categories via productService:", error)
      return []
    }
  },

  async export(filters: any): Promise<{ url: string; filename?: string; product_count?: number }> {
    const params = new URLSearchParams()
    if (filters?.format) params.append("format", filters.format)
    if (filters?.outlet_id) params.append("outlet_id", String(filters.outlet_id))
    if (filters?.category_id) params.append("category_id", String(filters.category_id))
    if (filters?.include_inactive !== undefined) params.append("include_inactive", String(filters.include_inactive))
    if (filters?.include_stock !== undefined) params.append("include_stock", String(filters.include_stock))
    if (filters?.include_batches !== undefined) params.append("include_batches", String(filters.include_batches))
    if (filters?.include_variations !== undefined) params.append("include_variations", String(filters.include_variations))
    if (filters?.include_units !== undefined) params.append("include_units", String(filters.include_units))

    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
    const endpoint = `${apiEndpoints.products.list.replace(/\/$/, "")}/bulk-export/`
    const url = `${base}${endpoint}${params.toString() ? `?${params.toString()}` : ""}`

    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
    const response = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })

    if (!response.ok) {
      throw new Error(`Export failed (${response.status})`)
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)

    return {
      url: downloadUrl,
      filename: `products-export-${new Date().toISOString().split("T")[0]}.${filters?.format || "csv"}`,
    }
  },

  async bulkDelete(productIds: string[]): Promise<{
    success: boolean
    deleted_count: number
    deleted_products: string[]
    not_found?: number[]
    warning?: string
  }> {
    return api.post(`${apiEndpoints.products.list}bulk-delete/`, {
      product_ids: productIds,
    })
  },

  async getLowStock(outletId?: string): Promise<Product[]> {
    const params = outletId ? `?outlet=${outletId}` : ""
    const response = await api.get<any>(`${apiEndpoints.products.list}low_stock/${params}`)
    const products = Array.isArray(response) ? response : (response.results || [])
    return products.map(transformProduct)
  },

  async count(filters?: ProductFilters): Promise<number> {
    const params = new URLSearchParams()
    if (filters?.category) params.append("category", filters.category)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))
    if (filters?.search) params.append("search", filters.search)
    
    const query = params.toString()
    const response = await api.get<{ count: number }>(`${apiEndpoints.products.list}count/${query ? `?${query}` : ""}`)
    return response.count
  },

  async lookup(barcode: string): Promise<{ products: Product[] }> {
    if (!barcode || barcode.trim() === "") {
      return { products: [] }
    }
    const response = await api.get<any>(`${apiEndpoints.products.lookup}?barcode=${encodeURIComponent(barcode.trim())}`)
    const products = (response.products || []).map(transformProduct)
    return { products }
  },

      async generateSkuPreview(): Promise<string> {
        const response = await api.get<{ sku: string }>(`${apiEndpoints.products.list}generate-sku/`)
        return response.sku
      },

      async bulkImport(file: File, outletId?: string): Promise<{
        success: boolean
        total_rows: number
        imported: number
        failed: number
        categories_created: number
        categories_existing: number
        errors: Array<{ row: number; product_name: string; error: string }>
        warnings: Array<{ row: number; product_name: string; warning: string }>
        requires_outlet?: boolean
        message?: string
        outlets?: Array<{ id: number | string; name: string }>
      }> {
        const formData = new FormData()
        formData.append('file', file)
        
        // For file uploads, we need to NOT set Content-Type header
        // Let the browser set it with the boundary
        const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
        const headers: HeadersInit = {}
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        // Add outlet ID to header if provided
        if (outletId) {
          headers['X-Outlet-ID'] = outletId
        }
        
        // Build URL with outlet query param if provided
        let url = `${apiEndpoints.products.list}bulk-import/`
        if (outletId) {
          url += `?outlet=${outletId}`
        }
        
        // Don't set Content-Type - browser will set it with boundary for multipart/form-data
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
        const response = await fetch(`${API_BASE_URL}${url}`, {
          method: 'POST',
          headers: headers,
          body: formData,
        })
        
        const responseData = await response.json().catch(() => ({ error: 'Unknown error' }))
        
        if (!response.ok) {
          // Check if this is a requires_outlet response
          if (responseData.requires_outlet) {
            return responseData
          }
          throw new Error(responseData.error || responseData.message || `HTTP ${response.status}: ${response.statusText}`)
        }
        
        return responseData
      },
    }

export interface LocationStock {
  id: string
  tenant: string
  variation: string | any
  outlet: string | { id: string; name: string }
  quantity: number
  updated_at?: string
  product_name?: string
  variation_name?: string
  outlet_name?: string
}

// Variation functions removed - UNITS ONLY ARCHITECTURE (no more ItemVariation model)

function transformLocationStock(backendStock: any): LocationStock {
  return {
    id: String(backendStock.id),
    tenant: String(backendStock.tenant),
    variation: typeof backendStock.variation === 'object'
      ? backendStock.variation
      : String(backendStock.variation),
    outlet: typeof backendStock.outlet === 'object'
      ? { id: String(backendStock.outlet.id), name: backendStock.outlet.name }
      : String(backendStock.outlet),
    quantity: backendStock.quantity || 0,
    updated_at: backendStock.updated_at,
    product_name: backendStock.product_name,
    variation_name: backendStock.variation_name,
    outlet_name: backendStock.outlet_name,
  }
}

export const locationStockService = {
  async list(filters?: { outlet?: string; variation?: string; product?: string }): Promise<LocationStock[]> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.variation) params.append("variation", filters.variation)
    if (filters?.product) params.append("product", filters.product)
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.locationStock.list}${query ? `?${query}` : ""}`)
    
    const stocks = Array.isArray(response) ? response : (response.results || [])
    return stocks.map(transformLocationStock)
  },

  async get(id: string): Promise<LocationStock> {
    const response = await api.get<any>(apiEndpoints.locationStock.get(id))
    return transformLocationStock(response)
  },

  async create(data: Partial<LocationStock>): Promise<LocationStock> {
    const backendData: any = {
      variation: typeof data.variation === 'object' ? data.variation.id : data.variation,
      outlet: typeof data.outlet === 'object' ? data.outlet.id : data.outlet,
      quantity: data.quantity || 0,
    }
    const response = await api.post<any>(apiEndpoints.locationStock.create, backendData)
    return transformLocationStock(response)
  },

  async update(id: string, data: Partial<LocationStock>): Promise<LocationStock> {
    const backendData: any = {
      quantity: data.quantity,
    }
    if (data.variation) {
      backendData.variation = typeof data.variation === 'object' ? data.variation.id : data.variation
    }
    if (data.outlet) {
      backendData.outlet = typeof data.outlet === 'object' ? data.outlet.id : data.outlet
    }
    const response = await api.put<any>(apiEndpoints.locationStock.update(id), backendData)
    return transformLocationStock(response)
  },

  async delete(id: string): Promise<void> {
    await api.delete(apiEndpoints.locationStock.delete(id))
  },

  async bulkUpdate(data: { outlet: string; updates: Array<{ variation_id: string; quantity: number; movement_type?: string; reason?: string }> }): Promise<{
    success: number
    errors: number
    results: Array<{ variation_id: string; variation_name: string; old_quantity: number; new_quantity: number; difference: number }>
    error_details?: Array<any>
  }> {
    return api.post(apiEndpoints.locationStock.bulkUpdate, data)
  },
}

// Unit Service - consolidates unit CRUD operations
export const unitService = {
  /**
   * List all units with optional filters
   */
  async list(filters?: { product?: string; is_active?: boolean }): Promise<ProductUnit[]> {
    const params = new URLSearchParams()
    if (filters?.product) params.append("product", filters.product)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))

    try {
      const response = await api.get<any>(`${apiEndpoints.units.list}?${params.toString()}`)
      const units = Array.isArray(response.results) ? response.results : Array.isArray(response) ? response : []
      return units.map(transformUnit)
    } catch (error: any) {
      console.error("Failed to fetch units:", error)
      throw error
    }
  },

  /**
   * Get a single unit by ID
   */
  async get(id: string): Promise<ProductUnit> {
    try {
      const response = await api.get<any>(apiEndpoints.units.get(id))
      return transformUnit(response)
    } catch (error: any) {
      console.error("Failed to fetch unit:", error)
      throw error
    }
  },

  /**
   * Create a new unit
   */
  async create(data: Partial<ProductUnit> & { product: string }): Promise<ProductUnit> {
    const payload = {
      product: data.product,
      ...transformUnitToBackend(data),
    }

    try {
      const result = await api.post<any>(apiEndpoints.units.create, payload)
      return transformUnit(result)
    } catch (error: any) {
      console.error("Failed to create unit:", { payload, error: error.message })
      throw error
    }
  },

  /**
   * Update an existing unit
   */
  async update(id: string, data: Partial<ProductUnit>): Promise<ProductUnit> {
    const payload = transformUnitToBackend(data)

    try {
      const result = await api.patch<any>(apiEndpoints.units.update(id), payload)
      return transformUnit(result)
    } catch (error: any) {
      console.error("Failed to update unit:", { id, payload, error: error.message })
      throw error
    }
  },

  /**
   * Delete a unit
   */
  async delete(id: string): Promise<void> {
    try {
      await api.delete(apiEndpoints.units.delete(id))
    } catch (error: any) {
      console.error("Failed to delete unit:", { id, error: error.message })
      throw error
    }
  },
}

