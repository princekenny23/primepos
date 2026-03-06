import { api, apiEndpoints } from "@/lib/api"

export interface Till {
  id: string
  name: string
  outlet: {
    id: string
    name: string
    address?: string
    phone?: string
    email?: string
    is_active?: boolean
  } | string
  outlet_id?: number
  tenant?: string | number
  tenant_id?: string | number
  is_active: boolean
  is_in_use: boolean
  created_at?: string
}

export interface TillFilters {
  outlet?: string
  is_active?: boolean
  is_in_use?: boolean
  search?: string
}

export const tillService = {
  async list(filters?: TillFilters): Promise<{ results: Till[]; count?: number }> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))
    if (filters?.is_in_use !== undefined) params.append("is_in_use", String(filters.is_in_use))
    if (filters?.search) params.append("search", filters.search)
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.tills.list}${query ? `?${query}` : ""}`)
    
    // Handle both paginated and non-paginated responses
    if (Array.isArray(response)) {
      return { results: response, count: response.length }
    }
    return {
      results: response.results || [],
      count: response.count || (response.results?.length || 0),
    }
  },

  async get(id: string): Promise<Till> {
    return api.get(apiEndpoints.tills.get(id))
  },

  async create(data: Partial<Till>): Promise<Till> {
    const backendData: any = {
      name: data.name,
      outlet_id: data.outlet_id || (typeof data.outlet === 'object' ? parseInt(data.outlet.id) : parseInt(data.outlet as string)),
      is_active: data.is_active !== undefined ? data.is_active : true,
    }
    if (data.tenant_id !== undefined) {
      backendData.tenant_id = data.tenant_id
    } else if (data.tenant !== undefined) {
      backendData.tenant_id = data.tenant
    }
    return api.post(apiEndpoints.tills.create, backendData)
  },

  async update(id: string, data: Partial<Till>): Promise<Till> {
    const backendData: any = {
      name: data.name,
      is_active: data.is_active,
    }
    if (data.tenant_id !== undefined) {
      backendData.tenant_id = data.tenant_id
    } else if (data.tenant !== undefined) {
      backendData.tenant_id = data.tenant
    }
    
    // Only include outlet_id if provided (for changing outlet)
    if (data.outlet_id !== undefined) {
      backendData.outlet_id = data.outlet_id
    } else if (data.outlet) {
      backendData.outlet_id = typeof data.outlet === 'object' 
        ? parseInt(data.outlet.id) 
        : parseInt(data.outlet as string)
    }
    
    return api.put(apiEndpoints.tills.update(id), backendData)
  },

  async delete(id: string): Promise<void> {
    return api.delete(apiEndpoints.tills.delete(id))
  },

  async getByOutlet(outletId: string): Promise<Till[]> {
    const response = await this.list({ outlet: outletId })
    return response.results
  },

  async getAvailable(outletId: string): Promise<Till[]> {
    const params = new URLSearchParams()
    params.append("outlet_id", outletId)
    const response = await api.get<Till[]>(`${apiEndpoints.tills.available}?${params.toString()}`)
    return Array.isArray(response) ? response : []
  },
}

