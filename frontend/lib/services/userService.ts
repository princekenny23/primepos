import { api, apiEndpoints } from "@/lib/api"
import type { User } from "@/lib/types"

export interface CreateUserData {
  email: string
  name: string
  username?: string
  phone?: string
  role?: "admin" | "manager" | "cashier" | "staff" | "driver"
  tenant: string  // Tenant ID
  outlet?: string  // Optional Outlet ID for Staff assignment
  password?: string  // Optional, will generate if not provided
}

export interface CreateUserResponse {
  user: User
  temporary_password?: string  // Only if password was auto-generated
}

export interface UpdateUserData {
  name?: string
  phone?: string
  role?: "admin" | "manager" | "cashier" | "staff" | "driver"
  password?: string
}

export const userService = {
  async create(data: CreateUserData): Promise<CreateUserResponse> {
    // Transform frontend data to backend format
    const backendData: any = {
      email: data.email,
      username: data.username || data.email.split('@')[0],
      name: data.name,
      phone: data.phone || "",
      role: data.role || "staff",
      tenant: data.tenant,
    }
    
    // Include outlet if provided (for Staff assignment)
    if (data.outlet) {
      backendData.outlet = data.outlet
    }
    
    // Only include password if provided (for manual creation)
    // Otherwise backend will generate one
    if (data.password) {
      backendData.password = data.password
    }
    
    const response = await api.post<any>(apiEndpoints.auth.createUser, backendData)
    
    // Transform backend response to frontend format
    const user = response.user ? {
      id: String(response.user.id),
      email: response.user.email,
      name: response.user.name || response.user.username || response.user.email.split('@')[0],
      role: response.user.role || 'admin',
      businessId: response.user.tenant ? String(response.user.tenant.id) : '',
      outletIds: [],
      createdAt: response.user.date_joined || new Date().toISOString(),
      is_saas_admin: response.user.is_saas_admin || false,
      tenant: response.user.tenant,
    } : null
    
    return {
      user: user as User,
      temporary_password: response.temporary_password,
    }
  },

  async update(id: string, data: UpdateUserData): Promise<User> {
    const response = await api.put<any>(apiEndpoints.auth.updateUser(id), data)
    
    // Transform backend response to frontend format
    return {
      id: String(response.id),
      email: response.email,
      name: response.name || response.username || response.email.split('@')[0],
      role: response.role || 'admin',
      businessId: response.tenant ? String(response.tenant.id) : '',
      outletIds: [],
      createdAt: response.date_joined || new Date().toISOString(),
      is_saas_admin: response.is_saas_admin || false,
      tenant: response.tenant,
    } as User
  },

  async delete(id: string): Promise<void> {
    await api.delete(apiEndpoints.auth.deleteUser(id))
  },
}

