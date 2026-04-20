// Type Definitions for PrimePOS

export type BusinessType = "wholesale and retail" | "restaurant" | "bar"
export type POSType = "standard" | "single_product"
export type OutletBusinessType = "wholesale_and_retail" | "restaurant" | "bar"

export interface Business {
  id: string
  name: string
  type: BusinessType
  posType: POSType
  logo?: string
  currency: string
  currencySymbol: string
  phone: string
  email: string
  address?: string
  createdAt: string
  settings: BusinessSettings
}

export interface BusinessSettings {
  posMode: "standard" | "restaurant" | "bar"
  receiptTemplate: string
  taxEnabled: boolean
  taxRate: number
  printerSettings?: any
  timezone?: string
  taxId?: string
  language?: string
}

export interface Outlet {
  id: string
  businessId: string
  name: string
  address?: string
  phone?: string
  email?: string
  businessType?: OutletBusinessType
  businessTypeDisplay?: string
  settings?: BusinessSettings
  distributionActive?: boolean
  isActive: boolean
  createdAt: string
}

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  role: string
  effective_role?: string
  businessId: string
  outletIds: string[]
  createdAt: string
  tenant?: {
    id: string | number
    name?: string
    type?: string
    has_distribution?: boolean
    permissions?: {
      allow_sales?: boolean
      allow_pos?: boolean
      allow_inventory?: boolean
      allow_office?: boolean
      allow_settings?: boolean
      allow_storefront?: boolean
      allow_sales_create?: boolean
      allow_sales_refund?: boolean
      allow_sales_reports?: boolean
      allow_pos_restaurant?: boolean
      allow_pos_bar?: boolean
      allow_pos_retail?: boolean
      allow_pos_discounts?: boolean
      allow_inventory_products?: boolean
      allow_inventory_stock_take?: boolean
      allow_inventory_transfers?: boolean
      allow_inventory_adjustments?: boolean
      allow_inventory_suppliers?: boolean
      allow_office_accounting?: boolean
      allow_office_hr?: boolean
      allow_office_users?: boolean
      allow_office_staff?: boolean
      allow_office_shift_management?: boolean
      allow_office_reports?: boolean
      allow_office_analytics?: boolean
      allow_settings_users?: boolean
      allow_settings_outlets?: boolean
      allow_settings_integrations?: boolean
      allow_settings_advanced?: boolean
      allow_storefront_sites?: boolean
      allow_storefront_orders?: boolean
      allow_storefront_reports?: boolean
      allow_storefront_settings?: boolean
    }
  } | string | number
  is_saas_admin?: boolean
  permission_codes?: string[]
  permissions?: {
    can_sales: boolean
    can_inventory: boolean
    can_products: boolean
    can_customers: boolean
    can_reports: boolean
    can_staff: boolean
    can_settings: boolean
    can_dashboard: boolean
    can_distribution?: boolean
    can_storefront?: boolean
    can_pos_retail?: boolean
    can_pos_restaurant?: boolean
    can_pos_bar?: boolean
    can_switch_outlet?: boolean
  }
  staff_role?: {
    id: string | number
    name: string
    description?: string
  }
}

export interface ProductUnit {
  id?: string | number
  product?: string | number
  unit_name: string // e.g., "Piece", "Dozen", "Carton"
  conversion_factor: number // e.g., 1.0 for base, 12.0 for dozen
  retail_price: number
  wholesale_price?: number
  is_active?: boolean
  is_base_unit?: boolean
  low_stock_threshold?: number
  sort_order?: number
  created_at?: string
  updated_at?: string
}

export interface Product {
  id: string
  businessId: string
  name: string
  description?: string
  sku?: string
  barcode?: string
  price: number
  retail_price?: number
  cost?: number
  cost_price?: number
  categoryId?: string
  stock: number
  lowStockThreshold?: number
  is_low_stock?: boolean // Backend-calculated low stock flag
  unit?: string
  
  // Units only - no variations (UNITS ONLY ARCHITECTURE)
  selling_units?: ProductUnit[]
  
  // Stock & location info
  location_stocks?: Array<{
    id: string | number
    outlet_id: string | number
    outlet_name?: string
    quantity: number
    available_quantity?: number
  }>
  batches?: Array<{
    id: string | number
    batch_number: string
    quantity: number
    expiry_date: string
    cost_price?: number
    created_at?: string
  }>
  
  // Display fields
  image?: string
  isActive: boolean
  createdAt: string
  
  // Additional fields from backend
  outlet?: { id: string; name: string }
  outlet_id?: string
  outlet_name?: string
  category?: { id: string; name: string }
  wholesale_price?: number
  wholesalePrice?: number
  wholesale_enabled?: boolean
  wholesaleEnabled?: boolean
  minimum_wholesale_quantity?: number
  minimumWholesaleQuantity?: number
  
  // Expiry tracking fields
  track_expiration?: boolean
  manufacturing_date?: string
  expiry_date?: string
  
  // Restaurant-specific fields
  preparation_time?: number
  
  // Bar-specific fields
  volume_ml?: number
  alcohol_percentage?: number
}

export interface Category {
  id: string
  businessId: string
  name: string
  description?: string
  createdAt: string
}

export interface Sale {
  id: string
  businessId: string
  outletId: string
  userId: string
  items: SaleItem[]
  subtotal: number
  tax: number
  total: number
  discount?: number
  discountType?: "percentage" | "amount"
  discountReason?: string
  paymentMethod: "cash" | "card" | "mobile" | "tab"
  status: "completed" | "pending" | "refunded"
  createdAt: string
  _raw?: any
}

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
  total: number
}

export interface Staff {
  id: string
  businessId: string
  name: string
  email: string
  phone?: string
  role: string
  outletIds: string[]
  isActive: boolean
  createdAt: string
}

