import { api } from "@/lib/api"

export interface Expense {
  id: string
  expense_number: string
  title: string
  category: string
  vendor?: string
  description: string
  amount: number
  payment_method: string
  payment_reference?: string
  expense_date: string
  outlet_id?: string
  outlet_name?: string
  shift_id?: string
  status: "pending" | "approved" | "rejected"
  created_at: string
  updated_at: string
}

export interface ExpenseFilters {
  tenant?: string
  outlet?: string
  category?: string
  status?: string
  start_date?: string
  end_date?: string
  search?: string
}

export interface ExpenseCreateData {
  title: string
  category: string
  vendor?: string
  description: string
  amount: number
  payment_method: string
  payment_reference?: string
  expense_date: string
  outlet_id?: string
  shift_id?: string
}

export const expenseService = {
  async list(filters?: ExpenseFilters): Promise<{ results: Expense[]; count: number }> {
    const params = new URLSearchParams()
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.category) params.append("category", filters.category)
    if (filters?.status) params.append("status", filters.status)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    if (filters?.search) params.append("search", filters.search)
    
    const query = params.toString()
    const response = await api.get<{ results: Expense[]; count: number }>(
      `/expenses/${query ? `?${query}` : ""}`
    )
    return response
  },

  async get(id: string): Promise<Expense> {
    return api.get<Expense>(`/expenses/${id}/`)
  },

  async create(data: ExpenseCreateData): Promise<Expense> {
    return api.post<Expense>("/expenses/", data)
  },

  async update(id: string, data: Partial<ExpenseCreateData>): Promise<Expense> {
    return api.put<Expense>(`/expenses/${id}/`, data)
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/expenses/${id}/`)
  },

  async approve(id: string, notes?: string): Promise<Expense> {
    return api.patch<Expense>(`/expenses/${id}/approve/`, { notes })
  },

  async reject(id: string, notes?: string): Promise<Expense> {
    return api.patch<Expense>(`/expenses/${id}/reject/`, { notes })
  },

  async stats(filters?: ExpenseFilters): Promise<{
    total_expenses: number
    today_expenses: number
    pending_count: number
    category_breakdown: Array<{ category: string; total: number; count: number }>
    status_breakdown: Array<{ status: string; total: number; count: number }>
  }> {
    const params = new URLSearchParams()
    if (filters?.tenant) params.append("tenant", filters.tenant)
    if (filters?.outlet) params.append("outlet", filters.outlet)
    
    const query = params.toString()
    return api.get(`/expenses/stats/${query ? `?${query}` : ""}`)
  },
}

