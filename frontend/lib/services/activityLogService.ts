import { api, apiEndpoints } from "@/lib/api"

export interface ActivityLog {
  id: number
  tenant: number
  tenant_name: string
  user: number | null
  user_details: {
    id: number
    email: string
    name: string
    role: string
  } | null
  action: string
  module: string
  resource_type: string
  resource_id: string
  description: string
  metadata: Record<string, any>
  ip_address: string | null
  user_agent: string
  request_path: string
  request_method: string
  created_at: string
}

export interface ActivityLogFilters {
  action?: string
  module?: string
  user?: number
  outlet?: number | string
  resource_type?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  page_size?: number
}

export interface ActivityLogSummary {
  total_actions: number
  date_range_days: number
  action_counts: Record<string, number>
  module_counts: Record<string, number>
  top_users: Array<{
    user__email: string
    user__name: string
    count: number
  }>
}

class ActivityLogService {
  async list(filters: ActivityLogFilters = {}): Promise<{ results: ActivityLog[]; count: number }> {
    const params = new URLSearchParams()
    
    if (filters.action) params.append('action', filters.action)
    if (filters.module) params.append('module', filters.module)
    if (filters.user) params.append('user', String(filters.user))
    if (filters.outlet) params.append('outlet', String(filters.outlet))
    if (filters.resource_type) params.append('resource_type', filters.resource_type)
    if (filters.date_from) params.append('date_from', filters.date_from)
    if (filters.date_to) params.append('date_to', filters.date_to)
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', String(filters.page))
    if (filters.page_size) params.append('page_size', String(filters.page_size))
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.activityLogs.list}${query ? `?${query}` : ""}`)
    
    // Handle both paginated and non-paginated responses
    if (Array.isArray(response)) {
      return { results: response, count: response.length }
    }
    return {
      results: response.results || [],
      count: response.count || (response.results?.length || 0),
    }
  }
  
  async get(id: number): Promise<ActivityLog> {
    return api.get(apiEndpoints.activityLogs.get(String(id)))
  }
  
  async getSummary(days: number = 30): Promise<ActivityLogSummary> {
    return api.get(`${apiEndpoints.activityLogs.summary}?days=${days}`)
  }
}

export const activityLogService = new ActivityLogService()

