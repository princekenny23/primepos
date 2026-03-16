import { api, apiEndpoints, getThrottleRemainingSeconds, isThrottleError } from "@/lib/api"

// Notification interfaces
export interface Notification {
  id: string | number
  tenant: string | number
  tenant_name: string
  user: string | number | null
  user_details: {
    id: number
    email: string
    name: string
  } | null
  type: 'sale' | 'stock' | 'payment' | 'customer' | 'staff' | 'report' | 'system' | 'shift' | 'inventory'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  title: string
  message: string
  resource_type: string | null
  resource_id: string | null
  link: string | null
  metadata: Record<string, any>
  read: boolean
  created_at: string
  updated_at: string
}

export interface NotificationFilters {
  type?: string
  priority?: string
  read?: boolean
  search?: string
  page?: number
  page_size?: number
  outlet_id?: string | number
}

export interface NotificationSummary {
  total: number
  unread: number
  read: number
  by_type: Record<string, number>
  by_priority: Record<string, number>
}

// Notification Preference interfaces
export interface NotificationPreference {
  id: string
  user: string
  user_details: {
    id: number
    email: string
    name: string
  } | null
  tenant: string
  tenant_name: string
  enable_sale_notifications: boolean
  enable_stock_notifications: boolean
  enable_staff_notifications: boolean
  enable_system_notifications: boolean
  enable_payment_notifications: boolean
  enable_customer_notifications: boolean
  enable_report_notifications: boolean
  enable_low_priority: boolean
  enable_normal_priority: boolean
  enable_high_priority: boolean
  enable_urgent_priority: boolean
  email_enabled: boolean
  sms_enabled: boolean
  push_enabled: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  created_at: string
  updated_at: string
}

/**
 * Unified Notification Service
 * Handles both notifications and notification preferences
 */
class NotificationService {
  // ========== Notification Methods ==========

  private isRetryableOfflineError(error: any): boolean {
    const errorMessage = error?.message || ''
    return errorMessage.includes('Unable to connect to the server') ||
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('Request timed out') ||
      error?.name === 'TypeError' ||
      error?.name === 'AbortError' ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ENOTFOUND'
  }

  private isThrottled(error: any): boolean {
    return isThrottleError(error) || getThrottleRemainingSeconds() > 0
  }
  
  async list(filters: NotificationFilters = {}): Promise<{ results: Notification[]; count: number }> {
    try {
      const params = new URLSearchParams()

      if (filters.type) params.append('type', filters.type)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.read !== undefined) params.append('read', String(filters.read))
      if (filters.search) params.append('search', filters.search)
      if (filters.page) params.append('page', String(filters.page))
      if (filters.page_size) params.append('page_size', String(filters.page_size))
      if (filters.outlet_id) params.append('outlet_id', String(filters.outlet_id))

      const query = params.toString()
      const response = await api.get<any>(`${apiEndpoints.notifications.list}${query ? `?${query}` : ""}`)

      // Handle both paginated and non-paginated responses
      if (Array.isArray(response)) {
        return { results: response, count: response.length }
      }
      return {
        results: response.results || [],
        count: response.count || (response.results?.length || 0),
      }
    } catch (error: any) {
      if (this.isThrottled(error)) {
        return { results: [], count: 0 }
      }

      if (this.isRetryableOfflineError(error)) {
        console.warn("Unable to connect to server for notifications list. Returning empty results.")
        return { results: [], count: 0 }
      }
      
      // For actual API errors (400, 401, 403, 500, etc.), still throw
      const apiErrorMessage = error?.response?.data?.detail || 
                              error?.data?.detail || 
                              error?.message || 
                              "Failed to fetch notifications"
      throw new Error(apiErrorMessage)
    }
  }

  async get(id: string | number): Promise<Notification> {
    try {
      return await api.get<Notification>(apiEndpoints.notifications.get(String(id)))
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to fetch notification"
      throw new Error(errorMessage)
    }
  }

  async markRead(id: string | number): Promise<Notification> {
    try {
      return await api.post<Notification>(apiEndpoints.notifications.markRead(String(id)))
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to mark notification as read"
      throw new Error(errorMessage)
    }
  }

  async markAllRead(): Promise<{ marked_read: number }> {
    try {
      return await api.post<{ marked_read: number }>(apiEndpoints.notifications.markAllRead)
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to mark all notifications as read"
      throw new Error(errorMessage)
    }
  }

  async getUnreadCount(): Promise<{ unread_count: number }> {
    try {
      return await api.get<{ unread_count: number }>(apiEndpoints.notifications.unreadCount)
    } catch (error: any) {
      if (this.isThrottled(error)) {
        return { unread_count: 0 }
      }

      if (this.isRetryableOfflineError(error)) {
        console.warn("Unable to connect to server for unread count. Returning default value.")
        return { unread_count: 0 }
      }
      
      // For actual API errors (400, 401, 403, 500, etc.), still throw
      const apiErrorMessage = error?.response?.data?.detail || 
                              error?.data?.detail || 
                              error?.message || 
                              "Failed to fetch unread count"
      throw new Error(apiErrorMessage)
    }
  }

  async getSummary(): Promise<NotificationSummary> {
    try {
      return await api.get<NotificationSummary>(apiEndpoints.notifications.summary)
    } catch (error: any) {
      if (this.isThrottled(error)) {
        return {
          total: 0,
          unread: 0,
          read: 0,
          by_type: {},
          by_priority: {}
        }
      }

      if (this.isRetryableOfflineError(error)) {
        console.warn("Unable to connect to server for notification summary. Returning default value.")
        return {
          total: 0,
          unread: 0,
          read: 0,
          by_type: {},
          by_priority: {}
        }
      }
      
      // For actual API errors (400, 401, 403, 500, etc.), still throw
      const apiErrorMessage = error?.response?.data?.detail || 
                              error?.data?.detail || 
                              error?.message || 
                              "Failed to fetch notification summary"
      throw new Error(apiErrorMessage)
    }
  }

  // ========== Notification Preference Methods ==========

  async getMyPreferences(): Promise<NotificationPreference> {
    try {
      return await api.get<NotificationPreference>(apiEndpoints.notificationPreferences.myPreferences)
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to fetch notification preferences"
      throw new Error(errorMessage)
    }
  }

  async getPreference(id: string): Promise<NotificationPreference> {
    try {
      return await api.get<NotificationPreference>(apiEndpoints.notificationPreferences.get(id))
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to fetch notification preference"
      throw new Error(errorMessage)
    }
  }

  async updatePreference(id: string, data: Partial<NotificationPreference>): Promise<NotificationPreference> {
    try {
      return await api.patch<NotificationPreference>(apiEndpoints.notificationPreferences.update(id), data)
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to update notification preferences"
      throw new Error(errorMessage)
    }
  }

  async createPreference(data: Partial<NotificationPreference>): Promise<NotificationPreference> {
    try {
      return await api.post<NotificationPreference>(apiEndpoints.notificationPreferences.create, data)
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to create notification preferences"
      throw new Error(errorMessage)
    }
  }

  async listPreferences(): Promise<NotificationPreference[]> {
    try {
      const response = await api.get<{ results: NotificationPreference[] } | NotificationPreference[]>(
        apiEndpoints.notificationPreferences.list
      )
      return Array.isArray(response) ? response : (response.results || [])
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || 
                          error?.data?.detail || 
                          error?.message || 
                          "Failed to fetch notification preferences"
      throw new Error(errorMessage)
    }
  }
}

// Export unified service instance
export const notificationService = new NotificationService()

// Export preference methods as separate service for backward compatibility
export const notificationPreferenceService = {
  getMyPreferences: () => notificationService.getMyPreferences(),
  update: (id: string, data: Partial<NotificationPreference>) => 
    notificationService.updatePreference(id, data),
  create: (data: Partial<NotificationPreference>) => 
    notificationService.createPreference(data),
}
