import { api, apiEndpoints } from "@/lib/api"

export interface Shift {
  id: string
  outletId: string
  tillId: string
  userId: string
  operatingDate: string
  openingCashBalance: number
  floatingCash: number
  closingCashBalance?: number
  totalSales?: number
  totalExpense?: number
  systemTotal?: number
  difference?: number
  status: "OPEN" | "CLOSED"
  startTime: string
  endTime?: string
  notes?: string
  // Backend response fields (for transformation)
  outlet?: any
  till?: any
  user?: any
  operating_date?: string
  opening_cash_balance?: number
  floating_cash?: number
  closing_cash_balance?: number
  system_total?: number
  start_time?: string
  end_time?: string
}

export interface StartShiftData {
  outlet_id: number | string
  till_id: number | string
  operating_date: string
  opening_cash_balance: number
  floating_cash?: number
  notes?: string
}

// Transform backend response to frontend format
function transformShift(backendShift: any): Shift {
  return {
    id: String(backendShift.id),
    outletId: String(backendShift.outlet?.id || backendShift.outlet_id || backendShift.outlet),
    tillId: String(backendShift.till?.id || backendShift.till_id || backendShift.till),
    userId: String(backendShift.user?.id || backendShift.user_id || backendShift.user),
    operatingDate: backendShift.operating_date || backendShift.operatingDate,
    openingCashBalance: parseFloat(backendShift.opening_cash_balance || backendShift.openingCashBalance || 0),
    floatingCash: parseFloat(backendShift.floating_cash || backendShift.floatingCash || 0),
    closingCashBalance: backendShift.closing_cash_balance || backendShift.closingCashBalance ? parseFloat(backendShift.closing_cash_balance || backendShift.closingCashBalance) : undefined,
    totalSales: backendShift.total_sales !== undefined ? parseFloat(backendShift.total_sales) : undefined,
    totalExpense: backendShift.total_expense !== undefined ? parseFloat(backendShift.total_expense) : undefined,
    systemTotal: backendShift.system_total || backendShift.systemTotal ? parseFloat(backendShift.system_total || backendShift.systemTotal) : undefined,
    difference: backendShift.difference ? parseFloat(backendShift.difference) : undefined,
    status: backendShift.status,
    startTime: backendShift.start_time || backendShift.startTime,
    endTime: backendShift.end_time || backendShift.endTime,
    notes: backendShift.notes,
    outlet: backendShift.outlet,
    till: backendShift.till,
    user: backendShift.user,
  }
}

export const shiftService = {
  async start(data: StartShiftData): Promise<Shift> {
    const response = await api.post(apiEndpoints.shifts.start, {
      outlet_id: parseInt(String(data.outlet_id)),
      till_id: parseInt(String(data.till_id)),
      operating_date: data.operating_date,
      opening_cash_balance: parseFloat(String(data.opening_cash_balance)),
      floating_cash: data.floating_cash ? parseFloat(String(data.floating_cash)) : 0,
      notes: data.notes || "",
    })
    return transformShift(response)
  },

  async close(id: string, closingCashBalance: number): Promise<Shift> {
    try {
      const response = await api.post(apiEndpoints.shifts.close(id), {
        closing_cash_balance: parseFloat(String(closingCashBalance)),
      })
      return transformShift(response)
    } catch (error: any) {
      // Provide more detailed error message
      const errorMessage = error?.data?.detail || error?.message || "Failed to close shift"
      console.error("Error closing shift:", {
        id,
        closingCashBalance,
        error: errorMessage,
        status: error?.status,
      })
      throw new Error(errorMessage)
    }
  },

  async getActive(outletId?: string, tillId?: string): Promise<Shift | null> {
    try {
      const params = new URLSearchParams()
      if (outletId) params.append("outlet_id", String(outletId))
      if (tillId) params.append("till_id", String(tillId))
      
      const query = params.toString()
      const response = await api.get(`${apiEndpoints.shifts.active}${query ? `?${query}` : ""}`)
      return transformShift(response)
    } catch (error: any) {
      if (error.message?.includes("404") || error.message?.includes("No active shift")) {
        return null
      }
      throw error
    }
  },

  async getCurrent(outletId?: string, tillId?: string): Promise<Shift | null> {
    try {
      const params = new URLSearchParams()
      if (outletId) params.append("outlet_id", String(outletId))
      if (tillId) params.append("till_id", String(tillId))
      
      const query = params.toString()
      const response = await api.get(`${apiEndpoints.shifts.current}${query ? `?${query}` : ""}`)
      return transformShift(response)
    } catch (error: any) {
      if (error.message?.includes("404") || error.message?.includes("No open shift")) {
        return null
      }
      throw error
    }
  },

  async listOpen(filters?: { outlet?: string; till?: string }): Promise<Shift[]> {
    try {
      const params = new URLSearchParams()
      params.append("status", "OPEN")
      if (filters?.outlet) params.append("outlet", String(filters.outlet))
      if (filters?.till) params.append("till", String(filters.till))
      
      const query = params.toString()
      const response = await api.get<{ results: any[] } | any[]>(`${apiEndpoints.shifts.list}${query ? `?${query}` : ""}`)
      const shifts = Array.isArray(response) ? response : (response.results || [])
      return shifts.map(transformShift)
    } catch (error) {
      console.error("Error loading open shifts:", error)
      return []
    }
  },

  async getHistory(filters?: { outlet?: string; status?: string; operating_date?: string; start_date?: string; end_date?: string }): Promise<Shift[]> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", String(filters.outlet))
    if (filters?.status) params.append("status", filters.status)
    if (filters?.operating_date) params.append("operating_date", filters.operating_date)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    
    const query = params.toString()
    const response = await api.get<{ results: any[] } | any[]>(`${apiEndpoints.shifts.history}${query ? `?${query}` : ""}`)
    const shifts = Array.isArray(response) ? response : (response.results || [])
    return shifts.map(transformShift)
  },

  async checkExists(outletId: string, tillId: string, date: string): Promise<boolean> {
    const response = await api.get<{ exists: boolean }>(
      `${apiEndpoints.shifts.check}?outlet_id=${outletId}&till_id=${tillId}&date=${date}`
    )
    return response.exists
  },
}

