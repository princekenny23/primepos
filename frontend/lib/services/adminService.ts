import { api, apiEndpoints } from "@/lib/api"

export interface AdminTenant {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  type: string
  is_active: boolean
  created_at: string
  updated_at: string
  // Additional fields from analytics
  users?: number | any[]  // Can be array from backend or number from analytics
  outlets?: number | any[]  // Can be array from backend or number from analytics
  revenue?: number
  total_manual_payments?: number
}

export interface TenantPaymentRecord {
  id: string
  amount: number
  reason: string
  notes?: string
  payment_date: string
  recorded_by_name?: string | null
  created_at: string
}

export interface TenantPaymentSummary {
  tenant_id: string
  tenant_name: string
  total_paid: number
  payment_count: number
  payments: TenantPaymentRecord[]
}

export interface PlatformAnalytics {
  total_tenants: number
  active_tenants: number
  total_outlets: number
  total_users: number
  total_revenue: number
  new_tenants_30d: number
  type_distribution: Array<{ type: string; count: number }>
}

export const adminService = {
  async getTenants(): Promise<AdminTenant[]> {
    const response = await api.get<{ results: AdminTenant[] } | AdminTenant[]>(apiEndpoints.admin.tenants)
    // Handle both paginated and non-paginated responses
    const tenants = Array.isArray(response) ? response : (response.results || [])
    
    // Transform outlets and users arrays to counts for list view
    return tenants.map(tenant => ({
      ...tenant,
      // If outlets/users are arrays, convert to counts
      outlets: Array.isArray(tenant.outlets) ? tenant.outlets.length : (tenant.outlets || 0),
      users: Array.isArray(tenant.users) ? tenant.users.length : (tenant.users || 0),
      total_manual_payments: Number((tenant as any).total_manual_payments || 0),
    }))
  },

  async getTenant(id: string): Promise<any> {
    // For detail view, return full data with arrays intact
    return api.get(`${apiEndpoints.admin.tenants}${id}/`)
  },

  async suspendTenant(id: string, reason: string): Promise<void> {
    await api.post(`${apiEndpoints.admin.tenants}${id}/suspend/`, { reason })
  },

  async activateTenant(id: string): Promise<void> {
    await api.post(`${apiEndpoints.admin.tenants}${id}/activate/`)
  },

  async updateTenant(id: string, data: Partial<AdminTenant>): Promise<AdminTenant> {
    return api.put(`${apiEndpoints.admin.tenants}${id}/`, data)
  },

  async deleteTenant(id: string): Promise<void> {
    await api.delete(`${apiEndpoints.admin.tenants}${id}/`)
  },

  async getAnalytics(): Promise<PlatformAnalytics> {
    return api.get(apiEndpoints.admin.analytics)
  },

  async getTenantPermissions(tenantId: string): Promise<any> {
    return api.get(`${apiEndpoints.admin.tenants}${tenantId}/permissions/`)
  },

  async updateTenantPermissions(tenantId: string, permissions: any): Promise<any> {
    return api.put(`${apiEndpoints.admin.tenants}${tenantId}/permissions/`, permissions)
  },

  async getTenantPayments(tenantId: string): Promise<TenantPaymentSummary> {
    const response = await api.get<any>(`${apiEndpoints.admin.tenants}${tenantId}/payments/`)
    return {
      ...response,
      total_paid: Number(response.total_paid || 0),
      payment_count: Number(response.payment_count || 0),
      payments: Array.isArray(response.payments)
        ? response.payments.map((payment: any) => ({
            ...payment,
            amount: Number(payment.amount || 0),
          }))
        : [],
    }
  },

  async recordTenantPayment(tenantId: string, payload: { amount: number; reason: string; notes?: string; payment_date?: string }): Promise<any> {
    return api.post(`${apiEndpoints.admin.tenants}${tenantId}/payments/`, payload)
  },
}

