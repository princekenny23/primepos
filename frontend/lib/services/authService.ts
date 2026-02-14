import { api, apiEndpoints } from "@/lib/api"
import type { User } from "@/lib/types"

// Map backend tenant type to frontend business type
const mapBackendTypeToFrontend = (type: string | undefined): string => {
  if (!type) return "wholesale and retail"
  if (type === "retail") return "wholesale and retail"
  return type
}

const normalizeRole = (value?: string, isSaasAdmin?: boolean): string => {
  if (isSaasAdmin) return "admin"
  if (!value) return "staff"
  const lower = value.toLowerCase()
  if (lower.includes("admin")) return "admin"
  if (lower.includes("manager")) return "manager"
  if (lower.includes("cashier")) return "cashier"
  if (lower.includes("staff")) return "staff"
  return "staff"
}

export interface LoginResponse {
  access: string
  refresh: string
  user: User | any  // Allow any to handle backend response structure
}

export interface RegisterData {
  email: string
  username: string
  name: string
  password: string
  password_confirm: string
  phone?: string
  role?: string
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      console.log("Attempting login to:", apiEndpoints.auth.login)
      const response = await api.post<LoginResponse>(apiEndpoints.auth.login, {
        email,
        password,
      })
      
      console.log("Login response received:", { 
        hasAccess: !!response.access, 
        hasRefresh: !!response.refresh,
        hasUser: !!response.user 
      })
      
      // Store tokens
      if (typeof window !== "undefined") {
        localStorage.setItem("authToken", response.access)
        localStorage.setItem("refreshToken", response.refresh)
        console.log("Tokens stored in localStorage")
      }
      
      const isSaasAdmin = response.user?.is_saas_admin || false
      const backendRole =
        response.user?.effective_role ||
        response.user?.role ||
        response.user?.staff_role?.name
      const resolvedRole = normalizeRole(backendRole, isSaasAdmin)

      // Transform backend user data to match frontend User type
      const user = response.user ? {
        id: String(response.user.id),
        email: response.user.email,
        name: response.user.name || response.user.username || response.user.email.split('@')[0],
        role: resolvedRole,
        effective_role: response.user.effective_role || response.user.role || resolvedRole,
        permissions: response.user.permissions || undefined,
        staff_role: response.user.staff_role || undefined,
        businessId: response.user.tenant ? String(response.user.tenant.id) : '',
        outletIds: [],
        createdAt: response.user.date_joined || new Date().toISOString(),
        is_saas_admin: isSaasAdmin,
        tenant: response.user.tenant ? {
          ...response.user.tenant,
          type: mapBackendTypeToFrontend(response.user.tenant.type),
        } : undefined,
      } : null
      
      console.log("User transformed:", { id: user?.id, email: user?.email, is_saas_admin: user?.is_saas_admin })
      
      return {
        ...response,
        user: user as any
      }
    } catch (error: any) {
      console.error("Login API error details:", {
        message: error.message,
        stack: error.stack,
        // Don't log credentials
      })
      throw new Error(error.message || "Login failed. Please check your credentials and ensure the backend server is running.")
    }
  },

  async register(data: RegisterData): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>(apiEndpoints.auth.register, data)
    
    // Store tokens
    if (typeof window !== "undefined") {
      localStorage.setItem("authToken", response.access)
      localStorage.setItem("refreshToken", response.refresh)
    }
    
    return response
  },

  async refreshToken(): Promise<{ access: string }> {
    const refreshToken = typeof window !== "undefined" 
      ? localStorage.getItem("refreshToken") 
      : null
    
    if (!refreshToken) {
      throw new Error("No refresh token available")
    }
    
    const response = await api.post<{ access: string }>(apiEndpoints.auth.refresh, {
      refresh: refreshToken,
    })
    
    // Update access token
    if (typeof window !== "undefined") {
      localStorage.setItem("authToken", response.access)
    }
    
    return response
  },

  async logout(): Promise<void> {
    try {
      await api.post(apiEndpoints.auth.logout, {})
    } catch (error) {
      // Continue with logout even if API call fails
      console.error("Logout API error:", error)
    } finally {
      // Clear tokens
      if (typeof window !== "undefined") {
        localStorage.removeItem("authToken")
        localStorage.removeItem("refreshToken")
      }
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await api.get<any>(apiEndpoints.auth.me)
    const isSaasAdmin = response.is_saas_admin || false
    const backendRole = response.effective_role || response.role || response?.staff_role?.name
    const resolvedRole = normalizeRole(backendRole, isSaasAdmin)
    // Transform backend user data to match frontend User type
    return {
      id: String(response.id),
      email: response.email,
      name: response.name || response.username || response.email.split('@')[0],
      role: resolvedRole,
      effective_role: response.effective_role || response.role || resolvedRole,
      permissions: response.permissions || undefined,
      staff_role: response.staff_role || undefined,
      businessId: response.tenant ? String(response.tenant.id) : '',
      outletIds: [],
      createdAt: response.date_joined || new Date().toISOString(),
      is_saas_admin: isSaasAdmin,
      tenant: response.tenant ? {
        ...response.tenant,
        type: mapBackendTypeToFrontend(response.tenant.type),
      } : undefined,
    } as User
  },
}

