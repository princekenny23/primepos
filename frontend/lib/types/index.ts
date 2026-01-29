// Type Definitions for PrimePOS

export type BusinessType = "wholesale and retail" | "restaurant" | "bar"
export type POSType = "standard" | "single_product"

export interface Business {
  id: string
  name: string
  type: BusinessType
  posType: POSType
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
}

export interface Outlet {
  id: string
  businessId: string
  name: string
  address?: string
  phone?: string
  isActive: boolean
  createdAt: string
}

export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "manager" | "cashier" | "staff"
  effective_role?: string
  businessId: string
  outletIds: string[]
  createdAt: string
  tenant?: {
    id: string | number
    name?: string
    type?: string
  } | string | number
  is_saas_admin?: boolean
  permissions?: {
    can_sales: boolean
    can_inventory: boolean
    can_products: boolean
    can_customers: boolean
    can_reports: boolean
    can_staff: boolean
    can_settings: boolean
    can_dashboard: boolean
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
  role: "admin" | "manager" | "cashier" | "staff"
  outletIds: string[]
  isActive: boolean
  createdAt: string
}

