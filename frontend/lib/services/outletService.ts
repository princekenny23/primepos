import { api, apiEndpoints } from "@/lib/api"
import type { Outlet } from "@/lib/types"

export interface Till {
  id: string
  name: string
  outlet: string
  is_active: boolean
  is_in_use: boolean
}

export const outletService = {
  async list(): Promise<Outlet[]> {
    const response = await api.get<{ results: Outlet[] } | Outlet[]>(apiEndpoints.outlets.list)
    // Handle both paginated and non-paginated responses
    const outlets = Array.isArray(response) ? response : (response.results || [])
    
    // Transform backend response to frontend format
    return outlets.map((outlet: any) => {
      const tenantIdValue = outlet.tenant 
        ? (typeof outlet.tenant === 'object' ? String(outlet.tenant.id) : String(outlet.tenant))
        : String(outlet.businessId || "")
      
      return {
        id: String(outlet.id),
        businessId: tenantIdValue,
        name: outlet.name,
        address: outlet.address || "",
        phone: outlet.phone || "",
        email: outlet.email || "",
        isActive: outlet.is_active !== undefined ? outlet.is_active : (outlet.isActive !== undefined ? outlet.isActive : true),
        createdAt: outlet.created_at || outlet.createdAt || new Date().toISOString(),
      } as Outlet
    })
  },

  async get(id: string): Promise<Outlet> {
    const response = await api.get<any>(apiEndpoints.outlets.get(id))
    
    // Transform backend response to frontend format
    const tenantIdValue = response.tenant 
      ? (typeof response.tenant === 'object' ? String(response.tenant.id) : String(response.tenant))
      : String(response.businessId || "")
    
    return {
      id: String(response.id),
      businessId: tenantIdValue,
      name: response.name,
      address: response.address || "",
      phone: response.phone || "",
      email: response.email || "",
      isActive: response.is_active !== undefined ? response.is_active : (response.isActive !== undefined ? response.isActive : true),
      createdAt: response.created_at || response.createdAt || new Date().toISOString(),
    } as Outlet
  },

  async create(data: Partial<Outlet>): Promise<Outlet> {
    // Transform frontend data to backend format
    // Backend expects tenant as FK (integer ID or object)
    const tenantId = data.tenant || data.businessId
    
    if (!tenantId) {
      throw new Error("Business ID (tenant) is required to create an outlet.")
    }
    
    // Ensure tenant ID is a valid number
    let tenantIdNum: number
    try {
      tenantIdNum = typeof tenantId === 'string' ? parseInt(tenantId, 10) : tenantId
      if (isNaN(tenantIdNum) || tenantIdNum <= 0) {
        throw new Error("Invalid business ID. Please ensure you have completed business setup.")
      }
    } catch (e) {
      throw new Error("Invalid business ID format. Please ensure you have completed business setup.")
    }
    
    const backendData: any = {
      tenant: tenantIdNum,
      name: data.name?.trim() || "",
      address: data.address?.trim() || "",
      phone: data.phone?.trim() || "",
      email: data.email?.trim() || "",
      is_active: data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true),
    }
    
    // Validate required fields
    if (!backendData.name) {
      throw new Error("Outlet name is required.")
    }
    
    try {
      const response = await api.post<any>(apiEndpoints.outlets.create, backendData)
      
      if (!response || !response.id) {
        throw new Error("Invalid response from server. Outlet may not have been created.")
      }
      
      // Transform backend response to frontend format
      const tenantIdValue = response.tenant 
        ? (typeof response.tenant === 'object' ? String(response.tenant.id) : String(response.tenant))
        : String(response.businessId || tenantIdNum)
      
      return {
        id: String(response.id),
        businessId: tenantIdValue,
        name: response.name || backendData.name,
        address: response.address || "",
        phone: response.phone || "",
        email: response.email || "",
        isActive: response.is_active !== undefined ? response.is_active : (response.isActive !== undefined ? response.isActive : true),
        createdAt: response.created_at || response.createdAt || new Date().toISOString(),
      } as Outlet
    } catch (error: any) {
      // Re-throw with better error message
      if (error.message && !error.message.includes("API Request failed")) {
        throw error
      }
      // Extract error from API response
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to create outlet. Please check your connection and try again."
      throw new Error(errorMessage)
    }
  },

  async update(id: string, data: Partial<Outlet>): Promise<Outlet> {
    // Transform frontend data to backend format
    const backendData: any = {}
    
    // Only include fields that are provided (not undefined)
    if (data.name !== undefined) {
      backendData.name = data.name.trim()
    }
    if (data.address !== undefined) {
      backendData.address = data.address.trim() || ""
    }
    if (data.phone !== undefined) {
      backendData.phone = data.phone.trim() || ""
    }
    if (data.email !== undefined) {
      backendData.email = data.email.trim() || ""
    }
    // Always include is_active if provided, even if false
    if (data.isActive !== undefined) {
      backendData.is_active = data.isActive
    } else if (data.is_active !== undefined) {
      backendData.is_active = data.is_active
    }
    
    // Validate required fields if name is being updated
    if (backendData.name !== undefined && !backendData.name) {
      throw new Error("Outlet name cannot be empty.")
    }
    
    try {
      const response = await api.put<any>(apiEndpoints.outlets.update(id), backendData)
      
      // Transform backend response to frontend format
      const tenantIdValue = response.tenant 
        ? (typeof response.tenant === 'object' ? String(response.tenant.id) : String(response.tenant))
        : String(response.businessId || "")
      
      return {
        id: String(response.id),
        businessId: tenantIdValue,
        name: response.name || backendData.name || "",
        address: response.address || "",
        phone: response.phone || "",
        email: response.email || "",
        isActive: response.is_active !== undefined ? response.is_active : (response.isActive !== undefined ? response.isActive : true),
        createdAt: response.created_at || response.createdAt || new Date().toISOString(),
      } as Outlet
    } catch (error: any) {
      // Re-throw with better error message
      if (error.message && !error.message.includes("API Request failed")) {
        throw error
      }
      // Extract error from API response
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to update outlet. Please check your connection and try again."
      throw new Error(errorMessage)
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(apiEndpoints.outlets.delete(id))
    } catch (error: any) {
      // Extract error from API response
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to delete outlet. Please check your connection and try again."
      throw new Error(errorMessage)
    }
  },

  async getTills(outletId: string): Promise<Till[]> {
    const response = await api.get<any>(`${apiEndpoints.outlets.get(outletId)}tills/`)
    // Transform backend response to frontend format
    return Array.isArray(response) ? response : (response.results || []).map((till: any) => ({
      id: String(till.id),
      name: till.name,
      outlet: String(till.outlet?.id || till.outlet || ""),
      is_active: till.is_active !== undefined ? till.is_active : (till.isActive !== undefined ? till.isActive : true),
      is_in_use: till.is_in_use !== undefined ? till.is_in_use : (till.isInUse !== undefined ? till.isInUse : false),
    }))
  },
}

