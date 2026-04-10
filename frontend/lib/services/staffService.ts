import { api, apiEndpoints } from "@/lib/api"

export interface Staff {
  id: string
  user: {
    id: string
    name: string
    email: string
    phone?: string
    role: string
  }
  tenant: string
  outlets: Array<{
    id: string
    name: string
    address?: string
    phone?: string
    email?: string
    is_active?: boolean
  }>
  outlet_ids?: number[] // For write operations
  outlet_roles?: Array<{
    outlet_id: number
    role_id: number | null
  }>
  outlet_role_assignments?: Array<{
    outlet_id: number
    outlet_name?: string
    role_id: number | null
    role_name?: string
  }>
  role?: {
    id: string
    name: string
    description?: string
  }
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  tenant: string
  name: string
  description?: string
  can_sales: boolean
  can_inventory: boolean
  can_products: boolean
  can_customers: boolean
  can_reports: boolean
  can_staff: boolean
  can_settings: boolean
  can_dashboard: boolean
  can_distribution: boolean
  can_storefront: boolean
  can_switch_outlet: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StaffFilters {
  tenant?: string
  outlet?: string
  role?: string
  is_active?: boolean
  search?: string
}

export const staffService = {
  async list(filters?: StaffFilters): Promise<{ results: Staff[]; count?: number }> {
    const params = new URLSearchParams()
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.role) params.append("role", filters.role)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))
    if (filters?.search) params.append("search", filters.search)
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.staff.list}${query ? `?${query}` : ""}`)
    return {
      results: Array.isArray(response) ? response : (response.results || []),
      count: response.count || (Array.isArray(response) ? response.length : 0),
    }
  },

  async get(id: string): Promise<Staff> {
    return api.get(apiEndpoints.staff.get(id))
  },

  async create(data: Partial<Staff>): Promise<Staff> {
    return api.post(apiEndpoints.staff.create, data)
  },

  async update(id: string, data: Partial<Staff>): Promise<Staff> {
    return api.put(apiEndpoints.staff.update(id), data)
  },

  async delete(id: string): Promise<void> {
    return api.delete(apiEndpoints.staff.delete(id))
  },
}

export const roleService = {
  async list(filters?: { tenant?: string; is_active?: boolean }): Promise<{ results: Role[]; count?: number }> {
    const params = new URLSearchParams()
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.roles.list}${query ? `?${query}` : ""}`)
    return {
      results: Array.isArray(response) ? response : (response.results || []),
      count: response.count || (Array.isArray(response) ? response.length : 0),
    }
  },

  async get(id: string): Promise<Role> {
    return api.get(apiEndpoints.roles.get(id))
  },

  async create(data: Partial<Role>): Promise<Role> {
    return api.post(apiEndpoints.roles.create, data)
  },

  async update(id: string, data: Partial<Role>): Promise<Role> {
    return api.put(apiEndpoints.roles.update(id), data)
  },

  async delete(id: string): Promise<void> {
    return api.delete(apiEndpoints.roles.delete(id))
  },
}

