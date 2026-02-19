import { api, apiEndpoints } from "@/lib/api"

export interface Customer {
  id: string
  tenant?: string
  outlet?: string
  outlet_id?: string | number
  name: string
  email?: string
  phone?: string
  address?: string
  loyalty_points?: number
  points?: number
  total_spent?: number
  last_visit?: string
  is_active?: boolean
  // Credit/Accounts Receivable Fields
  credit_enabled?: boolean
  credit_limit?: number
  payment_terms_days?: number
  credit_status?: 'active' | 'suspended' | 'closed'
  credit_notes?: string
  outstanding_balance?: number
  available_credit?: number
  created_at?: string
  updated_at?: string
}

export interface CustomerFilters {
  outlet?: string
  is_active?: boolean
  search?: string
  tenant?: string
  businessId?: string
  page?: number
  limit?: number
}

export interface CreditSummary {
  customer_id: string
  customer_name: string
  credit_enabled: boolean
  credit_limit: number
  outstanding_balance: number
  available_credit: number
  payment_terms_days: number
  credit_status: string
  overdue_amount: number
  overdue_count: number
  unpaid_invoices: UnpaidInvoice[]
  unpaid_count: number
}

export interface UnpaidInvoice {
  id: string
  receipt_number: string
  date: string
  due_date: string | null
  total: number
  amount_paid: number
  remaining: number
  payment_status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue'
  is_overdue: boolean
  days_overdue: number
}

export interface CreditPayment {
  id: string
  tenant?: string
  customer: string
  sale: string
  sale_receipt_number?: string
  amount: number
  payment_method: 'cash' | 'card' | 'mobile' | 'bank_transfer' | 'other'
  payment_date: string
  reference_number?: string
  notes?: string
  user?: string
  user_name?: string
  created_at?: string
  updated_at?: string
}

export const customerService = {
  async list(filters?: CustomerFilters): Promise<Customer[] | { results: Customer[]; count?: number }> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active))
    if (filters?.search) params.append("search", filters.search)
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.businessId) params.append("business", filters.businessId)
    if (filters?.page) params.append("page", String(filters.page))
    if (filters?.limit) params.append("limit", String(filters.limit))
    
    const query = params.toString()
    const response = await api.get<any>(`${apiEndpoints.customers.list}${query ? `?${query}` : ""}`)
    // Handle both array and paginated response formats
    if (Array.isArray(response)) {
      return response
    }
    return response
  },

  async get(id: string): Promise<Customer> {
    return api.get(apiEndpoints.customers.get(id))
  },

  async create(data: Partial<Customer>): Promise<Customer> {
    return api.post(apiEndpoints.customers.create, data)
  },

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    return api.put(apiEndpoints.customers.update(id), data)
  },

  async adjustPoints(id: string, points: number, type: "earned" | "redeemed" | "adjusted", reason?: string): Promise<Customer> {
    return api.post(apiEndpoints.customers.adjustPoints(id), {
      points,
      type,
      reason,
    })
  },

  async getCreditSummary(id: string): Promise<CreditSummary> {
    return api.get(apiEndpoints.customers.creditSummary(id))
  },

  async adjustCredit(
    id: string,
    data: {
      credit_limit?: number
      payment_terms_days?: number
      credit_enabled?: boolean
      credit_status?: 'active' | 'suspended' | 'closed'
      credit_notes?: string
    }
  ): Promise<Customer> {
    return api.patch(apiEndpoints.customers.adjustCredit(id), data)
  },
}

export const creditPaymentService = {
  async list(filters?: { customer?: string; sale?: string }): Promise<{ results: CreditPayment[] }> {
    const params = new URLSearchParams()
    if (filters?.customer) params.append("customer", filters.customer)
    if (filters?.sale) params.append("sale", filters.sale)
    
    const query = params.toString()
    return api.get(`${apiEndpoints.creditPayments.list}${query ? `?${query}` : ""}`)
  },

  async create(data: Partial<CreditPayment>): Promise<CreditPayment> {
    return api.post(apiEndpoints.creditPayments.create, data)
  },

  async get(id: string): Promise<CreditPayment> {
    return api.get(apiEndpoints.creditPayments.get(id))
  },
}

