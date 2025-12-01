/**
 * API Configuration and Helper Functions
 * 
 * This file provides utilities for making API calls.
 * Update NEXT_PUBLIC_API_URL in your .env file to point to your backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"

export const apiConfig = {
  baseURL: API_BASE_URL,
  base: API_BASE,
  timeout: 30000, // 30 seconds
}

/**
 * API Client for making HTTP requests
 * Ready for backend integration
 */
export class ApiClient {
  private baseURL: string
  private timeout: number

  constructor(baseURL: string = apiConfig.baseURL, timeout: number = apiConfig.timeout) {
    this.baseURL = baseURL
    this.timeout = timeout
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    }

    // Add authentication token if available
    const token = typeof window !== "undefined" 
      ? localStorage.getItem("authToken") 
      : null
    
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`API Request failed: ${error.message}`)
      }
      throw error
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" })
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" })
  }
}

// Export a default API client instance
export const api = new ApiClient()

// Example API endpoints (update when backend is ready)
export const apiEndpoints = {
  // Authentication
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
  },
  // Tenants
  tenants: {
    list: "/tenants",
    get: (id: string) => `/tenants/${id}`,
    create: "/tenants",
    update: (id: string) => `/tenants/${id}`,
  },
  // Outlets
  outlets: {
    list: "/outlets",
    get: (id: string) => `/outlets/${id}`,
    create: "/outlets",
    update: (id: string) => `/outlets/${id}`,
  },
  // Products
  products: {
    list: "/products",
    get: (id: string) => `/products/${id}`,
    create: "/products",
    update: (id: string) => `/products/${id}`,
    delete: (id: string) => `/products/${id}`,
  },
  // Sales
  sales: {
    list: "/sales",
    get: (id: string) => `/sales/${id}`,
    create: "/sales",
    update: (id: string) => `/sales/${id}`,
  },
  // Customers
  customers: {
    list: "/customers",
    get: (id: string) => `/customers/${id}`,
    create: "/customers",
    update: (id: string) => `/customers/${id}`,
  },
  // Inventory
  inventory: {
    list: "/inventory",
    adjust: "/inventory/adjust",
    transfer: "/inventory/transfer",
  },
}

