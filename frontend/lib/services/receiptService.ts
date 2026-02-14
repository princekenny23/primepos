import { api, apiEndpoints } from "@/lib/api"

export interface Receipt {
  id: string
  receipt_number: string
  sale: {
    id: string
    receipt_number: string
    total: string
    created_at: string
    outlet?: {
      id: string
      name: string
    }
  }
  sale_detail?: {
    id: string
    receipt_number: string
    total: string
    created_at: string
    outlet?: {
      id: string
      name: string
    }
  }
  format: 'pdf' | 'escpos' | 'json'
  content: string
  pdf_file?: string
  pdf_url?: string
  generated_at: string
  generated_by?: {
    id: string
    email: string
  }
  is_sent: boolean
  sent_at?: string
  sent_via?: 'email' | 'sms' | 'print' | 'none'
  access_count: number
  last_accessed_at?: string
}

export interface ReceiptFilters {
  outlet?: string
  sale?: string
  format?: 'html' | 'pdf' | 'json'
  is_sent?: boolean
  search?: string
  start_date?: string
  end_date?: string
}

export const receiptService = {
  async list(filters?: ReceiptFilters): Promise<{ results: Receipt[]; count?: number }> {
    // Ensure apiEndpoints.receipts exists
    if (!apiEndpoints || !apiEndpoints.receipts || !apiEndpoints.receipts.list) {
      console.error("Receipts API endpoints not available:", { apiEndpoints, receipts: apiEndpoints?.receipts })
      throw new Error("Receipts API endpoints are not configured. Please check api.ts configuration.")
    }
    
    const params = new URLSearchParams()
    if (filters?.outlet) params.append("outlet", filters.outlet)
    if (filters?.sale) params.append("sale", filters.sale)
    if (filters?.format) params.append("format", filters.format)
    if (filters?.is_sent !== undefined) params.append("is_sent", String(filters.is_sent))
    if (filters?.search) params.append("search", filters.search)
    if (filters?.start_date) params.append("start_date", filters.start_date)
    if (filters?.end_date) params.append("end_date", filters.end_date)
    
    const query = params.toString()
    // Use direct endpoint path as fallback if apiEndpoints.receipts is not available
    const endpoint = apiEndpoints?.receipts?.list || "/receipts/"
    const url = `${endpoint}${query ? `?${query}` : ""}`
    
    console.log("Fetching receipts from:", url)
    const response = await api.get<any>(url)
    console.log("Receipts API response:", response)
    
    if (Array.isArray(response)) {
      return {
        results: response,
        count: response.length,
      }
    }
    
    return {
      results: response.results || [],
      count: response.count || 0,
    }
  },

  async get(id: string): Promise<Receipt> {
    if (!apiEndpoints?.receipts?.get) {
      throw new Error("Receipts API endpoints are not configured")
    }
    return api.get<Receipt>(apiEndpoints.receipts.get(id))
  },

  async getByNumber(receiptNumber: string): Promise<Receipt> {
    if (!apiEndpoints?.receipts?.byNumber) {
      throw new Error("Receipts API endpoints are not configured")
    }
    return api.get<Receipt>(apiEndpoints.receipts.byNumber(receiptNumber))
  },

  async getBySale(saleId: string): Promise<Receipt> {
    if (!apiEndpoints?.receipts?.bySale) {
      throw new Error("Receipts API endpoints are not configured")
    }
    return api.get<Receipt>(apiEndpoints.receipts.bySale(saleId))
  },

  async download(id: string): Promise<{ data: Blob; contentType: string | null }> {
    if (!apiEndpoints?.receipts?.download) {
      throw new Error("Receipts API endpoints are not configured")
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
    
    const response = await fetch(`${API_BASE_URL}${apiEndpoints.receipts.download(id)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to download receipt')
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type')
    return { data: blob, contentType }
  },

  async regenerate(id: string, format: 'pdf' | 'escpos' | 'json' = 'pdf'): Promise<Receipt> {
    if (!apiEndpoints?.receipts?.regenerate) {
      throw new Error("Receipts API endpoints are not configured")
    }
    return api.post<Receipt>(apiEndpoints.receipts.regenerate(id), { format })
  },
}

