import { api, apiEndpoints } from "@/lib/api"
import type { Business } from "@/lib/types"

const normalizeCurrencyLabel = (value?: string | null): string => {
  const normalized = String(value || "").trim().toUpperCase()

  if (normalized === "MK") {
    return "MWK"
  }

  return normalized || "MWK"
}

// Map frontend business type to backend tenant type
const mapFrontendTypeToBackend = (type: string | undefined): string => {
  if (!type) return "retail"
  if (type === "wholesale and retail") return "retail"
  return type
}

// Map backend tenant type to frontend business type
const mapBackendTypeToFrontend = (type: string | undefined): string => {
  if (!type) return "wholesale and retail"
  if (type === "retail") return "wholesale and retail"
  return type
}

export const tenantService = {
  async list(): Promise<Business[]> {
    const response = await api.get<{ results: any[] } | any[]>(apiEndpoints.tenants.list)
    // Handle both paginated and non-paginated responses
    const tenants = Array.isArray(response) ? response : (response.results || [])
    // Transform backend types to frontend types
    return tenants.map((tenant: any) => ({
      ...tenant,
      id: String(tenant.id),
      type: mapBackendTypeToFrontend(tenant.type) as Business["type"],
      posType: (tenant.pos_type || tenant.posType || "standard") as Business["posType"],
      currency: normalizeCurrencyLabel(tenant.currency || "MWK"),
      currencySymbol: normalizeCurrencyLabel(tenant.currency_symbol || tenant.currencySymbol || "MWK"),
      logo: tenant.logo || "",
    }))
  },

  async get(id: string): Promise<Business & { outlets?: any[] }> {
    const response = await api.get<any>(apiEndpoints.tenants.get(id))
    
    // Transform backend response to frontend format
    return {
      id: String(response.id),
      name: response.name,
      type: mapBackendTypeToFrontend(response.type) as Business["type"],
      posType: (response.pos_type || response.posType || "standard") as Business["posType"],
      logo: response.logo || "",
      currency: normalizeCurrencyLabel(response.currency || "MWK"),
      currencySymbol: normalizeCurrencyLabel(response.currency_symbol || response.currencySymbol || "MWK"),
      phone: response.phone || "",
      email: response.email || "",
      address: response.address || "",
      createdAt: response.created_at || response.createdAt || new Date().toISOString(),
      settings: response.settings || {
        posMode: "standard",
        receiptTemplate: "standard",
        taxEnabled: false,
        taxRate: 0,
        timezone: "Africa/Blantyre",
      },
      outlets: response.outlets || [], // Include outlets from backend
    } as Business & { outlets?: any[] }
  },

  async getCurrent(): Promise<Business> {
    const response = await api.get<any>(`${apiEndpoints.tenants.list}current/`)
    // Transform backend response to frontend format
    return {
      id: String(response.id),
      name: response.name,
      type: mapBackendTypeToFrontend(response.type) as Business["type"],
      posType: (response.pos_type || response.posType || "standard") as Business["posType"],
      logo: response.logo || "",
      currency: normalizeCurrencyLabel(response.currency || "MWK"),
      currencySymbol: normalizeCurrencyLabel(response.currency_symbol || response.currencySymbol || "MWK"),
      phone: response.phone || "",
      email: response.email || "",
      address: response.address || "",
      createdAt: response.created_at || response.createdAt || new Date().toISOString(),
      settings: response.settings || {
        posMode: "standard",
        receiptTemplate: "standard",
        taxEnabled: false,
        taxRate: 0,
        timezone: "Africa/Blantyre",
      },
    } as Business
  },

  async create(data: Partial<Business>): Promise<Business> {
    // Transform frontend data to backend format
    const backendData: any = {
      name: data.name,
      type: mapFrontendTypeToBackend(data.type),
      pos_type: data.posType || "standard",
      currency: normalizeCurrencyLabel(data.currency || "MWK"),
      currency_symbol: normalizeCurrencyLabel(data.currencySymbol || "MWK"),
      phone: data.phone || "",
      // Only include email if it's a valid non-empty string
      ...(data.email && data.email.trim() ? { email: data.email.trim() } : {}),
      address: data.address || "",
      settings: data.settings || {},
    }
    
    const response = await api.post<any>(apiEndpoints.tenants.create, backendData)
    
    // Transform backend response to frontend format
    return {
      id: String(response.id),
      name: response.name,
      type: mapBackendTypeToFrontend(response.type) as Business["type"],
      posType: (response.pos_type || response.posType || "standard") as Business["posType"],
      logo: response.logo || "",
      currency: normalizeCurrencyLabel(response.currency || "MWK"),
      currencySymbol: normalizeCurrencyLabel(response.currency_symbol || response.currencySymbol || "MWK"),
      phone: response.phone || "",
      email: response.email || "",
      address: response.address || "",
      createdAt: response.created_at || response.createdAt || new Date().toISOString(),
      settings: response.settings || {},
    } as Business
  },

  async update(id: string, data: Partial<Business>): Promise<Business> {
    // Get current tenant to merge settings and fill required fields
    const currentTenant = await this.get(id)
    
    // Transform frontend data to backend format
    // Use current tenant values as fallback for required fields
    const backendData: any = {
      name: data.name ?? currentTenant.name,
      type: mapFrontendTypeToBackend(data.type ?? currentTenant.type),
      pos_type: data.posType ?? currentTenant.posType ?? "standard",
      currency: normalizeCurrencyLabel(data.currency ?? currentTenant.currency ?? "MWK"),
      currency_symbol: normalizeCurrencyLabel(data.currencySymbol || currentTenant.currencySymbol || "MWK"),
      phone: data.phone ?? currentTenant.phone ?? "",
      address: data.address ?? currentTenant.address ?? "",
    }
    
    // Only include email if it's a valid non-empty string
    const email = data.email ?? currentTenant.email
    if (email && email.trim()) {
      backendData.email = email.trim()
    }
    
    // Merge settings if provided
    if (data.settings) {
      backendData.settings = {
        ...(currentTenant.settings || {}),
        ...data.settings,
      }
    } else {
      backendData.settings = currentTenant.settings || {}
    }
    
    const response = await api.put<any>(apiEndpoints.tenants.update(id), backendData)
    
    // Transform backend response to frontend format
    return {
      id: String(response.id),
      name: response.name,
      type: mapBackendTypeToFrontend(response.type) as Business["type"],
      posType: (response.pos_type || response.posType || "standard") as Business["posType"],
      logo: response.logo || "",
      currency: normalizeCurrencyLabel(response.currency || "MWK"),
      currencySymbol: normalizeCurrencyLabel(response.currency_symbol || response.currencySymbol || "MWK"),
      phone: response.phone || "",
      email: response.email || "",
      address: response.address || "",
      createdAt: response.created_at || response.createdAt || new Date().toISOString(),
      settings: response.settings || {},
    } as Business
  },
}

