import { api } from "@/lib/api"

const PUBLIC_API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://primepos-5mf6.onrender.com/api/v1"

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${PUBLIC_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  })

  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const data = await response.json()
      detail = data?.detail || detail
    } catch {
      // no-op
    }
    throw new Error(detail)
  }

  return response.json() as Promise<T>
}

export interface StorefrontProduct {
  id: number
  name: string
  description: string
  category: number | null
  category_name: string
  retail_price: string
  display_price: string
  stock: number
  unit: string
  image_url: string
  created_at?: string
  is_new_stock?: boolean
}

export interface StorefrontDomain {
  id: number
  domain: string
  is_primary: boolean
  is_verified: boolean
  ssl_status: string
  created_at: string
}

export interface WhatsAppCheckoutPayload {
  customer_name: string
  customer_phone?: string
  customer_address?: string
  notes?: string
  items: Array<{
    product_id: number
    unit_id?: number | null
    quantity: number
  }>
}

export interface StorefrontAdmin {
  id: number
  name: string
  slug: string
  default_outlet: number
  outlet_name: string
  whatsapp_number: string
  currency_override: string
  is_active: boolean
  theme_settings?: Record<string, string>
  checkout_settings?: Record<string, any>
  seo_settings?: Record<string, any>
}

export interface CatalogRule {
  id: number
  rule_type: 'include' | 'exclude'
  category: number | null
  category_name: string | null
  product: number | null
  product_name: string | null
  created_at: string
}

export interface StorefrontOrder {
  public_order_ref: string
  channel: string
  payment_method: string
  status: string
  customer_name: string
  customer_phone: string
  sale_id: number
  receipt_number: string
  total: string
  created_at: string
}

export interface StorefrontAnalytics {
  period_days: number
  events: {
    storefront_view?: number
    product_view?: number
    storefront_add_to_cart?: number
    storefront_checkout_success?: number
    storefront_checkout_failed?: number
    storefront_open_whatsapp_chat?: number
    storefront_copy_whatsapp_preview?: number
    add_to_cart?: number
    checkout_success?: number
    checkout_failed?: number
    open_whatsapp_chat?: number
    copy_whatsapp_preview?: number
    view_product?: number
  }
  order_counts?: {
    created?: number
    pending?: number
    confirmed?: number
    cancelled?: number
  }
  orders?: {
    total?: number
    pending?: number
    confirmed?: number
    cancelled?: number
  }
}

export const storefrontService = {
  resolve(host?: string, slug?: string) {
    const params = new URLSearchParams()
    if (host) params.set("host", host)
    if (slug) params.set("slug", slug)
    return request<{ slug: string; name: string; currency: string; has_whatsapp_checkout: boolean }>(
      `/storefronts/resolve/?${params.toString()}`
    )
  },

  getConfig(slug: string) {
    return request<any>(`/storefronts/${encodeURIComponent(slug)}/config/`)
  },

  getCategories(slug: string) {
    return request<Array<{ id: number; name: string; description: string }>>(
      `/storefronts/${encodeURIComponent(slug)}/categories/`
    )
  },

  getProducts(slug: string, params?: {
    search?: string
    category_id?: number | string
    sort?: "newest" | "name"
    in_stock?: boolean
    limit?: number
    new_stock_days?: number
  }) {
    const query = new URLSearchParams()
    if (params?.search) query.set("search", params.search)
    if (params?.category_id !== undefined) query.set("category_id", String(params.category_id))
    if (params?.sort) query.set("sort", params.sort)
    if (params?.in_stock !== undefined) query.set("in_stock", params.in_stock ? "true" : "false")
    if (params?.limit !== undefined) query.set("limit", String(params.limit))
    if (params?.new_stock_days !== undefined) query.set("new_stock_days", String(params.new_stock_days))
    const suffix = query.toString() ? `?${query.toString()}` : ""
    return request<StorefrontProduct[]>(`/storefronts/${encodeURIComponent(slug)}/products/${suffix}`)
  },

  getProduct(slug: string, productId: number) {
    return request<StorefrontProduct>(`/storefronts/${encodeURIComponent(slug)}/products/${productId}/`)
  },

  validateCheckout(slug: string, payload: WhatsAppCheckoutPayload) {
    return request<{ valid: boolean }>(`/storefronts/${encodeURIComponent(slug)}/checkout/validate/`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  createOrder(slug: string, payload: WhatsAppCheckoutPayload) {
    return request<any>(`/storefronts/${encodeURIComponent(slug)}/checkout/create-order/`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },

  getOrder(slug: string, publicOrderRef: string) {
    return request<StorefrontOrder>(
      `/storefronts/${encodeURIComponent(slug)}/orders/${encodeURIComponent(publicOrderRef)}/`
    )
  },

  listOrders(slug?: string) {
    const params = slug ? `?slug=${encodeURIComponent(slug)}` : ""
    return api.get<StorefrontOrder[]>(`/storefronts/orders/${params}`)
  },

  listStorefronts() {
    return api.get<StorefrontAdmin[]>(`/storefronts/`)
  },

  createStorefront(data: {
    name: string
    slug: string
    default_outlet: number
    whatsapp_number?: string
    currency_override?: string
    theme_settings?: Record<string, string>
    checkout_settings?: Record<string, any>
    seo_settings?: Record<string, any>
  }) {
    return api.post<StorefrontAdmin>(`/storefronts/`, data)
  },

  updateStorefront(id: number, data: Partial<StorefrontAdmin>) {
    return api.patch<StorefrontAdmin>(`/storefronts/${id}/`, data)
  },

  listRules(sfId: number) {
    return api.get<CatalogRule[]>(`/storefronts/${sfId}/rules/`)
  },

  listDomains(sfId: number) {
    return api.get<StorefrontDomain[]>(`/storefronts/${sfId}/domains/`)
  },

  addDomain(sfId: number, data: { domain: string; is_primary?: boolean }) {
    return api.post<StorefrontDomain>(`/storefronts/${sfId}/domains/`, data)
  },

  deleteDomain(sfId: number, domainId: number) {
    return api.delete<void>(`/storefronts/${sfId}/domains/${domainId}/`)
  },

  getAnalytics(sfId: number) {
    return api.get<StorefrontAnalytics>(`/storefronts/${sfId}/analytics/`)
  },

  trackEvent(slug: string, data: { event_name: string; session_id?: string; metadata?: Record<string, any> }) {
    return request<{ ok: boolean }>(`/storefronts/${encodeURIComponent(slug)}/events/`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  addRule(sfId: number, data: { rule_type: 'include' | 'exclude'; category?: number | null; product?: number | null }) {
    return api.post<CatalogRule>(`/storefronts/${sfId}/rules/`, data)
  },

  deleteRule(sfId: number, ruleId: number) {
    return api.delete<void>(`/storefronts/${sfId}/rules/${ruleId}/`)
  },

  updateOrderStatus(publicOrderRef: string, newStatus: 'pending' | 'confirmed' | 'cancelled') {
    return api.patch<StorefrontOrder>(`/storefronts/orders/${encodeURIComponent(publicOrderRef)}/status/`, { status: newStatus })
  },
}
