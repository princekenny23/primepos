import { api, apiEndpoints } from "@/lib/api"

export interface SyncHealthMetrics {
  total_offline: number
  pending_events: number
  approved_events: number
  applied_events: number
  deleted_events: number
  failed_events: number
  accepted_events: number
  duplicate_events: number
  rejected_events: number
  change_log_count: number
  latest_cursor: number
}

export interface SyncEvent {
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

export interface SyncEventsResponse {
  count: number
  limit: number
  offset: number
  has_next: boolean
  results: SyncEvent[]
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
    return api.get<SyncEventsResponse>(`${apiEndpoints.admin.syncRejectedEvents}?${queryParams.toString()}`)
  },

  async getPendingEvents(options?: { tenantId?: string; limit?: number; offset?: number }) {
    const tenantId = options?.tenantId
    const limit = options?.limit ?? 100
    const offset = options?.offset ?? 0
    const queryParams = new URLSearchParams()
    queryParams.set("limit", String(limit))
    queryParams.set("offset", String(offset))
    if (tenantId) queryParams.set("tenant_id", tenantId)
    return api.get<SyncEventsResponse>(`${apiEndpoints.admin.syncPendingEvents}?${queryParams.toString()}`)
  },

  async applyEvents(eventIds: number[]) {
    return api.post<{ requested: number; applied: number; failed: number; results: any[] }>(
      apiEndpoints.admin.syncBatchApply,
      { event_ids: eventIds }
    )
  },

  async deleteEvents(eventIds: number[]) {
    return api.post<{ requested: number; deleted: number; results: any[] }>(
      apiEndpoints.admin.syncBatchDelete,
      { event_ids: eventIds }
    )
  },

  async requeueEvents(eventIds: number[]) {
    return api.post<{ requested: number; requeued: number; rejected: number; results: any[] }>(
      apiEndpoints.admin.syncRequeue,
      { event_ids: eventIds }
    )
  },
}
