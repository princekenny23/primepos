/**
 * API Configuration and Helper Functions
 * 
 * This file provides utilities for making API calls.
 * Update NEXT_PUBLIC_API_URL in your .env file to point to your backend.
 * 
 * For local development: Create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
 * For production: Update .env.production with your production backend URL
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://primepos-5mf6.onrender.com/api/v1"
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://primepos-5mf6.onrender.com/api/v1"

// Log the API configuration on startup (only in development)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("🔧 API Configuration:", {
    baseURL: API_BASE_URL,
    environment: process.env.NODE_ENV,
    useRealAPI: process.env.NEXT_PUBLIC_USE_REAL_API,
  })
}

export const apiConfig = {
  baseURL: API_BASE_URL,
  base: API_BASE,
  timeout: 30000, // 30 seconds
  fallbackURL: "http://localhost:8000/api/v1", // Fallback to local backend
}

/**
 * API Client for making HTTP requests
 * Ready for backend integration
 * Supports automatic fallback to localhost in development when primary URL fails
 */
export class ApiClient {
  private baseURL: string
  private timeout: number
  private attemptedFallback: boolean = false
  private lastFallbackAttempt: number = 0
  private readonly fallbackRetryInterval = 60000 // Retry primary URL after 60 seconds

  constructor(baseURL: string = apiConfig.baseURL, timeout: number = apiConfig.timeout) {
    this.baseURL = baseURL
    this.timeout = timeout
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    }
    
    // Log request (without sensitive data)
    if (endpoint.includes('login')) {
      console.log("API Request:", { url, method: options.method || 'GET' })
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
    
    // Add outlet ID header if available (for outlet data isolation)
    if (typeof window !== "undefined") {
      try {
        // Try to get current outlet from localStorage (set by tenant context)
        const outletId = localStorage.getItem("currentOutletId")
        if (outletId) {
          config.headers = {
            ...config.headers,
            "X-Outlet-ID": outletId,
          }
        }
      } catch (error) {
        // Silently fail if localStorage is not available
      }
    }

    try {
      // Support environments where AbortController may be missing (older Node/browsers)
      const AbortCtrl: typeof AbortController | null =
        typeof AbortController !== "undefined" ? AbortController : null

      const controller = AbortCtrl ? new AbortCtrl() : null
      const timeoutId = controller ? setTimeout(() => controller.abort(), this.timeout) : null

      const response = await fetch(url, {
        ...config,
        signal: controller ? controller.signal : undefined,
      })

      if (timeoutId) clearTimeout(timeoutId)

      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && retry && typeof window !== "undefined") {
        const refreshToken = localStorage.getItem("refreshToken")
        if (refreshToken) {
          try {
            const refreshResponse = await fetch(`${this.baseURL}/auth/refresh/`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh: refreshToken }),
            })
            
            if (refreshResponse.ok) {
              const { access } = await refreshResponse.json()
              localStorage.setItem("authToken", access)
              
              // Retry original request with new token
              config.headers = {
                ...config.headers,
                Authorization: `Bearer ${access}`,
              }
              return this.request<T>(endpoint, { ...options, headers: config.headers }, false)
            } else {
              // Refresh token is invalid, clear tokens and redirect to login
              localStorage.removeItem("authToken")
              localStorage.removeItem("refreshToken")
              if (typeof window !== "undefined" && !window.location.pathname.includes("/auth/login")) {
                window.location.href = "/auth/login"
              }
              throw new Error("Session expired. Please login again.")
            }
          } catch (refreshError) {
            // Refresh failed, clear tokens and redirect to login
            localStorage.removeItem("authToken")
            localStorage.removeItem("refreshToken")
            if (typeof window !== "undefined" && !window.location.pathname.includes("/auth/login")) {
              window.location.href = "/auth/login"
            }
            throw new Error("Session expired. Please login again.")
          }
        } else {
          // No refresh token available - clear tokens and redirect to login
          localStorage.removeItem("authToken")
          localStorage.removeItem("refreshToken")
          if (typeof window !== "undefined" && !window.location.pathname.includes("/auth/login")) {
            window.location.href = "/auth/login"
          }
          throw new Error("Authentication required. Please login again.")
        }
      }

      if (!response.ok) {
        let errorData: any = {}
        try {
          const text = await response.text()
          if (text) {
            errorData = JSON.parse(text)
          }
        } catch (e) {
          // If response is not JSON, use empty object
          errorData = {}
        }
        
        // Try to extract a meaningful error message
        let errorMessage = errorData.detail || errorData.message || errorData.error
        
        // If no detail, try to get field-specific errors
        if (!errorMessage && typeof errorData === 'object') {
          // Check for common field errors
          const fieldErrors = ['email', 'password', 'name', 'phone', 'role', 'outlet_ids']
          for (const field of fieldErrors) {
            if (errorData[field]) {
              const fieldError = errorData[field]
              errorMessage = Array.isArray(fieldError) ? fieldError[0] : fieldError
              break
            }
          }
          
          // If still no message, get first error from any field
          if (!errorMessage) {
            const firstKey = Object.keys(errorData)[0]
            if (firstKey) {
              const firstError = errorData[firstKey]
              errorMessage = Array.isArray(firstError) ? firstError[0] : firstError
            }
          }
        }
        
        // Fallback to string or default message
        if (!errorMessage) {
          errorMessage = (typeof errorData === 'string' ? errorData : null) ||
                         `API Error: ${response.status} ${response.statusText}`
        }
        
        // Handle authentication errors specifically
        if (response.status === 401) {
          const authErrorMessage = errorMessage.toLowerCase()
          if (authErrorMessage.includes("authentication credentials were not provided") || 
              authErrorMessage.includes("not authenticated") ||
              authErrorMessage.includes("invalid token")) {
            // Clear tokens and redirect to login if in browser
            if (typeof window !== "undefined") {
              localStorage.removeItem("authToken")
              localStorage.removeItem("refreshToken")
              // Only redirect if not already on login page
              if (!window.location.pathname.includes("/auth/login")) {
                window.location.href = "/auth/login"
              }
            }
            errorMessage = "Your session has expired. Please login again."
          }
        }
        
        // Log full error details for debugging
        console.error("API Error:", {
          status: response.status,
          statusText: response.statusText,
          endpoint: url,
          method: options.method || 'GET',
          error: errorMessage,
          errorData: errorData,
          // Don't log request body (may contain credentials)
        })
        
        const apiError = new Error(errorMessage) as any
        apiError.status = response.status
        apiError.data = errorData
        throw apiError
      }

      // Handle 204 No Content (common for DELETE requests)
      if (response.status === 204) {
        return null as T
      }

      // Check if response has content before parsing JSON
      const contentType = response.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        return await response.json()
      }
      
      // Return empty object for responses without JSON content
      return {} as T
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific error types
        let errorMsg = ""
        
        // Network errors (Failed to fetch) - Try fallback in development
        if (error.message === "Failed to fetch" || error.name === "TypeError") {
          // Check if enough time has passed to retry primary URL
          const now = Date.now()
          if (this.attemptedFallback && (now - this.lastFallbackAttempt) > this.fallbackRetryInterval) {
            console.log("🔄 Retry interval elapsed, resetting to primary URL...")
            this.attemptedFallback = false
            this.baseURL = apiConfig.baseURL
          }
          
          // In development, try fallback to localhost if primary URL failed
          if (
            process.env.NODE_ENV === "development" &&
            !this.attemptedFallback &&
            this.baseURL !== apiConfig.fallbackURL &&
            typeof window !== "undefined"
          ) {
            console.warn("⚠️ Primary backend URL failed, attempting fallback to localhost...")
            this.attemptedFallback = true
            this.lastFallbackAttempt = Date.now()
            this.baseURL = apiConfig.fallbackURL
            
            try {
              // Retry the request with fallback URL
              return await this.request<T>(endpoint, options, retry)
            } catch (fallbackError) {
              console.error("❌ Fallback to localhost also failed")
              // Continue to show error message below
            }
          }
          
          errorMsg = "Unable to connect to the server. Please check if the backend server is running and accessible."
          console.error("Network error - Backend may be down:", {
            endpoint: url,
            baseURL: this.baseURL,
            message: "Check if backend server is running at " + this.baseURL,
            troubleshooting: process.env.NODE_ENV === "development" 
              ? "Run: cd backend && python manage.py runserver"
              : "Verify production backend is deployed and accessible",
          })
        }
        // Timeout errors
        else if (error.name === "AbortError" || error.message.includes("timeout")) {
          errorMsg = "Request timed out. The server may be slow or unavailable."
          console.error("Request timeout:", {
            endpoint: url,
            timeout: this.timeout,
          })
        }
        // Other errors
        else {
          const isLoginEndpoint = endpoint.includes('login')
          // Check if this is already a formatted authentication error
          const isAuthError = error.message.includes("Session expired") || 
                             error.message.includes("Authentication required") ||
                             error.message.includes("Please login again")
          
          if (isLoginEndpoint) {
            errorMsg = "Login failed. Please check your credentials."
          } else if (isAuthError) {
            // Preserve authentication error messages as-is
            errorMsg = error.message
          } else {
            errorMsg = `API Request failed: ${error.message}`
          }
        }
        
        console.error("Request error:", {
          endpoint: url,
          baseURL: this.baseURL,
          message: error.message,
          errorName: error.name,
          // Don't log full error stack or request data
        })
        
        throw new Error(errorMsg)
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

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
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
    login: "/auth/login/",
    register: "/auth/register/",
    logout: "/auth/logout/",
    refresh: "/auth/refresh/",
    me: "/auth/me/",
    createUser: "/auth/users/create/",
    updateUser: (id: string) => `/auth/users/${id}/`,
    deleteUser: (id: string) => `/auth/users/${id}/delete/`,
  },
  // Tenants
  tenants: {
    list: "/tenants/",
    get: (id: string) => `/tenants/${id}/`,
    create: "/tenants/",
    update: (id: string) => `/tenants/${id}/`,
  },
  // Outlets
  outlets: {
    list: "/outlets/",
    get: (id: string) => `/outlets/${id}/`,
    create: "/outlets/",
    update: (id: string) => `/outlets/${id}/`,
    delete: (id: string) => `/outlets/${id}/`,
  },
  // Printers registered to outlets
  printers: {
    list: "/printers/",
    get: (id: string) => `/printers/${id}/`,
    create: "/printers/",
    update: (id: string) => `/printers/${id}/`,
    delete: (id: string) => `/printers/${id}/`,
  },
  // Tills
  tills: {
    list: "/tills/",
    get: (id: string) => `/tills/${id}/`,
    create: "/tills/",
    update: (id: string) => `/tills/${id}/`,
    delete: (id: string) => `/tills/${id}/`,
    available: "/tills/available/",
  },
  // Tables (Restaurant)
  tables: {
    list: "/tables/",
    get: (id: string) => `/tables/${id}/`,
    create: "/tables/",
    update: (id: string) => `/tables/${id}/`,
    delete: (id: string) => `/tables/${id}/`,
  },
  // Kitchen Orders (Restaurant)
  kitchenOrders: {
    list: "/restaurant/kitchen-orders/",
    get: (id: string) => `/restaurant/kitchen-orders/${id}/`,
    create: "/restaurant/kitchen-orders/",
    update: (id: string) => `/restaurant/kitchen-orders/${id}/`,
    delete: (id: string) => `/restaurant/kitchen-orders/${id}/`,
  },
  // Products
  products: {
    list: "/products/",
    get: (id: string) => `/products/${id}/`,
    create: "/products/",
    update: (id: string) => `/products/${id}/`,
    delete: (id: string) => `/products/${id}/`,    lookup: "/products/lookup/",  },
  // Variations
  variations: {
    list: "/variations/",
    get: (id: string) => `/variations/${id}/`,
    create: "/variations/",
    update: (id: string) => `/variations/${id}/`,
    delete: (id: string) => `/variations/${id}/`,
    bulkUpdateStock: "/variations/bulk_update_stock/",
  },
  // Product Units
  units: {
    list: "/units/",
    get: (id: string) => `/units/${id}/`,
    create: "/units/",
    update: (id: string) => `/units/${id}/`,
    delete: (id: string) => `/units/${id}/`,
  },
  // Location Stock
  locationStock: {
    list: "/inventory/location-stock/",
    get: (id: string) => `/inventory/location-stock/${id}/`,
    create: "/inventory/location-stock/",
    update: (id: string) => `/inventory/location-stock/${id}/`,
    delete: (id: string) => `/inventory/location-stock/${id}/`,
    bulkUpdate: "/inventory/location-stock/bulk_update/",
  },
  // Categories
  categories: {
    list: "/categories/",
    get: (id: string) => `/categories/${id}/`,
    create: "/categories/",
    update: (id: string) => `/categories/${id}/`,
    delete: (id: string) => `/categories/${id}/`,
  },
  // Sales
  sales: {
    list: "/sales/",
    get: (id: string) => `/sales/${id}/`,
    create: "/sales/",
    update: (id: string) => `/sales/${id}/`,
    refund: (id: string) => `/sales/${id}/refund/`,
    stats: "/sales/stats/",
  },
  // Receipts
  receipts: {
    list: "/receipts/",
    get: (id: string) => `/receipts/${id}/`,
    byNumber: (receiptNumber: string) => `/receipts/by-number/${receiptNumber}/`,
    bySale: (saleId: string) => `/receipts/by-sale/${saleId}/`,
    download: (id: string) => `/receipts/${id}/download/`,
    regenerate: (id: string) => `/receipts/${id}/regenerate/`,
  },
  // Customers
  customers: {
    list: "/customers/",
    get: (id: string) => `/customers/${id}/`,
    create: "/customers/",
    update: (id: string) => `/customers/${id}/`,
    adjustPoints: (id: string) => `/customers/${id}/adjust_points/`,
    creditSummary: (id: string) => `/customers/${id}/credit_summary/`,
    adjustCredit: (id: string) => `/customers/${id}/adjust_credit/`,
  },
  // Credit Payments
  creditPayments: {
    list: "/credit-payments/",
    get: (id: string) => `/credit-payments/${id}/`,
    create: "/credit-payments/",
  },
  // Staff
  staff: {
    list: "/staff/",
    get: (id: string) => `/staff/${id}/`,
    create: "/staff/",
    update: (id: string) => `/staff/${id}/`,
    delete: (id: string) => `/staff/${id}/`,
  },
  // Roles
  roles: {
    list: "/roles/",
    get: (id: string) => `/roles/${id}/`,
    create: "/roles/",
    update: (id: string) => `/roles/${id}/`,
    delete: (id: string) => `/roles/${id}/`,
  },
  // Suppliers
  suppliers: {
    list: "/suppliers/",
    get: (id: string) => `/suppliers/${id}/`,
    create: "/suppliers/",
    update: (id: string) => `/suppliers/${id}/`,
    delete: (id: string) => `/suppliers/${id}/`,
  },
  // Product Suppliers (Product-Supplier relationships)
  productSuppliers: {
    list: "/product-suppliers/",
    get: (id: string) => `/product-suppliers/${id}/`,
    create: "/product-suppliers/",
    update: (id: string) => `/product-suppliers/${id}/`,
    delete: (id: string) => `/product-suppliers/${id}/`,
  },
  // Auto Purchase Order Settings
  autoPOSettings: {
    list: "/auto-po-settings/",
    get: (id: string) => `/auto-po-settings/${id}/`,
    update: (id: string) => `/auto-po-settings/${id}/`,
    checkLowStock: "/auto-po-settings/check_low_stock/",
  },
  // Purchase Orders
  purchaseOrders: {
    list: "/purchase-orders/",
    get: (id: string) => `/purchase-orders/${id}/`,
    create: "/purchase-orders/",
    update: (id: string) => `/purchase-orders/${id}/`,
    delete: (id: string) => `/purchase-orders/${id}/`,
    approve: (id: string) => `/purchase-orders/${id}/approve/`,
    receive: (id: string) => `/purchase-orders/${id}/receive/`,
    itemsNeedingSupplier: "/purchase-orders/items_needing_supplier/",
    assignSupplierToItem: (id: string) => `/purchase-orders/${id}/assign_supplier_to_item/`,
  },
  // Supplier Invoices
  supplierInvoices: {
    list: "/supplier-invoices/",
    get: (id: string) => `/supplier-invoices/${id}/`,
    create: "/supplier-invoices/",
    update: (id: string) => `/supplier-invoices/${id}/`,
    delete: (id: string) => `/supplier-invoices/${id}/`,
    recordPayment: (id: string) => `/supplier-invoices/${id}/record_payment/`,
  },
  // Purchase Returns
  purchaseReturns: {
    list: "/purchase-returns/",
    get: (id: string) => `/purchase-returns/${id}/`,
    create: "/purchase-returns/",
    update: (id: string) => `/purchase-returns/${id}/`,
    delete: (id: string) => `/purchase-returns/${id}/`,
    approve: (id: string) => `/purchase-returns/${id}/approve/`,
    complete: (id: string) => `/purchase-returns/${id}/complete/`,
  },
  // Inventory
  inventory: {
    movements: "/inventory/movements/",
    adjust: "/inventory/adjust/",
    transfer: "/inventory/transfer/",
    receive: "/inventory/receive/",
    stockTakes: "/inventory/stock-take/",
    stockTakeItems: (id: string) => `/inventory/stock-take/${id}/items/`,
    stockTakeComplete: (id: string) => `/inventory/stock-take/${id}/complete/`,
  },
  // Shifts
  shifts: {
    list: "/shifts/",
    start: "/shifts/start/",
    active: "/shifts/active/",
    current: "/shifts/current/",
    history: "/shifts/history/",
    check: "/shifts/check/",
    close: (id: string) => `/shifts/${id}/close/`,
  },
  // Reports
  reports: {
    sales: "/reports/sales/",
    products: "/reports/products/",
    customers: "/reports/customers/",
    profitLoss: "/reports/profit-loss/",
    stockMovement: "/reports/stock-movement/",
    expenses: "/reports/expenses/",
    inventoryValuation: "/reports/inventory-valuation/",
    dailySales: "/reports/daily-sales/",
    topProducts: "/reports/top-products/",
    cashSummary: "/reports/cash-summary/",
    shiftSummary: "/reports/shift-summary/",
  },
  // Admin
  admin: {
    tenants: "/admin/tenants/",
    analytics: "/admin/analytics/",
  },
  // Activity Logs
  activityLogs: {
    list: "/activity-logs/",
    get: (id: string) => `/activity-logs/${id}/`,
    summary: "/activity-logs/summary/",
  },
  // Notifications
  notifications: {
    list: "/notifications/",
    get: (id: string) => `/notifications/${id}/`,
    markRead: (id: string) => `/notifications/${id}/mark_read/`,
    markAllRead: "/notifications/mark_all_read/",
    unreadCount: "/notifications/unread_count/",
    summary: "/notifications/summary/",
  },
  
  
  // Notification Preferences
  notificationPreferences: {
    list: "/notification-preferences/",
    get: (id: string) => `/notification-preferences/${id}/`,
    create: "/notification-preferences/",
    update: (id: string) => `/notification-preferences/${id}/`,
    myPreferences: "/notification-preferences/my-preferences/",
  },
  // Price Lists (Retail/Wholesale)
  priceLists: {
    list: "/price-lists/",
    get: (id: string) => `/price-lists/${id}/`,
    create: "/price-lists/",
    update: (id: string) => `/price-lists/${id}/`,
    delete: (id: string) => `/price-lists/${id}/`,
  },
  // Customer Groups (Retail/Wholesale)
  customerGroups: {
    list: "/customer-groups/",
    get: (id: string) => `/customer-groups/${id}/`,
    create: "/customer-groups/",
    update: (id: string) => `/customer-groups/${id}/`,
    delete: (id: string) => `/customer-groups/${id}/`,
  },
  // Quotations
  quotations: {
    list: "/quotations/",
    get: (id: string) => `/quotations/${id}/`,
    create: "/quotations/",
    update: (id: string) => `/quotations/${id}/`,
    delete: (id: string) => `/quotations/${id}/`,
    send: (id: string) => `/quotations/${id}/send/`,
    convertToSale: (id: string) => `/quotations/${id}/convert-to-sale/`,
  },
}

