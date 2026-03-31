import { api, apiEndpoints } from "@/lib/api"

export interface SyncHealthMetrics {
  accepted_events: number
  duplicate_events: number
  rejected_events: number
  change_log_count: number
  latest_cursor: number
}

export interface SyncRejectedEvent {
  id: number
  tenant_id: number
  tenant_name?: string | null
  outlet_id?: number | null
  outlet_name?: string | null
  user_id?: number | null
  client_event_id: string
  event_type: string
  status: string
  detail: string
  retry_count: number
  last_error: string
  created_at: string
  processed_at: string
}

export interface SyncRejectedEventsResponse {
  count: number
  limit: number
  offset: number
  has_next: boolean
  results: SyncRejectedEvent[]
}

export const syncAdminService = {
  async getHealth(tenantId?: string) {
    const query = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : ""
    return api.get<{ tenant_id?: string; metrics: SyncHealthMetrics }>(`${apiEndpoints.admin.syncHealth}${query}`)
  },

  async getRejectedEvents(options?: { tenantId?: string; limit?: number; offset?: number }) {
    const tenantId = options?.tenantId
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    const queryParams = new URLSearchParams()
    queryParams.set("limit", String(limit))
    queryParams.set("offset", String(offset))
    if (tenantId) queryParams.set("tenant_id", tenantId)
    return api.get<SyncRejectedEventsResponse>(`${apiEndpoints.admin.syncRejectedEvents}?${queryParams.toString()}`)
  },

  async requeueEvents(eventIds: number[]) {
    return api.post<{ requested: number; requeued: number; rejected: number; results: any[] }>(
      apiEndpoints.admin.syncRequeue,
      { event_ids: eventIds }
    )
  },
}
